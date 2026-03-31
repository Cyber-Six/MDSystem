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
    // Get staff member's branch and location
    const staffQuery = `
      SELECT uc.id, up.branch, up.location, up.status
      FROM "UserCredentials" uc
      INNER JOIN "UsersPersonal" up ON uc.id = up.id
      WHERE uc.id = $1
    `;

    const staffResult = await db.query(staffQuery, [staffUserId]);
    const staffMember = staffResult.rows[0];

    if (!staffMember) {
      throw new Error(`Staff member not found`);
    }

    // Verify the user is actually staff (Medical role)
    if (staffMember.status !== 'Medical') {
      throw new Error(`User is not a staff member`);
    }

    const staffBranch = staffMember.branch;
    const staffLocation = staffMember.location;

    // FIXED: Validate that branch and location are not null
    if (!staffBranch || !staffLocation) {
      throw new Error(`Staff member branch/location not configured`);
    }

    logger.debug(`[NOTIFY_PATIENTS] Staff ${staffUserId} branch=${staffBranch}, location=${staffLocation}`);

    // Determine which patients to notify
    let validPatients;
    if (recipientIds && recipientIds.length > 0) {
      // Notify specific patients — still validate they're in the staff's branch/location
      // Cast id to text so the query is safe for both integer and UUID id columns
      const filteredQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE up.status != 'Medical'
          AND up.location = $1
          AND uc.id::text = ANY($2)
        ORDER BY uc.id
      `;
      const filteredResult = await db.query(filteredQuery, [staffLocation, recipientIds.map(String)]);
      validPatients = filteredResult.rows.filter(patient =>
        ValidateUserBranchbyUserBranch(staffBranch, patient.branch)
      );
      logger.debug(`[NOTIFY_PATIENTS] Filtered to ${validPatients.length} valid patients from ${recipientIds.length} requested IDs`);
    } else {
      // Get all patients under the same location
      // FIXED: Removed "OR up.location IS NULL" to prevent unscoped notifications
      const patientQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE up.status != 'Medical'
          AND up.location = $1
        ORDER BY uc.id
      `;
      const patientResult = await db.query(patientQuery, [staffLocation]);
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

    // Use the socket notification system to notify all patients
    // If socket active, deliver immediately; else queue for next login
    const notificationData = {
      id: notificationId,
      type: 'staff_broadcast',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      from: staffUserId,
      staffBranch: staffBranch,
      staffLocation: staffLocation
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
