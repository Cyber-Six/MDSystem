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
  const typingDebounceRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const processedMessageIds = useRef(new Set());
  const pollingIntervalRef = useRef(null);

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
        console.log('[HealthChatSocket Patient] Received user-typing event:', {
          chatId: data.chatId,
          userType: data.userType,
          isTyping: data.isTyping,
          expectedChatId: chatId,
          match: String(data.chatId) === String(chatId) && data.userType === 'Medical'
        });
        // Use String() coercion to handle potential type mismatch
        if (String(data.chatId) === String(chatId) && data.userType === 'Medical') {
          console.log('[HealthChatSocket Patient] Updating typing indicator:', data.isTyping);
          onTypingRef.current?.(data.isTyping);
        }
      });

      // Listen for ticket approval
      socketService.on('healthchat:ticket-approved', (data) => {
        console.log('[HealthChatSocket Patient] Received ticket-approved event:', {
          receivedChatId: data.chat?.id,
          expectedChatId: chatId,
          status: data.chat?.status,
          match: data.chat?.id === chatId || String(data.chat?.id) === String(chatId)
        });
        if (data.chat?.id === chatId || String(data.chat?.id) === String(chatId)) {
          console.log('[HealthChatSocket Patient] Calling onTicketApproved callback');
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
   * Emit typing status to server (OPTIMIZED with throttling and debouncing)
   * - Throttles typing events to max once every 2 seconds
   * - Debounces stop-typing by 500ms to batch rapid key presses
   * - Automatically stops typing after 3 seconds of inactivity
   */
  const emitTyping = useCallback((isTyping) => {
    if (!socketRef.current?.isConnected() || !chatId) return;

    const now = Date.now();
    const THROTTLE_MS = 2000; // Max one typing event every 2 seconds
    const DEBOUNCE_STOP_MS = 500; // Wait 500ms before sending stop-typing

    // Clear existing timeouts
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTyping) {
      // Throttle: Only emit if enough time has passed since last emit
      const timeSinceLastEmit = now - lastTypingEmitRef.current;
      if (timeSinceLastEmit < THROTTLE_MS) {
        console.log('[HealthChatSocket Patient] Throttling typing event (too soon)');
        // Still set auto-stop timeout even if throttled
        typingTimeoutRef.current = setTimeout(() => {
          if (socketRef.current?.isConnected()) {
            socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
            lastTypingEmitRef.current = 0;
          }
        }, 3000);
        return;
      }

      // Emit typing=true
      lastTypingEmitRef.current = now;
      socketRef.current.emit('healthchat:typing', { chatId, isTyping: true });

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current?.isConnected()) {
          socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
          lastTypingEmitRef.current = 0;
        }
      }, 3000);
    } else {
      // Debounce stop-typing to avoid rapid on/off events
      typingDebounceRef.current = setTimeout(() => {
        if (socketRef.current?.isConnected()) {
          socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
          lastTypingEmitRef.current = 0;
        }
      }, DEBOUNCE_STOP_MS);
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
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);

  /**
   * 3-minute polling fallback for message updates
   * Runs independently of socket status to ensure messages are never missed
   * Even if sockets fail, polling will fetch new messages
   */
  useEffect(() => {
    if (!chatId || !shouldConnect) {
      // Clear polling if no active chat
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const POLLING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

    const pollForNewMessages = async () => {
      try {
        console.log('[HealthChatSocket Patient] Polling for new messages in chat:', chatId);
        // Import getTicketMessages dynamically to avoid circular deps
        const { getTicketMessages } = await import('../health-chat-service');

        // Fetch recent messages (last 10)
        const messages = await getTicketMessages(chatId, 0, 10);

        // Check if any messages are new (not in processedMessageIds)
        // Only process Medical (staff) messages since we only care about incoming
        const newMessages = messages.filter(msg => {
          const messageId = String(msg.id);
          const isFromStaff = msg.userType === 'Medical';
          const notProcessed = !processedMessageIds.current.has(messageId);
          return isFromStaff && notProcessed;
        });

        if (newMessages.length > 0) {
          console.log(`[HealthChatSocket Patient] Polling found ${newMessages.length} new message(s)`);
          // Add each new message to the UI + mark as processed
          newMessages.forEach(msg => {
            const messageId = String(msg.id);
            processedMessageIds.current.add(messageId);
            // Keep Set size bounded
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              processedMessageIds.current.delete(firstKey);
            }
            onNewMessageRef.current?.(msg);
          });
        } else {
          console.log('[HealthChatSocket Patient] Polling: no new messages');
        }
      } catch (error) {
        console.error('[HealthChatSocket Patient] Polling error:', error);
      }
    };

    // Start polling interval
    pollingIntervalRef.current = setInterval(pollForNewMessages, POLLING_INTERVAL_MS);

    // Cleanup interval on unmount or chatId change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [chatId, shouldConnect]);

  return {
    isConnected,
    socketError,
    emitTyping,
    disconnect
  };
}
