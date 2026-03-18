const logger = require('../../utils/logger');
const { registerHandlers } = require('./socket-events');

/**
 * Health Chat Socket Events
 *
 * Client -> Server events:
 * - healthchat:join-room - Join a chat room
 * - healthchat:leave-room - Leave a chat room
 * - healthchat:typing - Notify typing status
 *
 * Server -> Client events (emitted from resolvers):
 * - healthchat:new-message - New message in chat
 * - healthchat:ticket-created - Patient created new ticket (to all staff)
 * - healthchat:ticket-approved - Staff approved ticket (to patient)
 * - healthchat:ticket-rejected - Staff rejected ticket (to patient)
 * - healthchat:ticket-closed - Ticket closed by patient or staff
 * - healthchat:user-typing - User is typing in chat
 */

const healthChatHandlers = {
  /**
   * Join a health chat room
   * Called when user opens a conversation
   */
  'healthchat:join-room': (socket, { chatId }, ack) => {
    if (!chatId) {
      logger.warn(`[HEALTHCHAT] Invalid join-room: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const room = `healthchat:${chatId}`;
    socket.join(room);
    logger.debug(`[HEALTHCHAT] user:${socket.userId} joined room ${room}`);

    if (typeof ack === 'function') {
      ack({ success: true, room });
    }
  },

  /**
   * Leave a health chat room
   * Called when user closes/navigates away from a conversation
   */
  'healthchat:leave-room': (socket, { chatId }, ack) => {
    if (!chatId) {
      logger.warn(`[HEALTHCHAT] Invalid leave-room: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const room = `healthchat:${chatId}`;
    socket.leave(room);
    logger.debug(`[HEALTHCHAT] user:${socket.userId} left room ${room}`);

    if (typeof ack === 'function') {
      ack({ success: true });
    }
  },

  /**
   * Broadcast typing status to other users in the chat room
   */
  'healthchat:typing': (socket, { chatId, isTyping }, ack) => {
    if (!chatId) {
      logger.warn(`[HEALTHCHAT] Invalid typing: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const room = `healthchat:${chatId}`;
    const userType = socket.userRole === 'patient' ? 'Patient' : 'Medical';

    // Emit to all other users in the room (exclude sender)
    socket.to(room).emit('healthchat:user-typing', {
      chatId,
      userId: socket.userId,
      userType,
      isTyping: Boolean(isTyping)
    });

    logger.debug(`[HEALTHCHAT] user:${socket.userId} typing=${isTyping} in room ${room}`);

    if (typeof ack === 'function') {
      ack({ success: true });
    }
  }
};

// Register handlers on module load
registerHandlers(healthChatHandlers);

logger.info('[HEALTHCHAT] Socket event handlers registered');

module.exports = { healthChatHandlers };
