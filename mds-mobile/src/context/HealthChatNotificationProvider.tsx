/**
 * HealthChatNotificationProvider
 *
 * Maintains a persistent socket connection at the app level to listen for
 * health chat events.
 *
 * Behaviour by app state:
 * - App ACTIVE + user on HealthChat → do nothing (user sees messages live)
 * - App ACTIVE + user on another tab → increment badge on the HealthChat tab icon
 * - App BACKGROUND / INACTIVE → show a local push notification
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { getApiBaseUrl, TokenStorage, refreshAccessToken, getNavigationRef, axiosRequest } from '../core';
import {
  requestNotificationPermissions,
  setupNotificationChannel,
  showHealthChatNotification,
  onNotificationResponse,
  getExpoPushToken,
  registerPushToken,
} from '../services/notification-service';

interface SocketService {
  connect(): Promise<void>;
  disconnect(): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler?: (...args: any[]) => void): void;
  emit(event: string, data?: any, callback?: (...args: any[]) => void): boolean;
  isConnected(): boolean;
  getSocket(): any;
}

interface HealthChatBadgeContextValue {
  badgeCount: number;
  clearBadge: () => void;
}

const HealthChatBadgeContext = createContext<HealthChatBadgeContextValue>({
  badgeCount: 0,
  clearBadge: () => {},
});

/** Hook — read badge count and clear it (call on HealthChat screen focus) */
export const useHealthChatBadge = () => useContext(HealthChatBadgeContext);

/**
 * Provider component — provides badge context + sets up the global
 * socket listener + notification pipeline as a side effect.
 */
export const HealthChatNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [badgeCount, setBadgeCount] = useState(0);
  const socketRef = useRef<SocketService | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const clearBadge = () => setBadgeCount(0);
  const incrementBadge = () => setBadgeCount((n) => n + 1);

  const isOnHealthChat = () => {
    return getNavigationRef()?.getCurrentRoute()?.name === 'HealthChat';
  };

  /** Decides what to do when a notable socket event arrives */
  const handleEvent = async (
    notifTitle: string,
    notifBody: string,
    notifData: Record<string, unknown>,
  ) => {
    const isActive = appStateRef.current === 'active';

    if (isActive && isOnHealthChat()) {
      return; // User already sees it live — nothing to do
    }

    // Show notification in all other cases:
    //   - App active but on a different tab → banner on screen + badge
    //   - App backgrounded / inactive → lock-screen notification
    await showHealthChatNotification(notifTitle, notifBody, notifData);

    // Additionally bump the tab badge so user sees the count even after dismissing banner
    if (isActive) {
      incrementBadge();
    }
  };

  // Set up notifications + register Expo push token on mount
  useEffect(() => {
    (async () => {
      await setupNotificationChannel();
      const granted = await requestNotificationPermissions();
      if (granted) {
        // Register push token with backend so remote push works when app is killed
        const token = await getExpoPushToken();
        if (token) {
          await registerPushToken(token, axiosRequest);
        }
      }
    })();

    // Navigate to HealthChat when user taps a notification
    const cleanup = onNotificationResponse((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'health-chat') {
        try {
          getNavigationRef()?.navigate('HealthChat');
        } catch {
          // Navigation may not be ready
        }
      }
    });

    return cleanup;
  }, []);

  // Global socket connection for notifications
  useEffect(() => {
    let mounted = true;

    const connectGlobalSocket = async () => {
      if (socketRef.current?.isConnected()) return;

      // Clean up previous socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      try {
        const token = await TokenStorage.getAccessToken();
        if (!token) return; // Not authenticated

        const socketService = createSocketService({
          getApiBaseUrl,
          getToken: () => TokenStorage.getAccessToken(),
          onAuthError: async () => {
            await refreshAccessToken();
          },
          options: {
            reconnectionDelay: 1000,
            reconnectionDelayMax: 15000,
            reconnectionAttempts: Infinity,
            transports: ['websocket', 'polling'],
            timeout: 20000,
          },
        }) as SocketService;

        await socketService.connect();
        if (!mounted) {
          socketService.disconnect();
          return;
        }

        socketRef.current = socketService;

        // Listen for new health chat messages
        socketService.on('healthchat:new-message', async (data: any) => {
          if (data?.senderType === 'Medical' && data?.message) {
            const msg = data.message;
            const body = msg.content_type === 'file'
              ? '📎 Sent an image'
              : (msg.content || 'New message');
            await handleEvent('💬 Health Chat', body, { type: 'health-chat', chatId: data.chatId });
          }
        });

        // Listen for ticket approval
        socketService.on('healthchat:ticket-approved', async (data: any) => {
          await handleEvent(
            '✅ Health Chat Approved',
            'Your health chat request has been approved. A staff member is ready to assist you.',
            { type: 'health-chat', chatId: data?.chat?.id },
          );
        });

        // Listen for ticket closed by staff
        socketService.on('healthchat:ticket-closed', async (data: any) => {
          await handleEvent(
            'Health Chat Ended',
            'Your health chat session has been closed.',
            { type: 'health-chat', chatId: data?.chatId },
          );
        });

        // Listen for ticket rejection
        socketService.on('healthchat:ticket-rejected', async (data: any) => {
          await handleEvent(
            '❌ Health Chat Declined',
            'Your health chat request was not approved. You may try again later.',
            { type: 'health-chat', chatId: data?.chat?.id },
          );
        });

      } catch (err: any) {
        console.error('[NotificationSocket] Connection failed:', err.message);
      }
    };

    connectGlobalSocket();

    // Reconnect when app returns to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && !socketRef.current?.isConnected()) {
        connectGlobalSocket();
      }
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <HealthChatBadgeContext.Provider value={{ badgeCount, clearBadge }}>
      {children}
    </HealthChatBadgeContext.Provider>
  );
};

export default HealthChatNotificationProvider;
