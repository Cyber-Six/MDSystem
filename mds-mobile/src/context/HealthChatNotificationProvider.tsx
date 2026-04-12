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
import { useSettings } from './SettingsContext';
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
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const clearBadge = () => setBadgeCount(0);
  const incrementBadge = () => setBadgeCount((n) => n + 1);

  const isOnHealthChat = () => {
    return getNavigationRef()?.getCurrentRoute()?.name === 'HealthChat';
  };

  /**
   * Check if web (push) channel is enabled for a given module.
   * Uses the per-module override if set, otherwise falls back to the global channel.
   */
  const isModuleWebEnabled = (moduleKey: string): boolean => {
    const s = settingsRef.current;
    const mc = (s.moduleChannels as any)[moduleKey];
    if (mc && typeof mc.web === 'boolean') return mc.web;
    return s.channels.web;
  };

  /** Decides what to do when a notable socket event arrives.
   * @param moduleKey - The notification module key (e.g. 'healthChat', 'appointments')
   * @param suppressOnHealthChat - Only suppress when user is on HealthChat (for chat-specific events).
   *   Set to false for appointment/medicine/record events that should always notify. */
  const handleEvent = async (
    moduleKey: string,
    notifTitle: string,
    notifBody: string,
    notifData: Record<string, unknown>,
    suppressOnHealthChat = false,
  ) => {
    // Respect user's notification channel preferences
    if (!isModuleWebEnabled(moduleKey)) return;

    const isActive = appStateRef.current === 'active';

    if (isActive && suppressOnHealthChat && isOnHealthChat()) {
      return; // User already sees it live — only skip for health-chat events
    }

    if (settingsRef.current.showBanners) {
      await showHealthChatNotification(notifTitle, notifBody, notifData);
    }

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

    // Navigate to the correct tab when user taps a notification
    const cleanup = onNotificationResponse((response) => {
      const data = response.notification.request.content.data;
      try {
        const nav = getNavigationRef();
        if (!nav) return;
        if (data?.type === 'health-chat') {
          nav.navigate('HealthChat');
        } else if (data?.type === 'appointment') {
          nav.navigate('Appointments');
        } else if (data?.type === 'medicine') {
          nav.navigate('Medicine');
        } else if (data?.type === 'record' || data?.type === 'staff') {
          nav.navigate('More');
        }
      } catch {
        // Navigation may not be ready
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
              ? 'Sent an image'
              : (msg.content || 'New message');
            await handleEvent('healthChat', 'Health Chat', body, { type: 'health-chat', chatId: data.chatId }, true);
          }
        });

        // Listen for ticket approval
        socketService.on('healthchat:ticket-approved', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Approved',
            'Your health chat request has been approved. A staff member is ready to assist you.',
            { type: 'health-chat', chatId: data?.chat?.id },
            true,
          );
        });

        // Listen for ticket closed by staff
        socketService.on('healthchat:ticket-closed', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Ended',
            'Your health chat session has been closed.',
            { type: 'health-chat', chatId: data?.chatId },
            true,
          );
        });

        // Listen for ticket rejection
        socketService.on('healthchat:ticket-rejected', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Declined',
            'Your health chat request was not approved. You may try again later.',
            { type: 'health-chat', chatId: data?.chat?.id },
            true,
          );
        });

        // ── Appointment events ──────────────────────────────────────────────

        socketService.on('appointment:responded', async (data: any) => {
          const status = data?.status ?? 'Updated';
          const verb = status === 'Approved' ? 'confirmed' : status.toLowerCase();
          const body = data?.notes
            ? `Your appointment has been ${verb}. Note: ${data.notes}`
            : `Your appointment has been ${verb}.`;
          await handleEvent('appointments', `Appointment ${status}`, body, { type: 'appointment' });
        });

        socketService.on('appointment:attendance-recorded', async () => {
          await handleEvent(
            'appointments',
            'Attendance Recorded',
            'Your clinic visit has been recorded.',
            { type: 'appointment' },
          );
        });

        // ── Medicine events ─────────────────────────────────────────────────

        socketService.on('medicine:request:approved', async () => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Approved',
            'Your medicine request has been approved.',
            { type: 'medicine' },
          );
        });

        socketService.on('medicine:request:rejected', async () => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Declined',
            'Your medicine request was declined.',
            { type: 'medicine' },
          );
        });

        socketService.on('medicine:request:pending', async () => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Received',
            'Your medicine request is being processed.',
            { type: 'medicine' },
          );
        });

        socketService.on('medicine:prescription:issued', async () => {
          await handleEvent(
            'medicineRequests',
            'Prescription Ready',
            'A new prescription has been issued for you.',
            { type: 'medicine' },
          );
        });

        // ── Update ticket events ────────────────────────────────────────────

        socketService.on('updateTicket:statusChanged', async (data: any) => {
          const newStatus = data?.newStatus ?? 'Updated';
          const body = data?.message ?? `Your record update request has been ${newStatus.toLowerCase()}.`;
          await handleEvent('emr', `Record Update ${newStatus}`, body, { type: 'record' });
        });

        // ── Staff announcements ─────────────────────────────────────────────

        socketService.on('staff:notification', async (data: any) => {
          let title = 'Message from Staff';
          let body = '';

          if (data?.message) {
            if (typeof data.message === 'string' && data.message.startsWith('{')) {
              try {
                const parsed = JSON.parse(data.message);
                title = parsed.title ?? title;
                body = parsed.body ?? '';
              } catch {
                body = data.message;
              }
            } else {
              body = data.message;
            }
          }

          if (body) {
            await handleEvent('general', title, body, { type: 'staff' });
          }
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
