const logger = require('../utils/logger');
const db = require('../config/query.js');
const { notifyUsers } = require('../config/sockets');
const { trackNotification } = require('../config/sockets/notification-acknowledgement');
const { v4: uuidv4 } = require('uuid');

/**
 * Notify all staff members with a message from an admin
 *
 * FIXED: Validates that adminUserId exists in database
 *
 * @param {string} adminUserId - The admin user ID sending the notification
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
 * @param {string} adminUserId
 * @param {string} message
 * @param {Array<string|number>|null} [recipientIds] - Optional. If provided, notify only these staff IDs.
 *   The IDs are validated against the Medical status — any ID not belonging to a Medical user is silently skipped.
 *   If null/empty, all staff are notified.
 */
async function notifyStaffs(adminUserId, message, recipientIds = null) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message is required and must be a non-empty string');
  }

  const notificationId = `notif_admin_${uuidv4()}`;

  try {
    // FIXED: Validate that admin user exists
    const adminQuery = `
      SELECT uc.id
      FROM "UserCredentials" uc
      INNER JOIN "UsersPersonal" up ON uc.id = up.id
      WHERE uc.id = $1 AND uc.identity = 'Medical'
    `;

    const adminResult = await db.query(adminQuery, [adminUserId]);
    if (!adminResult.rows[0]) {
      throw new Error(`Admin user not found or not a staff member`);
    }

    // Determine which staff to notify
    let staffMembers;
    if (recipientIds && recipientIds.length > 0) {
      // Notify specific staff — validate they are Medical users
      // Cast id to text so the query is safe for both integer and UUID id columns
      const filteredQuery = `
        SELECT DISTINCT uc.id as "userId"
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE uc.identity = 'Medical'
          AND uc.id::text = ANY($1)
      `;
      const filteredResult = await db.query(filteredQuery, [recipientIds.map(String)]);
      staffMembers = filteredResult.rows;
      logger.debug(`[NOTIFY_STAFFS] Filtered to ${staffMembers.length} valid staff from ${recipientIds.length} requested IDs`);
    } else {
      // Notify all staff members (Medical role users)
      const staffQuery = `
        SELECT DISTINCT uc.id as "userId"
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE uc.identity = 'Medical'
      `;
      const result = await db.query(staffQuery);
      staffMembers = result.rows;
    }

    if (!staffMembers || staffMembers.length === 0) {
      logger.info('[NOTIFY_STAFFS] No staff members found');
      return {
        notificationId,
        totalRecipients: 0,
        delivery: { delivered: [], queued: [] }
      };
    }

    const staffIds = staffMembers.map(s => String(s.userId));

    // Use the socket notification system to notify all staff
    // If socket active, deliver immediately; else queue for next login
    const notificationData = {
      id: notificationId,
      type: 'admin_broadcast',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      from: adminUserId
    };

    logger.info(`[NOTIFY_STAFFS] Sending notification ${notificationId} to ${staffIds.length} staff members from admin:${adminUserId}`);

    const deliveryResults = await notifyUsers(staffIds, 'admin:notification', notificationData);

    // Track delivery status for each recipient
    const deliveryDetails = {
      delivered: [],
      queued: []
    };

    for (const userId of deliveryResults.delivered) {
      await trackNotification(notificationId, userId, adminUserId, 'socket');
      deliveryDetails.delivered.push({
        userId,
        deliveryMethod: 'socket',
        status: 'delivered'
      });
    }

    for (const userId of deliveryResults.queued) {
      await trackNotification(notificationId, userId, adminUserId, 'email');
      deliveryDetails.queued.push({
        userId,
        deliveryMethod: 'email',
        status: 'queued'
      });
    }

    logger.debug(`[NOTIFY_STAFFS] ${notificationId} - Delivered: ${deliveryResults.delivered.length}, Queued: ${deliveryResults.queued.length}`);

    return {
      notificationId,
      totalRecipients: staffIds.length,
      delivery: deliveryDetails
    };
  } catch (err) {
    logger.error(`[NOTIFY_STAFFS] Error notifying staff: ${err.message}`);
    throw err;
  }
}

module.exports = { notifyStaffs };
