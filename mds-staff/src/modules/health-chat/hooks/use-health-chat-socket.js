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
    activeTicketId,
    addMessage,
    addTicket,
    updateTicketStatus,
    updateConversationForNewMessage,
    removeTicket,
    setUserTyping,
    refreshTickets,
    setSocketError,
    markTicketPendingClosed,
    filter,
    tickets,
    updateTicketExpiresAt
  } = useHealthChat();

  // Use refs for ALL callbacks to avoid socket reconnection on dependency changes
  // This is critical to prevent duplicate event listeners
  const addMessageRef = useRef(addMessage);
  const addTicketRef = useRef(addTicket);
  const updateTicketStatusRef = useRef(updateTicketStatus);
  const updateConversationForNewMessageRef = useRef(updateConversationForNewMessage);
  const setUserTypingRef = useRef(setUserTyping);
  const setSocketErrorRef = useRef(setSocketError);
  const refreshTicketsRef = useRef(refreshTickets);
  const removeTicketRef = useRef(removeTicket);
  const markTicketPendingClosedRef = useRef(markTicketPendingClosed);
  const filterRef = useRef(filter);
  const ticketsRef = useRef(tickets);
  const updateTicketExpiresAtRef = useRef(updateTicketExpiresAt);

  // Keep refs up to date
  useEffect(() => {
    addMessageRef.current = addMessage;
    addTicketRef.current = addTicket;
    updateTicketStatusRef.current = updateTicketStatus;
    updateConversationForNewMessageRef.current = updateConversationForNewMessage;
    setUserTypingRef.current = setUserTyping;
    setSocketErrorRef.current = setSocketError;
    refreshTicketsRef.current = refreshTickets;
    removeTicketRef.current = removeTicket;
    markTicketPendingClosedRef.current = markTicketPendingClosed;
    filterRef.current = filter;
    ticketsRef.current = tickets;
    updateTicketExpiresAtRef.current = updateTicketExpiresAt;
  }, [addMessage, addTicket, updateTicketStatus, updateConversationForNewMessage, setUserTyping, setSocketError, refreshTickets, removeTicket, markTicketPendingClosed, filter, tickets, updateTicketExpiresAt]);

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

      // Handle reconnection - rejoin all tracked rooms
      socketService.getSocket()?.on('reconnect', () => {
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
          // Mark as pending closed (status updates immediately, removal deferred)
          markTicketPendingClosedRef.current(data.chatId, patientId, closedBy);
          // Clear typing indicator
          setUserTypingRef.current(String(patientId), null, false);
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

      // Listen for session extended (patient or other staff extended the session)
      socketService.on('healthchat:session-extended', (data) => {
        if (data.chatId && data.expiresAt) {
          updateTicketExpiresAtRef.current(data.chatId, data.expiresAt);
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

  /**
   * 3-minute polling fallback for message updates
   * Runs independently of socket status to ensure messages are never missed
   * Uses patientMessages endpoint since selectedChatId is actually patientId
   */
  useEffect(() => {
    // Always clear previous interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!selectedChatId || isArchived) {
      return; // Nothing to poll
    }

    const POLLING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

    const pollForNewMessages = async () => {
      try {
        console.log('[HealthChatSocket Staff] Polling for new messages for patient:', selectedChatId);
        // Use getPatientMessages since selectedChatId is actually patientId in the grouped approach
        const { getPatientMessages } = await import('../health-chat-service');

        // Fetch recent messages (last 10)
        const messages = await getPatientMessages(Number(selectedChatId), { limit: 10 });

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
  }, [selectedChatId, isArchived]);

  return {
    isConnected,
    emitTyping
  };
}
