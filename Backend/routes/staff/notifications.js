const express = require('express');
const router = express.Router();
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const logger = require('../../utils/logger');
const { notifyStaffs } = require('../../services/notifyStaffs');
const { notifyPatients } = require('../../services/notifyPatients');
const permit = require('../../services/permit');
const { verifyUserIdentities, getUserIdentitiesDetailed, getPatientBranches, resolveUnionBranch } = require('../../config/query');
const {
  acknowledgeNotification,
  getNotificationStatus,
  getSentNotifications,
  getReceivedNotifications
} = require('../../config/sockets/notification-acknowledgement');

/**
 * POST /notify-staffs
 * Admin-only endpoint to send notifications to all staff members
 *
 * FIXED: Added admin permission check
 *
 * Body:
 *   {
 *     "message": "string (required) - The notification message"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "notificationId": "notif_admin_xxx",
 *     "totalRecipients": 10,
 *     "delivery": {
 *       "delivered": [
 *         { "userId": "123", "deliveryMethod": "socket", "status": "delivered" }
 *       ],
 *       "queued": [
 *         { "userId": "456", "deliveryMethod": "email", "status": "queued" }
 *       ]
 *     }
 *   }
 */
router.post('/notify-staffs', jwtProtect('medical'), async (req, res) => {
  try {
    const adminUserId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!adminUserId) {
      logger.warn('[NOTIFY_STAFFS_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    // FIXED: Add admin permission check
    const {permitted: isAdmin} = await permit.isMedicalPermitted(adminUserId, permit.permissions.is_admin);
    if (!isAdmin) {
      logger.warn(`[NOTIFY_STAFFS_ROUTE] Non-admin user ${adminUserId} attempted to broadcast to all staff`);
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Admin permission required to send staff notifications'
      });
    }

    const { message, recipientIds } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Message is required'
      });
    }

    // Validate recipientIds if provided
    if (recipientIds !== undefined) {
      if (!Array.isArray(recipientIds) || recipientIds.some(id => typeof id !== 'string' && typeof id !== 'number')) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'recipientIds must be an array of IDs'
        });
      }

      // Verify all recipient IDs exist and are valid
      const identityCheck = await verifyUserIdentities(recipientIds);
      if (identityCheck.invalid.length > 0) {
        logger.warn(`[NOTIFY_STAFFS_ROUTE] Invalid recipient IDs: ${identityCheck.invalid.join(',')}`);
        return res.status(400).json({
          error: 'INVALID_RECIPIENTS',
          message: `Some recipient IDs are invalid: ${identityCheck.invalid.join(', ')}`,
          invalidCount: identityCheck.totalInvalid
        });
      }
    }

    const targetCount = recipientIds?.length;
    logger.info(`[NOTIFY_STAFFS_ROUTE] Admin ${adminUserId} sending notification to ${targetCount ? targetCount + ' specific staff' : 'all staff'}`);

    // FIXED: Add admin permission check

    const results = await notifyStaffs(adminUserId, message, recipientIds?.length ? recipientIds : null);

    return res.status(200).json({
      success: true,
      notificationId: results.notificationId,
      totalRecipients: results.totalRecipients,
      delivery: results.delivery
    });
  } catch (err) {
    logger.error(`[NOTIFY_STAFFS_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'NOTIFICATION_FAILED',
      message: 'Failed to send staff notifications'
    });
  }
});

/**
 * POST /notify-patients
 * Staff endpoint to send notifications to patients in their branch
 *
 * FIXED: Added null check for staffUserId
 *
 * Body:
 *   {
 *     "message": "string (required) - The notification message"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "notificationId": "notif_staff_xxx",
 *     "totalRecipients": 5,
 *     "delivery": {
 *       "delivered": [...],
 *       "queued": [...]
 *     }
 *   }
 */
router.post('/notify-patients', jwtProtect('medical'), async (req, res) => {
  try {
    const staffUserId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!staffUserId) {
      logger.warn('[NOTIFY_PATIENTS_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    const { message, recipientIds } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Message is required'
      });
    }

    // Validate recipientIds if provided
    if (recipientIds !== undefined) {
      if (!Array.isArray(recipientIds) || recipientIds.some(id => typeof id !== 'string' && typeof id !== 'number')) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'recipientIds must be an array of IDs'
        });
      }

      // Verify all recipient IDs exist and get their details
      const identityCheck = await getUserIdentitiesDetailed(recipientIds);
      if (identityCheck.length === 0) {
        logger.warn(`[NOTIFY_PATIENTS_ROUTE] No valid recipient IDs found`);
        return res.status(400).json({
          error: 'INVALID_RECIPIENTS',
          message: 'No valid recipient IDs provided',
          invalidCount: recipientIds.length
        });
      }

      // Check if any invalid IDs were provided
      const foundIds = new Set(identityCheck.map(u => String(u.id)));
      const invalidIds = recipientIds.filter(id => !foundIds.has(String(id)));
      if (invalidIds.length > 0) {
        logger.warn(`[NOTIFY_PATIENTS_ROUTE] Some invalid recipient IDs: ${invalidIds.join(',')}`);
        // Log warning but allow sending to valid recipients
        logger.info(`[NOTIFY_PATIENTS_ROUTE] Proceeding with ${identityCheck.length} valid recipients`);
      }
    }

    const targetCount = recipientIds?.length;
    logger.info(`[NOTIFY_PATIENTS_ROUTE] Staff ${staffUserId} sending notification to ${targetCount ? targetCount + ' specific patients' : 'all patients in branch'}`);

    // Get union branch for permission check
    let checkBranch = null;
    if (recipientIds && recipientIds.length > 0) {
      const patientBranches = await getPatientBranches(recipientIds);
      checkBranch = resolveUnionBranch(patientBranches);
      logger.info(`[NOTIFY_PATIENTS_ROUTE] Resolved union branch: ${checkBranch} for patients [${recipientIds.join(',')}]`);
    } else {
      // If no specific patients, get staff's own branch
      checkBranch = await permit.getStaffBranch(staffUserId);
      logger.info(`[NOTIFY_PATIENTS_ROUTE] Using staff branch for all patients: ${checkBranch}`);
    }

    // Check permission with resolved branch
    const isPermitted = await permit.isMedicalPermittedBranchBased(staffUserId, permit.permissions.notification_allow_send_to_patients, checkBranch);
    if (!isPermitted) {
      logger.warn(`[NOTIFY_PATIENTS_ROUTE] Staff ${staffUserId} attempted to send patient notifications without permission for branch: ${checkBranch}`);
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Permission required to send patient notifications for branch: ${checkBranch}`
      });
    }

    const results = await notifyPatients(staffUserId, message, recipientIds?.length ? recipientIds : null);

    return res.status(200).json({
      success: true,
      notificationId: results.notificationId,
      totalRecipients: results.totalRecipients,
      delivery: results.delivery
    });
  } catch (err) {
    logger.error(`[NOTIFY_PATIENTS_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'NOTIFICATION_FAILED',
      message: 'Failed to send patient notifications'
    });
  }
});

/**
 * POST /notify-acknowledge
 * Receiver acknowledges receipt of a notification
 *
 * FIXED: Validates that userId is the actual recipient
 *
 * Body:
 *   {
 *     "notificationId": "string (required)"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Notification acknowledged"
 *   }
 */
router.post('/notify-acknowledge', jwtProtect('all'), async (req, res) => {
  try {
    const userId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!userId) {
      logger.warn('[ACKNOWLEDGE_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'notificationId is required'
      });
    }

    logger.debug(`[ACKNOWLEDGE_ROUTE] User ${userId} acknowledging notif:${notificationId}`);

    // FIXED: Pass userId to acknowledgeNotification for security verification
    const acknowledged = await acknowledgeNotification(notificationId, userId);

    if (!acknowledged) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Notification not found or already expired'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification acknowledged'
    });
  } catch (err) {
    logger.error(`[ACKNOWLEDGE_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'ACKNOWLEDGE_FAILED',
      message: 'Failed to acknowledge notification'
    });
  }
});

