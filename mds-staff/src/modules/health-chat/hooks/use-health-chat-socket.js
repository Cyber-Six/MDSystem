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
    addMessage,
    addTicket,
    updateTicketStatus,
    removeTicket,
    setUserTyping,
    refreshTickets,
    setSocketError,
    filter
  } = useHealthChat();

  // Use refs for callbacks to avoid socket reconnection on every filter change
  const refreshTicketsRef = useRef(refreshTickets);
  const removeTicketRef = useRef(removeTicket);
  const filterRef = useRef(filter);

  useEffect(() => {
    refreshTicketsRef.current = refreshTickets;
    removeTicketRef.current = removeTicket;
    filterRef.current = filter;
  }, [refreshTickets, removeTicket, filter]);

  // Connect on mount
  useEffect(() => {
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
      socketRef.current = socketService;
      setIsConnected(true);
      setSocketError(false);

      // Listen for new ticket created by patient
      socketService.on('healthchat:ticket-created', (data) => {
        if (data.chat) {
          addTicket(data.chat);
        }
      });

      // Listen for new messages (in any room we're in)
      socketService.on('healthchat:new-message', (data) => {
        if (data.chatId && data.message && data.senderType === 'Patient') {
          addMessage(data.chatId, data.message);
        }
      });

      // Listen for typing indicators
      socketService.on('healthchat:user-typing', (data) => {
        if (data.chatId && data.userType === 'Patient') {
          setUserTyping(data.chatId, data.userId, data.isTyping);
        }
      });

      // Listen for ticket closed by patient
      socketService.on('healthchat:ticket-closed', (data) => {
        if (data.chatId && data.closedBy === 'Patient') {
          updateTicketStatus(data.chatId, 'Closed');
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
      console.error('[HealthChatSocket] Connection failed:', err);
      console.error('[HealthChatSocket] Details:', err.message);
      setIsConnected(false);
      setSocketError(true);
    });

    // Cleanup on unmount
    return () => {
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
  }, [addMessage, addTicket, updateTicketStatus, setUserTyping, setSocketError]);

  // Join room when chat is selected
  useEffect(() => {
    if (!socketRef.current?.isConnected() || !selectedChatId) return;

    // Leave previous room if different
    joinedRoomsRef.current.forEach(roomId => {
      if (roomId !== selectedChatId) {
        socketRef.current.emit('healthchat:leave-room', { chatId: roomId });
        joinedRoomsRef.current.delete(roomId);
      }
    });

    // Join new room
    if (!joinedRoomsRef.current.has(selectedChatId)) {
      socketRef.current.emit('healthchat:join-room', { chatId: selectedChatId });
      joinedRoomsRef.current.add(selectedChatId);
    }
  }, [selectedChatId]);

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
