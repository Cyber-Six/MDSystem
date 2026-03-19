/**
 * Health Chat Socket Hook - Patient Side
 *
 * Manages WebSocket connection for real-time health chat features:
 * - New message notifications
 * - Typing indicators
 * - Ticket status changes (approved, closed)
 *
 * Implements optimized connection management:
 * - Only connects when chat is active (Ongoing status)
 * - Disconnects when chat is closed/frozen
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../../packages-core-adapter';

/**
 * @param {Object} options
 * @param {string|null} options.chatId - The current chat ID (null if no active chat)
 * @param {string} options.chatStatus - Current chat status (Open, Ongoing, Closed, Expired)
 * @param {Function} options.onNewMessage - Called when a new message arrives
 * @param {Function} options.onTyping - Called when staff typing status changes
 * @param {Function} options.onTicketApproved - Called when ticket is approved
 * @param {Function} options.onTicketClosed - Called when ticket is closed
 */
export function useHealthChatSocket({
  chatId,
  chatStatus,
  onNewMessage,
  onTyping,
  onTicketApproved,
  onTicketClosed
}) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Determine if we should be connected
  // Only connect when chat is active (Ongoing) or pending (Open)
  const shouldConnect = chatId && ['Open', 'Ongoing'].includes(chatStatus);

  // Connect and setup listeners
  useEffect(() => {
    if (!shouldConnect) {
      // Disconnect if we shouldn't be connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket service
    const socketService = createSocketService({
      getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
      getToken: () => tokenService.TokenStorage.getAccessToken(),
      onAuthError: async () => {
        await tokenService.refreshAccessToken();
      }
    });

    // Connect and setup
    socketService.connect().then(() => {
      socketRef.current = socketService;
      setIsConnected(true);

      // Join the chat room
      socketService.emit('healthchat:join-room', { chatId });

      // Listen for new messages
      socketService.on('healthchat:new-message', (data) => {
        if (data.chatId === chatId && data.senderType === 'Medical') {
          onNewMessage?.(data.message);
        }
      });

      // Listen for typing indicators
      socketService.on('healthchat:user-typing', (data) => {
        if (data.chatId === chatId && data.userType === 'Medical') {
          onTyping?.(data.isTyping);
        }
      });

      // Listen for ticket approval
      socketService.on('healthchat:ticket-approved', (data) => {
        if (data.chat?.id === chatId || String(data.chat?.id) === String(chatId)) {
          onTicketApproved?.(data.chat);
        }
      });

      // Listen for ticket closed
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId === chatId || String(data.chatId) === String(chatId)) {
          onTicketClosed?.(data);
        }
      });

      // Listen for ticket rejection
      socketService.on('healthchat:ticket-rejected', (data) => {
        if (data.chat?.id === chatId || String(data.chat?.id) === String(chatId)) {
          onTicketClosed?.(data);
        }
      });
    }).catch((err) => {
      console.error('[HealthChatSocket] Connection failed:', err);
      setIsConnected(false);
    });

    // Cleanup on unmount or when chatId changes
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('healthchat:leave-room', { chatId });
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [chatId, shouldConnect]);

  /**
   * Emit typing status to server
   * Automatically stops typing after 3 seconds of inactivity
   */
  const emitTyping = useCallback((isTyping) => {
    if (!socketRef.current?.isConnected() || !chatId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    socketRef.current.emit('healthchat:typing', { chatId, isTyping });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current?.isConnected()) {
          socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
        }
      }, 3000);
    }
  }, [chatId]);

  /**
   * Manually disconnect socket
   * Use when navigating away from chat
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    emitTyping,
    disconnect
  };
}