/**
 * GET /notify-status/:notificationId
 * Get the transmission and acknowledgement status of a notification
 *
 * FIXED: Updated to pass userId to getNotificationStatus
 *
 * Response:
 *   {
 *     "success": true,
 *     "status": {
 *       "notificationId": "notif_admin_xxx",
 *       "userId": "456",
 *       "senderId": "123",
 *       "deliveredVia": "socket" or "email",
 *       "timestamp": 1234567890,
 *       "acknowledged": true/false,
 *       "acknowledgedAt": 1234567900 or null,
 *       "deliveryDuration": "1 minute" (if acknowledged)
 *     }
 *   }
 */
router.get('/notify-status/:notificationId', jwtProtect('all'), async (req, res) => {
  try {
    const userId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!userId) {
      logger.warn('[STATUS_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'notificationId is required'
      });
    }

    logger.debug(`[STATUS_ROUTE] Fetching status for notif:${notificationId}`);

    // FIXED: Pass userId to getNotificationStatus
    const status = await getNotificationStatus(notificationId, userId);

    if (!status) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Notification not found'
      });
    }

    // Add human-readable delivery duration if acknowledged
    const response = { ...status };
    if (status.acknowledged && status.acknowledgedAt) {
      const durationMs = status.acknowledgedAt - status.timestamp;
      response.deliveryDuration = formatDuration(durationMs);
    }

    return res.status(200).json({
      success: true,
      status: response
    });
  } catch (err) {
    logger.error(`[STATUS_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'STATUS_FETCH_FAILED',
      message: 'Failed to fetch notification status'
    });
  }
});

/**
 * GET /notify-sent
 * Get all notifications sent by the current user (for transmission tracking)
 *
 * FIXED: Added null check for userId
 *
 * Response:
 *   {
 *     "success": true,
 *     "notifications": [
 *       {
 *         "notificationId": "notif_admin_xxx",
 *         "userId": "456",
 *         "deliveredVia": "socket",
 *         "timestamp": 1234567890,
 *         "acknowledged": true,
 *         "acknowledgedAt": 1234567900
 *       }
 *     ]
 *   }
 */
router.get('/notify-sent', jwtProtect('medical'), async (req, res) => {
  try {
    const userId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!userId) {
      logger.warn('[SENT_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    logger.debug(`[SENT_ROUTE] Fetching sent notifications for user:${userId}`);

    const notifications = await getSentNotifications(userId);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(notif => ({
        notificationId: notif.notificationId,
        recipientId: notif.userId,
        deliveredVia: notif.deliveredVia,
        timestamp: notif.timestamp,
        acknowledged: notif.acknowledged,
        acknowledgedAt: notif.acknowledgedAt,
        deliveryDuration: notif.acknowledged && notif.acknowledgedAt
          ? formatDuration(notif.acknowledgedAt - notif.timestamp)
          : null
      }))
    });
  } catch (err) {
    logger.error(`[SENT_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to fetch sent notifications'
    });
  }
});

