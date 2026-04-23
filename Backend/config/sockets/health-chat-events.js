const logger = require('../../utils/logger');
const { registerHandlers } = require('./socket-events');
const { isMedicalAdmin } = require('../../services/permit');
const {
  verifyPatientOwnsChat,
  verifyMedicalAssignedToChat,
} = require('../../routes/health-chat/resolvers/wrapper/helper.js');

function parseChatId(rawChatId) {
  const chatId = Number(rawChatId);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) {
    return null;
  }
  return chatId;
}

function getAuthorizedChats(socket) {
  if (!socket.data) {
    socket.data = {};
  }
  if (!(socket.data.authorizedHealthChats instanceof Set)) {
    socket.data.authorizedHealthChats = new Set();
  }
  return socket.data.authorizedHealthChats;
}

async function canAccessChat(socket, chatId) {
  const userId = Number(socket.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;

  if (socket.userRole === 'patient') {
    return verifyPatientOwnsChat(chatId, userId);
  }

  if (socket.userRole === 'medical') {
    const admin = await isMedicalAdmin(userId);
    if (admin) return true;
    return verifyMedicalAssignedToChat(chatId, userId);
  }

  return false;
}

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
  'healthchat:join-room': async (socket, { chatId }, ack) => {
    const parsedChatId = parseChatId(chatId);
    if (!parsedChatId) {
      logger.warn(`[HEALTHCHAT] Invalid join-room: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const canAccess = await canAccessChat(socket, parsedChatId);
    if (!canAccess) {
      logger.warn(`[HEALTHCHAT] Access denied join-room chatId=${parsedChatId} user:${socket.userId} role:${socket.userRole}`);
      if (typeof ack === 'function') {
        ack({ error: 'ACCESS_DENIED', message: 'You are not authorized to access this chat.' });
      }
      return;
    }

    const room = `healthchat:${parsedChatId}`;
    socket.join(room);
    getAuthorizedChats(socket).add(parsedChatId);
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
    const parsedChatId = parseChatId(chatId);
    if (!parsedChatId) {
      logger.warn(`[HEALTHCHAT] Invalid leave-room: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const room = `healthchat:${parsedChatId}`;
    socket.leave(room);
    getAuthorizedChats(socket).delete(parsedChatId);
    logger.debug(`[HEALTHCHAT] user:${socket.userId} left room ${room}`);

    if (typeof ack === 'function') {
      ack({ success: true });
    }
  },

  /**
   * Broadcast typing status to other users in the chat room
   */
  'healthchat:typing': async (socket, { chatId, isTyping }, ack) => {
    const parsedChatId = parseChatId(chatId);
    if (!parsedChatId) {
      logger.warn(`[HEALTHCHAT] Invalid typing: no chatId from user:${socket.userId}`);
      if (typeof ack === 'function') {
        ack({ error: 'INVALID_PARAMS', message: 'chatId is required' });
      }
      return;
    }

    const authorizedChats = getAuthorizedChats(socket);
    let canAccess = authorizedChats.has(parsedChatId);
    if (!canAccess) {
      canAccess = await canAccessChat(socket, parsedChatId);
      if (canAccess) {
        authorizedChats.add(parsedChatId);
      }
    }

    if (!canAccess) {
      logger.warn(`[HEALTHCHAT] Access denied typing chatId=${parsedChatId} user:${socket.userId} role:${socket.userRole}`);
      if (typeof ack === 'function') {
        ack({ error: 'ACCESS_DENIED', message: 'You are not authorized to access this chat.' });
      }
      return;
    }

    const room = `healthchat:${parsedChatId}`;
    const userType = socket.userRole === 'patient' ? 'Patient' : 'Medical';

    // Emit to all other users in the room (exclude sender)
    socket.to(room).emit('healthchat:user-typing', {
      chatId: parsedChatId,
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
