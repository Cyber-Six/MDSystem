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

  const {
    selectedChatId,
    selectedTicket,
    activeTicketId,
    addMessage,
    addTicket,
    updateConversationForNewMessage,
    setUserTyping,
    refreshConversationList,
    setSocketError,
    markTicketClosed,
    tickets,
    updateTicketExpiresAt
  } = useHealthChat();

  // Use refs for ALL callbacks to avoid socket reconnection on dependency changes
  // This is critical to prevent duplicate event listeners
  const addMessageRef = useRef(addMessage);
  const addTicketRef = useRef(addTicket);
  const updateConversationForNewMessageRef = useRef(updateConversationForNewMessage);
  const setUserTypingRef = useRef(setUserTyping);
  const setSocketErrorRef = useRef(setSocketError);
  const refreshConversationListRef = useRef(refreshConversationList);
  const markTicketClosedRef = useRef(markTicketClosed);
  const ticketsRef = useRef(tickets);
  const updateTicketExpiresAtRef = useRef(updateTicketExpiresAt);

  // Keep refs up to date
  useEffect(() => {
    addMessageRef.current = addMessage;
    addTicketRef.current = addTicket;
    updateConversationForNewMessageRef.current = updateConversationForNewMessage;
    setUserTypingRef.current = setUserTyping;
    setSocketErrorRef.current = setSocketError;
    refreshConversationListRef.current = refreshConversationList;
    markTicketClosedRef.current = markTicketClosed;
    ticketsRef.current = tickets;
    updateTicketExpiresAtRef.current = updateTicketExpiresAt;
  }, [addMessage, addTicket, updateConversationForNewMessage, setUserTyping, setSocketError, refreshConversationList, markTicketClosed, tickets, updateTicketExpiresAt]);

  // Check if selected chat is archived (should not receive typing events)
  const isArchived = selectedTicket && ['Closed', 'Expired'].includes(selectedTicket.status);

  // Connect on mount only - use empty dependency array to prevent reconnection
  useEffect(() => {
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

      socketRef.current = socketService;
      setIsConnected(true);
      setSocketErrorRef.current(false);

      // Join branch-scoped notification rooms used by health chat ticket events.
      socketService.emit('notification:join-branch', {});

      // Handle reconnection - rejoin all tracked rooms
      socketService.getSocket()?.on('reconnect', () => {
        socketService.emit('notification:join-branch', {});
        joinedRoomsRef.current.forEach(roomId => {
          socketService.emit('healthchat:join-room', { chatId: roomId });
        });
      });

      // Listen for new ticket created by patient
      socketService.on('healthchat:ticket-created', (data) => {
        if (data?.chat) {
          addTicketRef.current(data.chat);
          return;
        }

        // Fallback to source-of-truth fetch if payload is partial.
        refreshConversationListRef.current();
      });

      // Listen for new messages (in any room we're in) with deduplication
      socketService.on('healthchat:new-message', (data) => {
        // Handle both Patient and Medical messages
        if (data.chatId && data.message && (data.senderType === 'Patient' || data.senderType === 'Medical')) {
          // Deduplicate messages by ID
          const messageId = String(data.message?.id);
          if (messageId && processedMessageIds.current.has(messageId)) {
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
          addMessageRef.current(data.chatId, data.message);
          // Update conversation list (lastMessage, unread, order)
          updateConversationForNewMessageRef.current(data.chatId, data.message, data.senderType);
        }
      });

      // Listen for typing indicators (ignore closed chats)
      // Map ticketId to patientId for typing state since UI is patient-grouped
      socketService.on('healthchat:user-typing', (data) => {
        if (data.chatId && data.userType === 'Patient') {
          // Ignore typing events for closed chats
          if (closedChatIds.current.has(String(data.chatId))) {
            return;
          }
          // Find the patientId for this ticket by checking the tickets list
          const ticketId = String(data.chatId);
          let patientKey = ticketId; // Default to ticketId
          const ticket = ticketsRef.current?.find(t =>
            String(t.id) === ticketId ||
            t.tickets?.some(sub => String(sub.id) === ticketId)
          );
          if (ticket?.patientId) {
            patientKey = String(ticket.patientId);
          }
          setUserTypingRef.current(patientKey, data.userId, data.isTyping);
        }
      });

      // Listen for ticket closed by patient
      // Updates status immediately but defers removal from list until staff navigates away
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId) {
          const closedBy = data.closedBy || 'Patient';
          // Track this chat as closed to ignore future typing events
          closedChatIds.current.add(String(data.chatId));
          // Find the patient for this ticket
          const ticketId = String(data.chatId);
          const ticket = ticketsRef.current?.find(t =>
            String(t.id) === ticketId ||
            t.tickets?.some(sub => String(sub.id) === ticketId)
          );
          const patientId = ticket?.patientId || ticketId;
          // Mark as closed (status updates immediately, stays in list)
          markTicketClosedRef.current(data.chatId, patientId, closedBy);
          // Clear typing indicator
          setUserTypingRef.current(String(patientId), null, false);
        }
      });

      // Listen for ticket status changes by other staff (approve/reject)
      socketService.on('healthchat:ticket-status-changed', (data) => {
        if (data.chatId && data.status) {
          // Pull source-of-truth data so ownership changes are reflected immediately.
          refreshConversationListRef.current();
        }
      });

      // Listen for session extended (patient or other staff extended the session)
      socketService.on('healthchat:session-extended', (data) => {
        if (data.chatId && data.expiresAt) {
          updateTicketExpiresAtRef.current(data.chatId, data.expiresAt);
        }
      });

      // Listen for ticket transferred away from current staff
      socketService.on('healthchat:ticket-transferred', (data) => {
        if (data?.chatId) {
          refreshConversationListRef.current();
        }
      });

      // Listen for ticket taken over by admin
      socketService.on('healthchat:ticket-taken-over', (data) => {
        if (data?.chatId) {
          refreshConversationListRef.current();
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
  // IMPORTANT: Join by activeTicketId (actual ticket ID), not selectedChatId (patientId)
  // because socket rooms are named healthchat:${ticketId}
  useEffect(() => {
    if (!socketRef.current?.isConnected() || !activeTicketId) return;

    // Leave previous room if different
    joinedRoomsRef.current.forEach(roomId => {
      if (String(roomId) !== String(activeTicketId)) {
        socketRef.current.emit('healthchat:leave-room', { chatId: roomId });
        joinedRoomsRef.current.delete(roomId);
      }
    });

    // Don't join room for archived chats - no need for real-time updates
    if (isArchived) {
      // If we had joined this room before, leave it
      if (joinedRoomsRef.current.has(activeTicketId)) {
        socketRef.current.emit('healthchat:leave-room', { chatId: activeTicketId });
        joinedRoomsRef.current.delete(activeTicketId);
      }
      return;
    }

    // Join new room (only for non-archived chats)
    if (!joinedRoomsRef.current.has(activeTicketId)) {
      socketRef.current.emit('healthchat:join-room', { chatId: activeTicketId });
      joinedRoomsRef.current.add(activeTicketId);
    }
  }, [activeTicketId, isConnected, isArchived]);

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
    if (!socketRef.current?.isConnected() || !chatId) {
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

  return {
    isConnected,
    emitTyping
  };
}
