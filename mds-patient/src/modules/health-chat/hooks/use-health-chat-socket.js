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

  // Use a ref for chatId in event handlers to avoid stale closures
  const chatIdRef = useRef(chatId);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Connect socket once when shouldConnect becomes true, disconnect when false
  useEffect(() => {
    if (!shouldConnect) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Already connected - nothing to do
    if (socketRef.current?.isConnected()) return;

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

    socketService.connect().then(() => {
      socketRef.current = socketService;
      setIsConnected(true);
      setSocketError(false);

      // Handle reconnection, rejoin current room
      socketService.getSocket()?.on('reconnect', () => {
        if (chatIdRef.current) {
          socketService.emit('healthchat:join-room', { chatId: chatIdRef.current });
        }
      });

      // Listen for new messages (with deduplication) - uses ref for chatId
      socketService.on('healthchat:new-message', (data) => {
        if (String(data.chatId) === String(chatIdRef.current) && data.senderType === 'Medical') {
          const messageId = String(data.message?.id);
          if (messageId && processedMessageIds.current.has(messageId)) {
            return;
          }
          if (messageId) {
            processedMessageIds.current.add(messageId);
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
        if (String(data.chatId) === String(chatIdRef.current) && data.userType === 'Medical') {
          onTypingRef.current?.(data.isTyping);
        }
      });

      // Listen for ticket approval
      socketService.on('healthchat:ticket-approved', (data) => {
        if (String(data.chat?.id) === String(chatIdRef.current)) {
          onTicketApprovedRef.current?.(data.chat);
        }
      });

      // Listen for ticket closed
      socketService.on('healthchat:ticket-closed', (data) => {
        if (String(data.chatId) === String(chatIdRef.current)) {
          onTicketClosedRef.current?.(data);
        }
      });

      // Listen for ticket rejection
      socketService.on('healthchat:ticket-rejected', (data) => {
        if (String(data.chat?.id) === String(chatIdRef.current)) {
          onTicketClosedRef.current?.(data);
        }
      });

      // Join room for current chatId
      if (chatIdRef.current) {
        socketService.emit('healthchat:join-room', { chatId: chatIdRef.current });
      }
    }).catch((err) => {
      console.error('[HealthChatSocket] Connection failed:', err.message);
      setIsConnected(false);
      setSocketError(true);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      processedMessageIds.current.clear();
    };
  }, [shouldConnect]);

  // Manage room join/leave when chatId changes (reuses existing connection)
  useEffect(() => {
    if (!socketRef.current?.isConnected() || !chatId) return;

    socketRef.current.emit('healthchat:join-room', { chatId });

    return () => {
      if (socketRef.current?.isConnected()) {
        socketRef.current.emit('healthchat:leave-room', { chatId });
      }
    };
  }, [chatId, isConnected]);

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
