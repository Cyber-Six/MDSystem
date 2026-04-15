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

const DEFAULT_CHANNEL_ID = 'mds-notifications';
const HEALTH_CHAT_CHANNEL_ID = 'health-chat';

function toPushPayload(title, body, type, eventName, data = {}, channelId = DEFAULT_CHANNEL_ID) {
  return {
    title,
    body,
    channelId,
    data: {
      type,
      event: eventName,
      ...data,
    },
  };
}

function parseAnnouncementMessage(data, fallbackTitle) {
  let title = fallbackTitle;
  let body = '';

  if (typeof data?.message === 'string') {
    if (data.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(data.message);
        title = parsed.title || fallbackTitle;
        body = parsed.body || '';
      } catch {
        body = data.message;
      }
    } else {
      body = data.message;
    }
  }

  if (!body) return null;
  return { title, body };
}

/**
 * Map a socket event name + data payload to a human-readable push notification.
 *
 * @param {string} eventName
 * @param {*}      data
 * @returns {{ title: string, body: string, channelId: string, data: object } | null} null → no push for this event
 */
function eventToPushContent(eventName, data) {
  switch (eventName) {
    case 'healthchat:new-message': {
      const msg = data?.message;
      const isFile = msg?.promptType === 'file' || msg?.content_type === 'file';
      const body = isFile ? '📎 Sent an image' : (msg?.text || msg?.content || 'New message');
      return toPushPayload('💬 Health Chat', body, 'health-chat', eventName, { chatId: data?.chatId ?? data?.chat?.id }, HEALTH_CHAT_CHANNEL_ID);
    }
    case 'healthchat:ticket-approved':
      return toPushPayload(
        '✅ Health Chat Approved',
        'Your health chat request has been approved. A staff member is ready to assist you.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id },
        HEALTH_CHAT_CHANNEL_ID,
      );
    case 'healthchat:ticket-closed':
      return toPushPayload(
        'Health Chat Ended',
        'Your health chat session has been closed.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id },
        HEALTH_CHAT_CHANNEL_ID,
      );
    case 'healthchat:ticket-rejected':
      return toPushPayload(
        '❌ Health Chat Declined',
        'Your health chat request was not approved. You may try again later.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id },
        HEALTH_CHAT_CHANNEL_ID,
      );
    case 'healthchat:ticket-transferred':
      return toPushPayload(
        'Health Chat Reassigned',
        'Your health chat has been reassigned to another staff member.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id },
        HEALTH_CHAT_CHANNEL_ID,
      );
    case 'healthchat:ticket-taken-over':
      return toPushPayload(
        'Health Chat Updated',
        'A staff member has taken over your health chat session.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id },
        HEALTH_CHAT_CHANNEL_ID,
      );
    case 'healthchat:session-extended':
      return toPushPayload(
        'Health Chat Session Extended',
        'Your health chat inactivity timer has been reset.',
        'health-chat',
        eventName,
        { chatId: data?.chatId ?? data?.chat?.id, expiresAt: data?.expiresAt },
        HEALTH_CHAT_CHANNEL_ID,
      );

    case 'appointment:responded': {
      const status = data?.status || 'Updated';
      const verb = status === 'Approved' ? 'confirmed' : String(status).toLowerCase();
      const body = data?.notes
        ? `Your appointment has been ${verb}. Note: ${data.notes}`
        : `Your appointment has been ${verb}.`;
      return toPushPayload(`Appointment ${status}`, body, 'appointment', eventName, { slotId: data?.slotId });
    }
    case 'appointment:attendance-recorded':
      return toPushPayload('Attendance Recorded', 'Your clinic visit has been recorded.', 'appointment', eventName, { slotId: data?.slotId });

    case 'medicine:request:approved':
      return toPushPayload('Medicine Request Approved', 'Your medicine request has been approved.', 'medicine', eventName, { requestId: data?.requestId });
    case 'medicine:request:rejected':
      return toPushPayload('Medicine Request Declined', 'Your medicine request was declined.', 'medicine', eventName, { requestId: data?.requestId });
    case 'medicine:request:pending':
      return toPushPayload('Medicine Request Received', 'Your medicine request is being processed.', 'medicine', eventName, { requestId: data?.requestId });
    case 'medicine:request:cancelled':
      return toPushPayload('Medicine Request Cancelled', 'Your medicine request was cancelled.', 'medicine', eventName, { requestId: data?.requestId });
    case 'medicine:prescription:issued':
      return toPushPayload('Prescription Ready', 'A new prescription has been issued for you.', 'medicine', eventName, { requestId: data?.requestId });

    case 'document:new':
      return toPushPayload('New Document Available', data?.message || 'A new document has been issued for you.', 'document', eventName, { documentId: data?.documentId, templateType: data?.templateType });
    case 'document:approved':
      return toPushPayload('Document Approved', data?.message || 'Your submitted document has been approved.', 'document', eventName, { documentId: data?.documentId });
    case 'document:rejected':
      return toPushPayload('Document Rejected', data?.message || 'Your submitted document was rejected.', 'document', eventName, { documentId: data?.documentId });
    case 'document:cancelled':
      return toPushPayload('Document Request Cancelled', data?.message || 'A document request has been cancelled.', 'document', eventName, { documentId: data?.documentId });
    case 'document:requested':
      return toPushPayload('Document Requested', data?.message || 'A healthcare provider requested a document from you.', 'document', eventName, { documentId: data?.documentId });
    case 'document:archived':
      return toPushPayload('Document Archived', data?.message || 'Your document was archived.', 'document', eventName, { documentId: data?.documentId });

    case 'updateTicket:statusChanged': {
      const status = data?.newStatus || 'Updated';
      const body = data?.message || `Your record update request has been ${String(status).toLowerCase()}.`;
      return toPushPayload(`Record Update ${status}`, body, 'record', eventName, { recordId: data?.recordId });
    }

    case 'staff:notification': {
      const parsed = parseAnnouncementMessage(data, 'Message from Staff');
      if (!parsed) return null;
      return toPushPayload(parsed.title, parsed.body, 'general', eventName);
    }

    case 'admin:notification': {
      const parsed = parseAnnouncementMessage(data, 'Message from Admin');
      if (!parsed) return null;
      return toPushPayload(parsed.title, parsed.body, 'general', eventName);
    }

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
 * @param {string} [channelId] - Android notification channel ID
 */
async function sendExpoPushNotification(pushToken, title, body, data = {}, userId = null, channelId = DEFAULT_CHANNEL_ID) {
  if (!Expo.isExpoPushToken(pushToken)) {
    logger.warn(`[PUSH] Invalid Expo push token: ${pushToken}`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    priority: 'high',
    data,
    channelId,
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
