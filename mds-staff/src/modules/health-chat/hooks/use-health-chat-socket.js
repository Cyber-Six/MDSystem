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
  const joinedRoomsRef = useRef(new Set());

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

      // Listen for new ticket created by patient
      socketService.on('healthchat:ticket-created', (data) => {
        if (data.chat) {
          addTicketRef.current(data.chat);
        }
      });

      // Listen for new messages (in any room we're in)
      socketService.on('healthchat:new-message', (data) => {
        if (data.chatId && data.message && data.senderType === 'Patient') {
          addMessageRef.current(data.chatId, data.message);
        }
      });

      // Listen for typing indicators
      socketService.on('healthchat:user-typing', (data) => {
        if (data.chatId && data.userType === 'Patient') {
          setUserTypingRef.current(data.chatId, data.userId, data.isTyping);
        }
      });

      // Listen for ticket closed by patient
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId && data.closedBy === 'Patient') {
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
   * Emit typing status to server
   */
  const emitTyping = useCallback((chatId, isTyping) => {
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
    emitTyping
  };
}
