/**
 * Health Chat Socket Hook - Staff Side
 *
 * Manages WebSocket connection for real-time health chat features:
 * - New message notifications
 * - Typing indicators
 * - New ticket notifications
 * - Ticket status changes
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../../packages-core-adapter';
import { useHealthChat } from '../context/health-chat-context';

/**
 * Hook for staff health chat socket connection
 */
export function useHealthChatSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const joinedRoomsRef = useRef(new Set());
  const processedMessageIds = useRef(new Set());
  const closedChatIds = useRef(new Set());
  const pollingIntervalRef = useRef(null);
  const lastMessageCheckRef = useRef(null);

  const {
    selectedChatId,
    selectedTicket,
    addMessage,
    addTicket,
    updateTicketStatus,
    removeTicket,
    setUserTyping,
    refreshTickets,
    setSocketError,
    filter
  } = useHealthChat();

  // Use refs for ALL callbacks to avoid socket reconnection on dependency changes
  // This is critical to prevent duplicate event listeners
  const addMessageRef = useRef(addMessage);
  const addTicketRef = useRef(addTicket);
  const updateTicketStatusRef = useRef(updateTicketStatus);
  const setUserTypingRef = useRef(setUserTyping);
  const setSocketErrorRef = useRef(setSocketError);
  const refreshTicketsRef = useRef(refreshTickets);
  const removeTicketRef = useRef(removeTicket);
  const filterRef = useRef(filter);

  // Keep refs up to date
  useEffect(() => {
    addMessageRef.current = addMessage;
    addTicketRef.current = addTicket;
    updateTicketStatusRef.current = updateTicketStatus;
    setUserTypingRef.current = setUserTyping;
    setSocketErrorRef.current = setSocketError;
    refreshTicketsRef.current = refreshTickets;
    removeTicketRef.current = removeTicket;
    filterRef.current = filter;
  }, [addMessage, addTicket, updateTicketStatus, setUserTyping, setSocketError, refreshTickets, removeTicket, filter]);

  // Check if selected chat is archived (should not receive typing events)
  const isArchived = selectedTicket && ['Closed', 'Expired'].includes(selectedTicket.status);

  // Connect on mount only - use empty dependency array to prevent reconnection
  useEffect(() => {
    console.log('[HealthChatSocket Staff] 🔵 Initializing socket connection');
    let isMounted = true;

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
      }
    });

    socketService.connect().then(() => {
      // Check if component is still mounted before setting state
      if (!isMounted) {
        socketService.disconnect();
        return;
      }

      console.log('[HealthChatSocket Staff] ✅ Socket connected, setting up listeners');
      socketRef.current = socketService;
      setIsConnected(true);
      setSocketErrorRef.current(false);

      // Handle reconnection - rejoin all tracked rooms
      socketService.getSocket()?.on('reconnect', () => {
        console.log('[HealthChatSocket Staff] Reconnected, rejoining rooms');
        joinedRoomsRef.current.forEach(roomId => {
          socketService.emit('healthchat:join-room', { chatId: roomId });
        });
      });

      // Listen for new ticket created by patient
      socketService.on('healthchat:ticket-created', (data) => {
        if (data.chat) {
          addTicketRef.current(data.chat);
        }
      });

      // Listen for new messages (in any room we're in) with deduplication
      socketService.on('healthchat:new-message', (data) => {
        console.log('[HealthChatSocket Staff] Received new-message event:', {
          chatId: data.chatId,
          messageId: data.message?.id,
          senderType: data.senderType,
          setSize: processedMessageIds.current.size
        });

        // Handle both Patient and Medical messages
        if (data.chatId && data.message && (data.senderType === 'Patient' || data.senderType === 'Medical')) {
          // Deduplicate messages by ID
          const messageId = String(data.message?.id);
          if (messageId && processedMessageIds.current.has(messageId)) {
            console.log('[HealthChatSocket Staff] ⚠️ DUPLICATE message ignored:', messageId);
            return;
          }
          if (messageId) {
            processedMessageIds.current.add(messageId);
            console.log('[HealthChatSocket Staff] ✅ Adding message:', messageId, 'Set size:', processedMessageIds.current.size);
            // Keep Set size bounded - remove old entries
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              processedMessageIds.current.delete(firstKey);
            }
          }
          addMessageRef.current(data.chatId, data.message);
        }
      });

      // Listen for typing indicators (ignore closed chats)
      socketService.on('healthchat:user-typing', (data) => {
        if (data.chatId && data.userType === 'Patient') {
          // Ignore typing events for closed chats
          if (closedChatIds.current.has(String(data.chatId))) {
            console.log('[HealthChatSocket Staff] Ignoring typing for closed chat:', data.chatId);
            return;
          }
          setUserTypingRef.current(data.chatId, data.userId, data.isTyping);
        }
      });

      // Listen for ticket closed by patient
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId && data.closedBy === 'Patient') {
          // Track this chat as closed to ignore future typing events
          closedChatIds.current.add(String(data.chatId));
          updateTicketStatusRef.current(data.chatId, 'Closed');
          // Clear typing indicator when chat is closed
          setUserTypingRef.current(data.chatId, null, false);
        }
      });

      // Listen for ticket status changes by other staff (approve/reject)
      socketService.on('healthchat:ticket-status-changed', (data) => {
        if (data.chatId && data.status) {
          // If ticket was approved (now Ongoing) and we're viewing pending, remove it
          if (data.status === 'Ongoing' && filterRef.current === 'pending') {
            removeTicketRef.current(data.chatId);
          } else {
            // Otherwise refresh to get updated data
            refreshTicketsRef.current();
          }
        }
      });
    }).catch((err) => {
      if (!isMounted) return;
      console.error('[HealthChatSocket] Connection failed:', err);
      console.error('[HealthChatSocket] Details:', err.message);
      setIsConnected(false);
      setSocketErrorRef.current(true);
    });

    // Cleanup on unmount only
    return () => {
      isMounted = false;
      if (socketRef.current) {
        // Leave all joined rooms
        joinedRoomsRef.current.forEach(roomId => {
          socketRef.current.emit('healthchat:leave-room', { chatId: roomId });
        });
        joinedRoomsRef.current.clear();
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      processedMessageIds.current.clear();
      closedChatIds.current.clear();
    };
  }, []); // Empty dependency array - connect only once on mount

  // Join room when chat is selected (but NOT for archived chats)
  // Note: Must depend on both isConnected AND selectedChatId to handle the race condition
  // where socket connects AFTER a chat is already selected
  useEffect(() => {
    if (!socketRef.current?.isConnected() || !selectedChatId) return;

    // Leave previous room if different
    joinedRoomsRef.current.forEach(roomId => {
      if (roomId !== selectedChatId) {
        socketRef.current.emit('healthchat:leave-room', { chatId: roomId });
        joinedRoomsRef.current.delete(roomId);
      }
    });

    // Don't join room for archived chats - no need for real-time updates
    if (isArchived) {
      // If we had joined this room before, leave it
      if (joinedRoomsRef.current.has(selectedChatId)) {
        socketRef.current.emit('healthchat:leave-room', { chatId: selectedChatId });
        joinedRoomsRef.current.delete(selectedChatId);
      }
      return;
    }

    // Join new room (only for non-archived chats)
    if (!joinedRoomsRef.current.has(selectedChatId)) {
      socketRef.current.emit('healthchat:join-room', { chatId: selectedChatId });
      joinedRoomsRef.current.add(selectedChatId);
    }
  }, [selectedChatId, isConnected, isArchived]);

  // Clear typing indicator when viewing archived chats
  useEffect(() => {
    if (isArchived && selectedChatId) {
      setUserTypingRef.current(selectedChatId, null, false);
    }
  }, [isArchived, selectedChatId]);

  /**
   * Emit typing status to server (OPTIMIZED with throttling and debouncing)
   * - Throttles typing events to max once every 2 seconds per chat
   * - Debounces stop-typing by 500ms to batch rapid key presses
   * - Automatically stops typing after 3 seconds
   */
  const emitTyping = useCallback((chatId, isTyping) => {
    console.log('[HealthChatSocket Staff] emitTyping called:', {
      chatId,
      isTyping,
      connected: socketRef.current?.isConnected(),
      joinedRooms: Array.from(joinedRoomsRef.current)
    });

    if (!socketRef.current?.isConnected() || !chatId) {
      console.warn('[HealthChatSocket Staff] Cannot emit typing - not connected or no chatId');
      return;
    }

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
        console.log('[HealthChatSocket Staff] Throttling typing event (too soon)');
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
   */
  useEffect(() => {
    if (!selectedChatId) {
      // Clear polling if no chat selected
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const POLLING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

    const pollForNewMessages = async () => {
      try {
        console.log('[HealthChatSocket Staff] Polling for new messages in chat:', selectedChatId);
        // Import getMessages dynamically to avoid circular deps
        const { getMessages } = await import('../health-chat-service');

        // Fetch recent messages (last 10)
        const messages = await getMessages(selectedChatId, 0, 10);

        // Check if any messages are new (not in processedMessageIds)
        const newMessages = messages.filter(msg => {
          const messageId = String(msg.id);
          return !processedMessageIds.current.has(messageId);
        });

        if (newMessages.length > 0) {
          console.log(`[HealthChatSocket Staff] Polling found ${newMessages.length} new message(s)`);
          // Add each new message to the UI + mark as processed
          newMessages.forEach(msg => {
            const messageId = String(msg.id);
            processedMessageIds.current.add(messageId);
            // Keep Set size bounded
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              processedMessageIds.current.delete(firstKey);
            }
            addMessageRef.current(selectedChatId, msg);
          });
        } else {
          console.log('[HealthChatSocket Staff] Polling: no new messages');
        }
      } catch (error) {
        console.error('[HealthChatSocket Staff] Polling error:', error);
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
  }, [selectedChatId]);

  return {
    isConnected,
    emitTyping
  };
}
