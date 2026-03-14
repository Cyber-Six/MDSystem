const { Server } = require('socket.io');
const logger = require('../../utils/logger');
const { createAuthMiddleware } = require('./socket-auth');
const { trackConnection, untrackConnection } = require('./socket-store');
const { bindHandlersToSocket } = require('./socket-events');

let io = null;

/**
 * Initialize Socket.IO and attach to an HTTP server.
 * Safe to call multiple times — returns existing instance if already initialized.
 *
 * @param {import('http').Server} server - HTTP server from app.listen()
 * @param {Object} [options] - Additional Socket.IO server options
 * @returns {import('socket.io').Server}
 */
function initSocket(server, options = {}) {
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
