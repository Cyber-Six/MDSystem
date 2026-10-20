/**
 * Health Chat Socket Hook - React Native
 * Mirrors mds-patient/src/modules/health-chat/hooks/use-health-chat-socket.js
 *
 * Manages WebSocket connection for real-time health chat:
 * - New message notifications
 * - Typing indicators
 * - Ticket status changes (approved, closed, rejected)
 * - Polling fallback for reliability
 * - Duplicate message prevention
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { getApiBaseUrl, TokenStorage, refreshAccessToken } from '../core';
import type { TicketMessage, Ticket } from '../services/health-chat-service';

interface SocketService {
  connect(): Promise<void>;
  disconnect(): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler?: (...args: any[]) => void): void;
  emit(event: string, data?: any, callback?: (...args: any[]) => void): boolean;
  isConnected(): boolean;
  getSocket(): any;
}

interface UseHealthChatSocketOptions {
  chatId: string | null;
  chatStatus: string;
  onNewMessage: (message: TicketMessage) => void;
  onTyping: (isTyping: boolean) => void;
  onTicketApproved: (chat: Ticket) => void;
  onTicketClosed: (data: any) => void;
}

export function useHealthChatSocket({
  chatId,
  chatStatus,
  onNewMessage,
  onTyping,
  onTicketApproved,
  onTicketClosed,
}: UseHealthChatSocketOptions) {
  const socketRef = useRef<any>(null);
  const connectingRef = useRef<SocketService | null>(null);
  const enabledRef = useRef(false);
  const joinedRoomRef = useRef<{ service: SocketService; chatId: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const processedMessageIds = useRef(new Set<string>());
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use refs for callbacks to avoid stale closures in socket event listeners
  const onNewMessageRef = useRef(onNewMessage);
  const onTypingRef = useRef(onTyping);
  const onTicketApprovedRef = useRef(onTicketApproved);
  const onTicketClosedRef = useRef(onTicketClosed);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onTypingRef.current = onTyping;
    onTicketApprovedRef.current = onTicketApproved;
    onTicketClosedRef.current = onTicketClosed;
  }, [onNewMessage, onTyping, onTicketApproved, onTicketClosed]);

  const shouldConnect = !!chatId && ['Open', 'Ongoing'].includes(chatStatus);

  const chatIdRef = useRef(chatId);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const joinCurrentRoom = useCallback((service: SocketService | null) => {
    const roomId = chatIdRef.current;
    if (!service?.isConnected() || !roomId) return;
    if (joinedRoomRef.current?.service === service && joinedRoomRef.current.chatId === roomId) return;
    if (joinedRoomRef.current?.service === service) {
      service.emit('healthchat:leave-room', { chatId: joinedRoomRef.current.chatId });
    }
    service.emit('healthchat:join-room', { chatId: roomId });
    joinedRoomRef.current = { service, chatId: roomId };
  }, []);

  // Handle app state changes — reconnect when app comes to foreground
  useEffect(() => {
    if (!shouldConnect) return;
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && shouldConnect && !socketRef.current?.isConnected()) {
        // Force reconnection attempt
        connectSocket();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [shouldConnect]);

  const connectSocket = useCallback(async () => {
    if (!enabledRef.current || socketRef.current?.isConnected() || connectingRef.current) return;

    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    let socketService: SocketService | null = null;
    try {
      socketService = createSocketService({
        getApiBaseUrl,
        getToken: () => TokenStorage.getAccessToken(),
        onAuthError: async () => {
          await refreshAccessToken();
        },
        options: {
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
          timeout: 15000,
        },
      }) as SocketService;

      socketRef.current = socketService;
      connectingRef.current = socketService;
      await socketService.connect();
      if (!enabledRef.current || socketRef.current !== socketService) return;
      setIsConnected(true);
      setSocketError(false);

      // Handle reconnection — rejoin current room
      socketService.on('connect', () => {
        if (!enabledRef.current || socketRef.current !== socketService) return;
        setIsConnected(true);
        setSocketError(false);
        joinCurrentRoom(socketService);
      });

      socketService.on('disconnect', () => {
        if (!enabledRef.current || socketRef.current !== socketService) return;
        joinedRoomRef.current = null;
        setIsConnected(false);
      });

      // Listen for new messages with deduplication
      socketService.on('healthchat:new-message', (data: any) => {
        if (String(data.chatId) === String(chatIdRef.current) && data.senderType === 'Medical') {
          const messageId = String(data.message?.id);
          if (messageId && processedMessageIds.current.has(messageId)) return;

          if (messageId) {
            processedMessageIds.current.add(messageId);
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              if (firstKey) processedMessageIds.current.delete(firstKey);
            }
          }
          onNewMessageRef.current?.(data.message);
        }
      });

      // Listen for typing indicators
      socketService.on('healthchat:user-typing', (data: any) => {
        if (String(data.chatId) === String(chatIdRef.current) && data.userType === 'Medical') {
          onTypingRef.current?.(data.isTyping);
        }
      });

      // Listen for ticket approval
      socketService.on('healthchat:ticket-approved', (data: any) => {
        if (String(data.chat?.id) === String(chatIdRef.current)) {
          onTicketApprovedRef.current?.(data.chat);
        }
      });

      // Listen for ticket closed
      socketService.on('healthchat:ticket-closed', (data: any) => {
        if (String(data.chatId) === String(chatIdRef.current)) {
          onTicketClosedRef.current?.(data);
        }
      });

      // Listen for ticket rejection
      socketService.on('healthchat:ticket-rejected', (data: any) => {
        if (String(data.chat?.id) === String(chatIdRef.current)) {
          onTicketClosedRef.current?.(data);
        }
      });

      // Join room for current chatId
      joinCurrentRoom(socketService);
    } catch (err: any) {
      if (!enabledRef.current || socketRef.current !== socketService) return;
      socketService?.disconnect();
      socketRef.current = null;
      console.error('[HealthChatSocket] Connection failed:', err.message);
      setIsConnected(false);
      setSocketError(true);
    } finally {
      if (connectingRef.current === socketService) connectingRef.current = null;
    }
  }, [joinCurrentRoom]);

  // Connect/disconnect based on shouldConnect
  useEffect(() => {
    enabledRef.current = shouldConnect;
    if (!shouldConnect) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      joinedRoomRef.current = null;
      setIsConnected(false);
      return;
    }

    if (!socketRef.current?.isConnected()) {
      connectSocket();
    }

    return () => {
      enabledRef.current = false;
      connectingRef.current = null;
      joinedRoomRef.current = null;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      processedMessageIds.current.clear();
    };
  }, [shouldConnect, connectSocket]);

  // Manage room join/leave when chatId changes
  useEffect(() => {
    const service = socketRef.current;
    joinCurrentRoom(service);

    return () => {
      const joinedRoom = joinedRoomRef.current;
      if (joinedRoom && joinedRoom.service === service && joinedRoom.chatId === chatId) {
        if (service?.isConnected()) service.emit('healthchat:leave-room', { chatId });
        joinedRoomRef.current = null;
      }
    };
  }, [chatId, joinCurrentRoom]);

  /**
   * Emit typing status with throttling and debouncing.
   * - Throttles to max once per 2s
   * - Debounces stop-typing by 500ms
   * - Auto-stops after 3s of inactivity
   */
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!socketRef.current?.isConnected() || !chatId) return;

      const now = Date.now();
      const THROTTLE_MS = 2000;
      const DEBOUNCE_STOP_MS = 500;

      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      if (isTyping) {
        const timeSinceLastEmit = now - lastTypingEmitRef.current;
        if (timeSinceLastEmit < THROTTLE_MS) {
          typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current?.isConnected()) {
              socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
              lastTypingEmitRef.current = 0;
            }
          }, 3000);
          return;
        }

        lastTypingEmitRef.current = now;
        socketRef.current.emit('healthchat:typing', { chatId, isTyping: true });

        typingTimeoutRef.current = setTimeout(() => {
          if (socketRef.current?.isConnected()) {
            socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
            lastTypingEmitRef.current = 0;
          }
        }, 3000);
      } else {
        typingDebounceRef.current = setTimeout(() => {
          if (socketRef.current?.isConnected()) {
            socketRef.current.emit('healthchat:typing', { chatId, isTyping: false });
            lastTypingEmitRef.current = 0;
          }
        }, DEBOUNCE_STOP_MS);
      }
    },
    [chatId],
  );

  const disconnect = useCallback(() => {
    enabledRef.current = false;
    connectingRef.current = null;
    joinedRoomRef.current = null;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

  // 3-minute polling fallback for message updates
  useEffect(() => {
    if (!chatId || !shouldConnect) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const POLLING_INTERVAL_MS = 3 * 60 * 1000;

    const pollForNewMessages = async () => {
      try {
        const { getTicketMessages } = await import('../services/health-chat-service');
        const messages = await getTicketMessages(chatId, 0, 10);
        const newMessages = messages.filter((msg: TicketMessage) => {
          const messageId = String(msg.id);
          const isFromStaff = msg.userType === 'Medical';
          const notProcessed = !processedMessageIds.current.has(messageId);
          return isFromStaff && notProcessed;
        });

        if (newMessages.length > 0) {
          newMessages.forEach((msg: TicketMessage) => {
            const messageId = String(msg.id);
            processedMessageIds.current.add(messageId);
            if (processedMessageIds.current.size > 100) {
              const firstKey = processedMessageIds.current.values().next().value;
              if (firstKey) processedMessageIds.current.delete(firstKey);
            }
            onNewMessageRef.current?.(msg);
          });
        }
      } catch (error) {
        console.error('[HealthChatSocket] Polling error:', error);
      }
    };

    pollingIntervalRef.current = setInterval(pollForNewMessages, POLLING_INTERVAL_MS);

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
    disconnect,
  };
}
