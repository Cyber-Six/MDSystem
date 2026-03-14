/**
 * Socket Module - Public API
 *
 * Usage:
 *
 *   // In server.js / staff.js (initialization):
 *   const { initSocket } = require('./config/sockets');
 *   const server = app.listen(PORT);
 *   initSocket(server);
 *
 *   // In any route handler / resolver (emitting events):
 *   const { emitToUser, emitToAll } = require('../config/sockets');
 *   emitToUser(userId, 'appointment:updated', { status: 'approved' });
 *
 *   // In a module that handles client-to-server events:
 *   const { registerHandlers } = require('../config/sockets');
 *   registerHandlers({
 *     'chat:message': (socket, data) => { ... },
 *   });
 */

const { initSocket, getIO } = require('./socket-server');
const { emitToUser, emitToUsers, emitToAll, emitToRoom, emitToRole } = require('./socket-emitter');
const { isConnected, getSocketIds, getConnectedCount } = require('./socket-store');
const { registerHandler, registerHandlers, getRegisteredEvents } = require('./socket-events');

module.exports = {
  // Initialization (server.js / staff.js)
  initSocket,
  getIO,

  // Emission (primary API for backend modules)
  emitToUser,
  emitToUsers,
  emitToAll,
  emitToRoom,
  emitToRole,

  // Connection queries
  isConnected,
  getSocketIds,
  getConnectedCount,

  // Event registration (for client-to-server event handlers)
  registerHandler,
  registerHandlers,
  getRegisteredEvents,
};
