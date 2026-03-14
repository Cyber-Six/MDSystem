const logger = require('../../utils/logger');

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

module.exports = {
  emitToUser,
  emitToUsers,
  emitToAll,
  emitToRoom,
  emitToRole,
};
