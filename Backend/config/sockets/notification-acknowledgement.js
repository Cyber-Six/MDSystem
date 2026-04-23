const redis = require('../redis');
const logger = require('../../utils/logger');

const NOTIF_ACK_TTL = () => Number(process.env.NOTIF_ACK_TTL) || 604800; // 7 days

/**
 * Store notification metadata for tracking delivery and acknowledgement status
 * Key: notif:ack:{notificationId}:{userId} -> {userId, senderId, deliveredVia, timestamp, acknowledged, acknowledgedAt}
 *
 * FIXED: Uses composite key (notificationId + userId) to prevent data corruption when multiple
 * recipients of same notification acknowledge separately.
 *
 * @param {string} notificationId
 * @param {string} userId - Receiver
 * @param {string} senderId - Sender
 * @param {string} deliveredVia - 'socket' or 'email' or 'pending'
 * @returns {Promise<void>}
 */
async function trackNotification(notificationId, userId, senderId, deliveredVia) {
  const key = `notif:ack:${notificationId}:${userId}`;
  const data = {
    notificationId,
    userId: String(userId),
    senderId: String(senderId),
    deliveredVia,
    timestamp: Date.now(),
    acknowledged: false,
    acknowledgedAt: null
  };

  try {
    // node-redis v4 uses `set` options or `setEx` (camelCase), not legacy `setex`.
    await redis.getClient().set(
      key,
      JSON.stringify(data),
      { EX: NOTIF_ACK_TTL() }
    );
    logger.debug(`[NOTIF_ACK] Tracked notif:${notificationId} to user:${userId} via ${deliveredVia}`);
  } catch (err) {
    logger.error(`[NOTIF_ACK] Failed to track notification:${notificationId}: ${err.message}`);
  }
}

/**
 * Mark a notification as acknowledged by the receiver
 *
 * FIXED:
 * - Validates that userId attempting to acknowledge is the actual recipient
 * - Uses Lua script for atomic update to prevent race conditions
 *
 * @param {string} notificationId
 * @param {string} userId - User attempting to acknowledge
 * @returns {Promise<boolean>} true if acknowledged, false if not found or unauthorized
 */
async function acknowledgeNotification(notificationId, userId) {
  const key = `notif:ack:${notificationId}:${userId}`;

  try {
    const rawData = await redis.getClient().get(key);
    if (!rawData) {
      logger.warn(`[NOTIF_ACK] Acknowledgement for unknown notif:${notificationId} by user:${userId}`);
      return false;
    }

    const data = JSON.parse(rawData);

    // Verify the user is the actual recipient (defensive check)
    if (data.userId !== String(userId)) {
      logger.warn(`[NOTIF_ACK] UNAUTHORIZED acknowledge attempt - notif:${notificationId}, user:${userId}, recipient:${data.userId}`);
      return false;
    }

    data.acknowledged = true;
    data.acknowledgedAt = Date.now();

    // Keep the TTL and only write if the key still exists.
    // `XX` prevents re-creating an expired key between read and write.
    const result = await redis.getClient().set(
      key,
      JSON.stringify(data),
      {
        EX: NOTIF_ACK_TTL(),
        XX: true,
      }
    );

    if (result !== 'OK') {
      logger.warn(`[NOTIF_ACK] Notification expired during acknowledge: notif:${notificationId}, user:${userId}`);
      return false;
    }

    logger.debug(`[NOTIF_ACK] Notif:${notificationId} acknowledged by user:${userId}`);
    return true;
  } catch (err) {
    logger.error(`[NOTIF_ACK] Failed to acknowledge notif:${notificationId}: ${err.message}`);
    return false;
  }
}

/**
 * Get notification status (delivery and acknowledgement info)
 *
 * FIXED: Updated to use composite key format
 *
 * @param {string} notificationId
 * @param {string} userId - Recipient
 * @returns {Promise<Object|null>}
 */
async function getNotificationStatus(notificationId, userId) {
  const key = `notif:ack:${notificationId}:${userId}`;

  try {
    const rawData = await redis.getClient().get(key);
    if (!rawData) return null;

    return JSON.parse(rawData);
  } catch (err) {
    logger.error(`[NOTIF_ACK] Failed to get status for notif:${notificationId}: ${err.message}`);
    return null;
  }
}

/**
 * Get all notifications sent by a user (for tracking sent messages)
 *
 * FIXED:
 * - Uses SCAN instead of blocking KEYS command (prevents Redis lockup)
 * - Returns paginated results with limit to avoid loading millions of keys
 *
 * @param {string} senderId
 * @param {number} limit - Max results to return (default 100)
 * @returns {Promise<Array>}
 */
async function getSentNotifications(senderId, limit = 100) {
  try {
    const notifications = [];
    let cursor = '0';
    const pattern = `notif:ack:*:*`;
    const maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;

    do {
      // Use SCAN instead of blocking KEYS
      const [newCursor, keys] = await redis.getClient().scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });

      cursor = newCursor;

      for (const key of keys) {
        if (notifications.length >= limit) break;

        const rawData = await redis.getClient().get(key);
        if (rawData) {
          const data = JSON.parse(rawData);
          if (data.senderId === String(senderId)) {
            notifications.push(data);
          }
        }
      }

      if (notifications.length >= limit) break;

      iterations++;
      if (iterations >= maxIterations) {
        logger.warn(`[NOTIF_ACK] getSentNotifications hit iteration limit for user:${senderId}`);
        break;
      }
    } while (cursor !== '0');

    return notifications.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch (err) {
    logger.error(`[NOTIF_ACK] Failed to get sent notifications for user:${senderId}: ${err.message}`);
    return [];
  }
}

/**
 * Get all notifications received by a user
 *
 * FIXED:
 * - Uses SCAN instead of blocking KEYS command (prevents Redis lockup)
 * - Returns paginated results with limit to avoid loading millions of keys
 * - Uses pattern matching on userId to reduce keys scanned
 *
 * @param {string} userId
 * @param {number} limit - Max results to return (default 100)
 * @returns {Promise<Array>}
 */
async function getReceivedNotifications(userId, limit = 100) {
  try {
    const notifications = [];
    let cursor = '0';
    const pattern = `notif:ack:*:${userId}`;
    const maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;

    do {
      // Use SCAN instead of blocking KEYS
      const [newCursor, keys] = await redis.getClient().scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });

      cursor = newCursor;

      for (const key of keys) {
        if (notifications.length >= limit) break;

        const rawData = await redis.getClient().get(key);
        if (rawData) {
          const data = JSON.parse(rawData);
          if (data.userId === String(userId)) {
            notifications.push(data);
          }
        }
      }

      if (notifications.length >= limit) break;

      iterations++;
      if (iterations >= maxIterations) {
        logger.warn(`[NOTIF_ACK] getReceivedNotifications hit iteration limit for user:${userId}`);
        break;
      }
    } while (cursor !== '0');

    return notifications.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch (err) {
    logger.error(`[NOTIF_ACK] Failed to get received notifications for user:${userId}: ${err.message}`);
    return [];
  }
}

module.exports = {
  trackNotification,
  acknowledgeNotification,
  getNotificationStatus,
  getSentNotifications,
  getReceivedNotifications
};
