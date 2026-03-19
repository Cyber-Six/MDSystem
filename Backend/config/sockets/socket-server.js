const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('../../utils/logger');
const { createAuthMiddleware } = require('./socket-auth');
const { trackConnection, untrackConnection } = require('./socket-store');
const { bindHandlersToSocket } = require('./socket-events');
const { flushPending } = require('./notification-store');
const { getClient } = require('../redis');

let io = null;

/**
 * Initialize Socket.IO and attach to an HTTP server.
 * Attaches a Redis adapter so events are fanned out across all server instances.
 * Safe to call multiple times — returns existing instance if already initialized.
 *
 * @param {import('http').Server} server - HTTP server from app.listen()
 * @param {Object} [options] - Additional Socket.IO server options
 * @returns {Promise<import('socket.io').Server>}
 */
async function initSocket(server, options = {}) {
  if (io) {
    logger.warn('[SOCKET] Socket.IO already initialized');
    return io;
  }

  const corsOrigin = process.env.SOCKET_CORS_ORIGIN || '*';
  const corsMethods = (
    process.env.SOCKET_CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE'
  ).split(',');

  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: corsMethods,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    ...options,
  });

  // --- Redis adapter (cross-node fan-out) ---
  // Two dedicated clients are required: one for publishing, one for subscribing.
  // They are duplicated from the main client to reuse the same connection config.
  try {
    const pubClient = getClient().duplicate();
    const subClient = getClient().duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[SOCKET] Redis adapter attached (cross-node fan-out enabled)');
  } catch (err) {
    logger.error('[SOCKET] Failed to attach Redis adapter:', err.message);
    throw err;
  }

  // Wire JWT authentication
  io.use(createAuthMiddleware());

  // Handle new connections
  io.on('connection', async (socket) => {
    const { userId, userRole } = socket;
    logger.info(`[SOCKET] Connected: ${socket.id} (user:${userId}, role:${userRole})`);

    // Track connection in-memory + Redis
    await trackConnection(userId, socket.id);

    // Auto-join rooms
    socket.join(`user:${userId}`);
    socket.join(`role:${userRole}`);

    // Bind registered event handlers from other modules
    bindHandlersToSocket(socket);

    // Confirm connection to client
    socket.emit('socket:connected', { socketId: socket.id });

    // Deliver any notifications that arrived while the user was offline
    const pending = await flushPending(userId);
    if (pending.length > 0) {
      logger.info(`[SOCKET] Delivering ${pending.length} pending notification(s) to user:${userId}`);
      for (const { event, data } of pending) {
        socket.emit(event, data);
      }
    }

    // Disconnect
    socket.on('disconnect', async (reason) => {
      logger.info(`[SOCKET] Disconnected: ${socket.id} (user:${userId}, reason:${reason})`);
      await untrackConnection(userId, socket.id);
    });

    // Error
    socket.on('error', (error) => {
      logger.error(`[SOCKET] Error on ${socket.id}:`, error.message);
    });
  });

  logger.info('[SOCKET] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO server instance.
 * Returns null if not yet initialized.
 *
 * @returns {import('socket.io').Server|null}
 */
function getIO() {
  if (!io) {
    logger.warn('[SOCKET] Socket.IO not initialized');
  }
  return io;
}

module.exports = { initSocket, getIO };
