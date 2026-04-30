const logger = require('../utils/logger');
const db = require('../config/query.js');
const { ValidateUserBranchbyUserBranch } = require('../utils/validator');
const { notifyUsers } = require('../config/sockets');
const { trackNotification } = require('../config/sockets/notification-acknowledgement');
const { v4: uuidv4 } = require('uuid');

/**
 * Notify patients under the staff member's location and branch
 *
 * FIXED:
 * - Added null checks for branch/location
 * - Fixed location filter to prevent NULL locations from getting all notifications
 *
 * @param {string} staffUserId - The staff member user ID sending the notification
 * @param {string} message - The notification message (text freeform)
 * @returns {Promise<{
 *   notificationId: string,
 *   totalRecipients: number,
 *   delivery: {
 *     delivered: Array<{userId: string, deliveryMethod: 'socket', status: 'delivered'}>
 *     queued: Array<{userId: string, deliveryMethod: 'email', status: 'queued'}>
 *   }
 * }>}
 */
/**
 * @param {string} staffUserId
 * @param {string} message
 * @param {Array<string|number>|null} [recipientIds] - Optional. If provided, notify only these patient IDs.
 *   Each ID is still validated against the staff member's branch/location — out-of-scope patients are skipped.
 *   If null/empty, all patients in the staff's branch/location are notified.
 */
async function notifyPatients(staffUserId, message, recipientIds = null) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message is required and must be a non-empty string');
  }

  const notificationId = `notif_staff_${uuidv4()}`;

  try {
    // Get staff member's branch scope from MedicalPersonnel
    const staffQuery = `
      SELECT mp.id, mp.designation AS branch
      FROM active_medical_personnel mp
      WHERE mp.id = $1 AND mp.is_active = true
    `;

    const staffResult = await db.query(staffQuery, [staffUserId]);
    const staffMember = staffResult.rows[0];

    if (!staffMember) {
      throw new Error(`Staff member not found or not active`);
    }

    const staffBranch = staffMember.branch;

    logger.debug(`[NOTIFY_PATIENTS] Staff ${staffUserId} branch=${staffBranch}`);

    // Determine which patients to notify
    let validPatients;
    if (recipientIds && recipientIds.length > 0) {
      // Notify specific patients — validate they exist in the Patients table
      const filteredQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM active_user_credentials uc
        INNER JOIN "Patients" p ON uc.id = p.id
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE uc.id::text = ANY($1)
        ORDER BY uc.id
      `;
      const filteredResult = await db.query(filteredQuery, [recipientIds.map(String)]);
      validPatients = filteredResult.rows.filter(patient =>
        ValidateUserBranchbyUserBranch(staffBranch, patient.branch)
      );
      logger.debug(`[NOTIFY_PATIENTS] Filtered to ${validPatients.length} valid patients from ${recipientIds.length} requested IDs`);
    } else {
      // Get all patients, then filter by branch in JS via ValidateUserBranchbyUserBranch
      const patientQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM active_user_credentials uc
        INNER JOIN "Patients" p ON uc.id = p.id
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        ORDER BY uc.id
      `;
      const patientResult = await db.query(patientQuery);
      validPatients = patientResult.rows.filter(patient =>
        ValidateUserBranchbyUserBranch(staffBranch, patient.branch)
      );
    }

    if (!validPatients || validPatients.length === 0) {
      logger.info(`[NOTIFY_PATIENTS] No patients found for staff ${staffUserId}`);
      return {
        notificationId,
        totalRecipients: 0,
        delivery: { delivered: [], queued: [] }
      };
    }

    const patientIds = validPatients.map(p => String(p.userId));

    // Get staff member's name for the notification
    const staffNameQuery = `
      SELECT up.first_name, up.last_name
      FROM "UsersPersonal" up
      WHERE up.id = $1
    `;
    const staffNameResult = await db.query(staffNameQuery, [staffUserId]);
    const staffName = staffNameResult.rows[0] 
      ? `${staffNameResult.rows[0].first_name} ${staffNameResult.rows[0].last_name}`.trim()
      : 'Staff Member';

    // Use the socket notification system to notify all patients
    // If socket active, deliver immediately; else queue for next login
    const notificationData = {
      id: notificationId,
      type: 'staff_broadcast',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      from: staffUserId,
      fromName: staffName,
      staffBranch: staffBranch
    };

    logger.info(`[NOTIFY_PATIENTS] Sending notification ${notificationId} to ${patientIds.length} patients from staff:${staffUserId}`);

    const results = await notifyUsers(patientIds, 'staff:notification', notificationData);

    // Track delivery status for each recipient
    const deliveryDetails = {
      delivered: [],
      queued: []
    };

    for (const userId of results.delivered) {
      await trackNotification(notificationId, userId, staffUserId, 'socket');
      deliveryDetails.delivered.push({
        userId,
        deliveryMethod: 'socket',
        status: 'delivered'
      });
    }

    for (const userId of results.queued) {
      await trackNotification(notificationId, userId, staffUserId, 'email');
      deliveryDetails.queued.push({
        userId,
        deliveryMethod: 'email',
        status: 'queued'
      });
    }

    logger.debug(`[NOTIFY_PATIENTS] ${notificationId} - Delivered: ${results.delivered.length}, Queued: ${results.queued.length}`);

    return {
      notificationId,
      totalRecipients: patientIds.length,
      delivery: deliveryDetails
    };
  } catch (err) {
    logger.error(`[NOTIFY_PATIENTS] Error notifying patients: ${err.message}`);
    throw err;
  }
}

module.exports = { notifyPatients };
