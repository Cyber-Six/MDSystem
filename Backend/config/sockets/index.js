/**
 * Socket Module - Public API
 *
 * Usage:
 *
 *   // In server.js / staff.js (initialization):
 *   const { initSocket } = require('./config/sockets');
 *   const server = app.listen(PORT);
 *   await initSocket(server);   // async — attaches Redis adapter
 *
 *   // Emit only to ACTIVE users (no persistence):
 *   const { emitToUser } = require('../config/sockets');
 *   emitToUser(userId, 'appointment:updated', { status: 'approved' });
 *
 *   // Notify a user — delivered now if online, queued for next login if offline:
 *   const { notifyUser } = require('../config/sockets');
 *   await notifyUser(userId, 'appointment:updated', { status: 'approved' });
 *
 *   // Cross-node presence check (works in workers / other processes):
 *   const { isConnectedAnywhere } = require('../config/sockets');
 *   if (await isConnectedAnywhere(userId)) { ... }
 *
 *   // In a module that handles client-to-server events:
 *   const { registerHandlers } = require('../config/sockets');
 *   registerHandlers({
 *     'chat:message': (socket, data) => { ... },
 *   });
 */

const { initSocket, getIO } = require('./socket-server');
const { emitToUser, emitToUsers, emitToAll, emitToRoom, emitToRole, notifyUser, notifyUsers } = require('./socket-emitter');
const { isConnected, getSocketIds, getConnectedCount, isConnectedAnywhere } = require('./socket-store');
const { registerHandler, registerHandlers, getRegisteredEvents } = require('./socket-events');
const { getPendingCount } = require('./notification-store');

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

  // Notification system (online → emit, offline → queue + deliver on reconnect)
  notifyUser,
  notifyUsers,
  getPendingCount,

  // Connection queries
  isConnected,
  isConnectedAnywhere,
  getSocketIds,
  getConnectedCount,

  // Event registration (for client-to-server event handlers)
  registerHandler,
  registerHandlers,
  getRegisteredEvents,
};
