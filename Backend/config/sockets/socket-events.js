const logger = require('../../utils/logger');

// Registry: eventName -> handler(socket, data, ackCallback)
const registry = new Map();

/**
 * Register a handler for a socket event.
 * Call this before initSocket() during server startup.
 *
 * @param {string} eventName - Socket event name
 * @param {Function} handler - fn(socket, data, ackCallback)
 */
function registerHandler(eventName, handler) {
  if (typeof handler !== 'function') {
    throw new Error(`[SOCKET_EVENTS] Handler for "${eventName}" must be a function`);
  }
  if (registry.has(eventName)) {
    logger.warn(`[SOCKET_EVENTS] Overwriting handler for: ${eventName}`);
  }
  registry.set(eventName, handler);
  logger.info(`[SOCKET_EVENTS] Registered: ${eventName}`);
}

/**
 * Register multiple handlers at once.
 *
 * @param {Object} handlers - { eventName: handler, ... }
 *
 * @example
 * registerHandlers({
 *   'appointment:join-room': (socket, { appointmentId }) => {
 *     socket.join(`appointment:${appointmentId}`);
 *   },
 * });
 */
function registerHandlers(handlers) {
  for (const [eventName, handler] of Object.entries(handlers)) {
    registerHandler(eventName, handler);
  }
}

/**
 * Bind all registered event handlers to a socket.
 * Called internally by socket-server.js on each new connection.
 *
 * @param {import('socket.io').Socket} socket
 */
function bindHandlersToSocket(socket) {
  for (const [eventName, handler] of registry) {
    socket.on(eventName, async (data, callback) => {
      try {
        await handler(socket, data, callback);
      } catch (err) {
        logger.error(`[SOCKET_EVENTS] Error in "${eventName}":`, err);
        if (typeof callback === 'function') {
          callback({ error: 'INTERNAL_ERROR', message: err.message });
        }
      }
    });
  }
}

/**
 * Get list of registered event names (for debugging)
 * @returns {string[]}
 */
function getRegisteredEvents() {
  return Array.from(registry.keys());
}

module.exports = {
  registerHandler,
  registerHandlers,
  bindHandlersToSocket,
  getRegisteredEvents,
};
