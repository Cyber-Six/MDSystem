const redis = require('../redis');
const logger = require('../../utils/logger');

// In-memory layer: userId (string) -> Set<socketId>
const connectedUsers = new Map();

// --- Local (in-memory) helpers ---

function addLocal(userId, socketId) {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socketId);
}

function removeLocal(userId, socketId) {
  const sockets = connectedUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    connectedUsers.delete(userId);
  }
}

// --- Redis (cross-process) helpers ---

async function addRedis(userId, socketId) {
  try {
    const key = `socket:user:${userId}`;
    const ttl = Number(process.env.SOCKET_SESSION_TTL) || 3600;
    await redis.sAddKey(key, socketId, ttl);
  } catch (error) {
    logger.error('[SOCKET_STORE] Redis add failed:', error.message);
  }
}

async function removeRedis(userId, socketId) {
  try {
    const key = `socket:user:${userId}`;
    await redis.sRemKey(key, socketId);
    const remaining = await redis.sCardKey(key);
    if (remaining === 0) {
      await redis.delKey(key);
    }
  } catch (error) {
    logger.error('[SOCKET_STORE] Redis remove failed:', error.message);
  }
}

// --- Public API ---

/**
 * Track a new socket connection for a user
 * @param {string} userId
 * @param {string} socketId
 */
async function trackConnection(userId, socketId) {
  addLocal(userId, socketId);
  await addRedis(userId, socketId);
}

/**
 * Untrack a socket connection for a user
 * @param {string} userId
 * @param {string} socketId
 */
async function untrackConnection(userId, socketId) {
  removeLocal(userId, socketId);
  await removeRedis(userId, socketId);
}

/**
 * Check if a user has any active connections (in-memory, fast)
 * @param {string} userId
 * @returns {boolean}
 */
function isConnected(userId) {
  return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
}

/**
 * Get all socket IDs for a user (in-memory, fast)
 * @param {string} userId
 * @returns {string[]}
 */
function getSocketIds(userId) {
  const sockets = connectedUsers.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/**
 * Get total number of connected users
 * @returns {number}
 */
function getConnectedCount() {
  return connectedUsers.size;
}

module.exports = {
  trackConnection,
  untrackConnection,
  isConnected,
  getSocketIds,
  getConnectedCount,
};
