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
  const [socketError, setSocketError] = useState(false);
  const typingTimeoutRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  // Use refs for callbacks to avoid stale closures in socket event listeners
  // This ensures event handlers always call the latest callback version
  const onNewMessageRef = useRef(onNewMessage);
  const onTypingRef = useRef(onTyping);
  const onTicketApprovedRef = useRef(onTicketApproved);
  const onTicketClosedRef = useRef(onTicketClosed);

  // Keep refs up to date with latest callbacks
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onTypingRef.current = onTyping;
    onTicketApprovedRef.current = onTicketApproved;
    onTicketClosedRef.current = onTicketClosed;
  }, [onNewMessage, onTyping, onTicketApproved, onTicketClosed]);

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

    // Create socket service with reconnection options
    const socketService = createSocketService({
      getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
      getToken: () => tokenService.TokenStorage.getAccessToken(),
      onAuthError: async () => {
        await tokenService.refreshAccessToken();
      },
      options: {
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
        timeout: 10000,
      }
    });

    // Connect and setup
    socketService.connect().then(() => {
      socketRef.current = socketService;
      setIsConnected(true);
      setSocketError(false);

      // Join the chat room
      socketService.emit('healthchat:join-room', { chatId });

      // Handle reconnection - rejoin room
      socketService.getSocket()?.on('reconnect', () => {
        console.log('[HealthChatSocket] Reconnected, rejoining room:', chatId);
        socketService.emit('healthchat:join-room', { chatId });
      });

      // Listen for new messages (with deduplication)
      socketService.on('healthchat:new-message', (data) => {
        // Use String() coercion to handle potential type mismatch (string vs number)
        if (String(data.chatId) === String(chatId) && data.senderType === 'Medical') {
          // Deduplicate messages by ID
          const messageId = String(data.message?.id);
          if (messageId && processedMessageIds.current.has(messageId)) {
            console.log('[HealthChatSocket] Duplicate message ignored:', messageId);
            return;
          }
          if (messageId) {
            processedMessageIds.current.add(messageId);
            // Keep Set size bounded - remove old entries
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              processedMessageIds.current.delete(firstKey);
            }
          }
          onNewMessageRef.current?.(data.message);
        }
      });

      // Listen for typing indicators
      socketService.on('healthchat:user-typing', (data) => {
        // Use String() coercion to handle potential type mismatch
        if (String(data.chatId) === String(chatId) && data.userType === 'Medical') {
          onTypingRef.current?.(data.isTyping);
        }
      });

      // Listen for ticket approval
      socketService.on('healthchat:ticket-approved', (data) => {
        if (data.chat?.id === chatId || String(data.chat?.id) === String(chatId)) {
          onTicketApprovedRef.current?.(data.chat);
        }
      });

      // Listen for ticket closed
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId === chatId || String(data.chatId) === String(chatId)) {
          onTicketClosedRef.current?.(data);
        }
      });

      // Listen for ticket rejection
      socketService.on('healthchat:ticket-rejected', (data) => {
        if (data.chat?.id === chatId || String(data.chat?.id) === String(chatId)) {
          onTicketClosedRef.current?.(data);
        }
      });
    }).catch((err) => {
      console.error('[HealthChatSocket] Connection failed:', err);
      console.error('[HealthChatSocket] Details:', err.message);
      setIsConnected(false);
      setSocketError(true);
      // Note: Socket.io client will auto-retry based on reconnectionAttempts
      // Users can still use HTTP requests to fetch messages
    });

    // Cleanup on unmount or when chatId changes
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('healthchat:leave-room', { chatId });
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      processedMessageIds.current.clear();
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
    socketError,
    emitTyping,
    disconnect
  };
}
