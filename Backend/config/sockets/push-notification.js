/**
 * Expo Push Notification Helper
 *
 * Sends remote push notifications to devices via the Expo push service.
 * Used when the patient's app is fully closed (socket is offline).
 *
 * Flow:
 *   1. Mobile app registers its Expo push token with POST /auth/push-token on login
 *   2. Backend stores token in Redis: push-token:{userId}
 *   3. When notifyUser() finds user offline, it calls sendExpoPushNotification()
 *   4. Expo servers forward to FCM (Android) or APNs (iOS)
 */

const { Expo } = require('expo-server-sdk');
const logger = require('../../utils/logger');
const { deletePushToken } = require('./notification-store');

const expo = new Expo();

/**
 * Map a socket event name + data payload to a human-readable push notification.
 *
 * @param {string} eventName
 * @param {*}      data
 * @returns {{ title: string, body: string } | null}   null → no push for this event
 */
function eventToPushContent(eventName, data) {
  switch (eventName) {
    case 'healthchat:new-message': {
      const msg = data?.message;
      const isFile = msg?.promptType === 'file' || msg?.content_type === 'file';
      const body = isFile ? '📎 Sent an image' : (msg?.text || msg?.content || 'New message');
      return { title: '💬 Health Chat', body };
    }
    case 'healthchat:ticket-approved':
      return {
        title: '✅ Health Chat Approved',
        body: 'Your health chat request has been approved. A staff member is ready to assist you.',
      };
    case 'healthchat:ticket-closed':
      return {
        title: 'Health Chat Ended',
        body: 'Your health chat session has been closed.',
      };
    case 'healthchat:ticket-rejected':
      return {
        title: '❌ Health Chat Declined',
        body: 'Your health chat request was not approved. You may try again later.',
      };
    default:
      return null; // No push for other events
  }
}

/**
 * Send an Expo push notification to a device token.
 *
 * @param {string} pushToken   - ExponentPushToken[...] retrieved from the device
 * @param {string} title
 * @param {string} body
 * @param {object} [data]      - Custom data payload (accessible in the app on tap)
 * @param {string} [userId]    - User ID for token cleanup on DeviceNotRegistered
 */
async function sendExpoPushNotification(pushToken, title, body, data = {}, userId = null) {
  if (!Expo.isExpoPushToken(pushToken)) {
    logger.warn(`[PUSH] Invalid Expo push token: ${pushToken}`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: { type: 'health-chat', ...data },
    channelId: 'health-chat', // Android channel
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          logger.warn(`[PUSH] Push ticket error: ${ticket.message}`);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            logger.info('[PUSH] Token is no longer registered, cleaning up.');
            if (userId) {
              await deletePushToken(String(userId));
            }
          }
        }
      }
    }
    logger.debug(`[PUSH] Sent push: "${title}" → ${pushToken.slice(0, 30)}...`);
  } catch (err) {
    logger.error(`[PUSH] Failed to send push notification: ${err.message}`);
  }
}

module.exports = { sendExpoPushNotification, eventToPushContent };