/**
 * GET /notify-received
 * Get all notifications received by the current user
 *
 * FIXED: Added null check for userId
 *
 * Response:
 *   {
 *     "success": true,
 *     "notifications": [
 *       {
 *         "notificationId": "notif_admin_xxx",
 *         "senderId": "123",
 *         "deliveredVia": "socket",
 *         "timestamp": 1234567890,
 *         "acknowledged": true,
 *         "acknowledgedAt": 1234567900
 *       }
 *     ]
 *   }
 */
router.get('/notify-received', jwtProtect('all'), async (req, res) => {
  try {
    const userId = req.user?.id;

    // FIXED: Add null check for user ID
    if (!userId) {
      logger.warn('[RECEIVED_ROUTE] Missing user ID in token');
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'User ID missing from authentication token'
      });
    }

    logger.debug(`[RECEIVED_ROUTE] Fetching received notifications for user:${userId}`);

    const notifications = await getReceivedNotifications(userId);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(notif => ({
        notificationId: notif.notificationId,
        senderId: notif.senderId,
        deliveredVia: notif.deliveredVia,
        timestamp: notif.timestamp,
        acknowledged: notif.acknowledged,
        acknowledgedAt: notif.acknowledgedAt
      }))
    });
  } catch (err) {
    logger.error(`[RECEIVED_ROUTE] Error: ${err.message}`);
    return res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to fetch received notifications'
    });
  }
});

/**
 * Helper: Format milliseconds into human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

module.exports = router;
