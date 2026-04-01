const logger = require('../../utils/logger');
const { registerHandlers } = require('./socket-events');
const { acknowledgeNotification } = require('./notification-acknowledgement');

/**
 * Acknowledgement Socket Events
 *
 * Client -> Server:
 *   notif:acknowledge — Client acknowledges receipt of a notification
 *
 * FIXED: Validates that user is the actual recipient of the notification
 *
 * Handlers for notification acknowledgement via socket
 */

const acknowledgementHandlers = {
  /**
   * Client acknowledges receipt of a notification
   * This is faster than HTTP POST for real-time acknowledgement
   *
   * FIXED: Validates userId is recipient
   */
  'notif:acknowledge': async (socket, data, ack) => {
    try {
      const { notificationId } = data;
      const userId = socket.userId;

      if (!notificationId) {
        logger.warn(`[ACK-EVENTS] Missing notificationId from user:${userId}`);
        if (typeof ack === 'function') ack({ error: 'MISSING_ID', message: 'notificationId required' });
        return;
      }

      if (!userId) {
        logger.warn('[ACK-EVENTS] Missing userId in socket');
        if (typeof ack === 'function') ack({ error: 'INVALID_USER', message: 'User ID missing' });
        return;
      }

      // FIXED: Pass userId to acknowledgeNotification for security verification
      const acknowledged = await acknowledgeNotification(notificationId, userId);

      if (!acknowledged) {
        logger.warn(`[ACK-EVENTS] Failed to acknowledge - notif:${notificationId}, user:${userId}`);
        if (typeof ack === 'function') ack({ error: 'ACK_FAILED', message: 'Failed to acknowledge notification' });
        return;
      }

      logger.debug(`[ACK-EVENTS] user:${userId} acknowledged notif:${notificationId}`);

      if (typeof ack === 'function') {
        ack({ success: true, acknowledged: true, notificationId });
      }
    } catch (err) {
      logger.error(`[ACK-EVENTS] Error acknowledging notification: ${err.message}`);
      if (typeof ack === 'function') {
        ack({ error: 'ACKNOWLEDGE_FAILED', message: err.message });
      }
    }
  },
};

registerHandlers(acknowledgementHandlers);
logger.info('[ACK-EVENTS] Acknowledgement socket event handlers registered');

module.exports = { acknowledgementHandlers };
