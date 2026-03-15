const logger = require('../../utils/logger');
const { isConnectedAnywhere } = require('./socket-store');
const { pushPending } = require('./notification-store');
const { enqueueNotificationEmail } = require('../../services/emailservice');

// Lazy-loaded to avoid circular dependency with socket-server.js
let _getIO;
function getIO() {
  if (!_getIO) {
    _getIO = require('./socket-server').getIO;
  }
  return _getIO();
}

/**
 * Emit an event to a specific user (all their connected sockets).
 *
 * @param {string} userId
 * @param {string} eventName
 * @param {*} data
 * @returns {boolean} true if emitted, false if socket not initialized
 */
function emitToUser(userId, eventName, data) {
  const io = getIO();
  if (!io) {
    logger.warn(`[SOCKET_EMIT] Not initialized, dropping: ${eventName} -> user:${userId}`);
    return false;
  }
  io.to(`user:${userId}`).emit(eventName, data);
  logger.debug(`[SOCKET_EMIT] ${eventName} -> user:${userId}`);
  return true;
}

/**
 * Emit an event to multiple users.
 *
 * @param {string[]} userIds
 * @param {string} eventName
 * @param {*} data
 * @returns {boolean}
 */
function emitToUsers(userIds, eventName, data) {
  const io = getIO();
  if (!io) {
    logger.warn(`[SOCKET_EMIT] Not initialized, dropping: ${eventName} -> ${userIds.length} users`);
    return false;
  }
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(eventName, data);
  }
  logger.debug(`[SOCKET_EMIT] ${eventName} -> ${userIds.length} users`);
  return true;
}

/**
 * Broadcast an event to all connected clients.
 *
 * @param {string} eventName
 * @param {*} data
 * @returns {boolean}
 */
function emitToAll(eventName, data) {
  const io = getIO();
  if (!io) {
    logger.warn(`[SOCKET_EMIT] Not initialized, dropping broadcast: ${eventName}`);
    return false;
  }
  io.emit(eventName, data);
  logger.debug(`[SOCKET_EMIT] ${eventName} -> broadcast`);
  return true;
}

/**
 * Emit an event to a specific Socket.IO room.
 *
 * @param {string} room - Room name
 * @param {string} eventName
 * @param {*} data
 * @returns {boolean}
 */
function emitToRoom(room, eventName, data) {
  const io = getIO();
  if (!io) {
    logger.warn(`[SOCKET_EMIT] Not initialized, dropping: ${eventName} -> room:${room}`);
    return false;
  }
  io.to(room).emit(eventName, data);
  logger.debug(`[SOCKET_EMIT] ${eventName} -> room:${room}`);
  return true;
}

/**
 * Emit an event to all users with a specific role.
 * Uses the role-based room that socket-server.js auto-joins on connection.
 *
 * @param {string} role - 'patient' or 'medical'
 * @param {string} eventName
 * @param {*} data
 * @returns {boolean}
 */
function emitToRole(role, eventName, data) {
  return emitToRoom(`role:${role}`, eventName, data);
}

/**
 * Deliver an event to a user if they are currently connected (on any cluster node).
 * If they are offline, the notification is persisted in Redis and will be delivered
 * automatically the next time they connect.
 *
 * Optionally, pass `emailNotif` to also send an email when the user is offline.
 * The email is enqueued via BullMQ and rendered with the generic notification template.
 *
 * This is the preferred API for any notification that must not be lost.
 *
 * @param {string} userId
 * @param {string} eventName
 * @param {*}      data
 * @param {{ email: string, title: string, message: string, notes?: string, ctaText?: string, ctaLink?: string } | null} [emailNotif]
 * @returns {Promise<'delivered'|'queued'>}
 */
async function notifyUser(userId, eventName, data, emailNotif = null) {
  const online = await isConnectedAnywhere(userId);
  if (online) {
    emitToUser(userId, eventName, data);
    logger.debug(`[NOTIF] Delivered "${eventName}" to active user:${userId}`);
    return 'delivered';
  }
  await pushPending(userId, eventName, data);
  logger.debug(`[NOTIF] Queued "${eventName}" for offline user:${userId}`);
  if (emailNotif && emailNotif.email) {
    try {
      await enqueueNotificationEmail(
        emailNotif.email,
        emailNotif.title,
        emailNotif.message,
        emailNotif.notes ?? null,
        emailNotif.ctaText ?? null,
        emailNotif.ctaLink ?? null,
      );
      logger.debug(`[NOTIF] Enqueued offline email notification for user:${userId}`);
    } catch (err) {
      logger.error(`[NOTIF] Failed to enqueue offline email for user:${userId}: ${err.message}`);
    }
  }
  return 'queued';
}

/**
 * Deliver an event to multiple users, queuing for any that are offline.
 *
 * @param {string[]} userIds
 * @param {string}   eventName
 * @param {*}        data
 * @returns {Promise<{ delivered: string[], queued: string[] }>}
 */
async function notifyUsers(userIds, eventName, data) {
  const results = await Promise.all(
    userIds.map(async (userId) => ({ userId, result: await notifyUser(userId, eventName, data) }))
  );
  return results.reduce(
    (acc, { userId, result }) => {
      acc[result].push(userId);
      return acc;
    },
    { delivered: [], queued: [] }
  );
}

module.exports = {
  emitToUser,
  emitToUsers,
  emitToAll,
  emitToRoom,
  emitToRole,
  notifyUser,
  notifyUsers,
};
