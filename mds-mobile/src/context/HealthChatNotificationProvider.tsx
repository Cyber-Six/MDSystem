/**
 * HealthChatNotificationProvider
 *
 * Maintains a persistent socket connection at the app level to listen for
 * patient notification events across modules.
 *
 * Behaviour by app state:
 * - App ACTIVE + user on HealthChat → do nothing (user sees messages live)
 * - App ACTIVE + user on another tab → increment badge on the HealthChat tab icon
 * - App BACKGROUND / INACTIVE → show a local push notification
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { getApiBaseUrl, TokenStorage, refreshAccessToken, getNavigationRef, axiosRequest } from '../core';
import { useSettings } from './SettingsContext';
import {
  requestNotificationPermissions,
  setupNotificationChannel,
  showLocalNotification,
  onNotificationResponse,
  onPushTokenChanged,
  getExpoPushToken,
  registerPushToken,
  DEFAULT_NOTIFICATION_CHANNEL_ID,
  HEALTH_CHAT_CHANNEL_ID,
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
  const lastRegisteredPushTokenRef = useRef<string | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  settingsRef.current = settings;

  const clearBadge = () => setBadgeCount(0);
  const incrementBadge = () => setBadgeCount((n) => n + 1);

  const getDeepestRouteName = (state: any): string | null => {
    if (!state?.routes?.length) return null;

    let route = state.routes[state.index ?? 0];
    while (route?.state?.routes?.length) {
      route = route.state.routes[route.state.index ?? 0];
    }

    return route?.name ?? null;
  };

  const navigateToMainTab = (screen: string, params?: Record<string, unknown>): boolean => {
    const nav = getNavigationRef();
    if (!nav) return false;
    nav.navigate('MainTabs', { screen, params });
    return true;
  };

  const navigateToMoreStackScreen = (screen: string): boolean => {
    return navigateToMainTab('More', { screen });
  };

  const navigateWhenReady = (navigateFn: () => boolean) => {
    if (navigateFn()) return;
    // Cold-start notifications can arrive before nav is fully ready.
    setTimeout(() => {
      navigateFn();
    }, 350);
  };

  const isOnHealthChat = () => {
    const nav = getNavigationRef();
    if (!nav) return false;

    const rootState = nav.getRootState?.();
    const currentName = getDeepestRouteName(rootState) ?? nav.getCurrentRoute?.()?.name;
    return currentName === 'HealthChat';
  };

  const navigateFromNotificationData = (rawData: any) => {
    if (!rawData) return;

    const type = String(rawData?.type ?? '').toLowerCase();
    const event = String(rawData?.event ?? '').toLowerCase();

    if (type === 'health-chat' || event.startsWith('healthchat:')) {
      navigateWhenReady(() => navigateToMainTab('HealthChat'));
      return;
    }

    if (type === 'appointment' || event.startsWith('appointment:')) {
      navigateWhenReady(() => navigateToMainTab('Appointments'));
      return;
    }

    if (type === 'medicine' || event.startsWith('medicine:')) {
      navigateWhenReady(() => navigateToMainTab('Medicine'));
      return;
    }

    if (type === 'document' || event.startsWith('document:')) {
      navigateWhenReady(() => navigateToMoreStackScreen('MyDocuments'));
      return;
    }

    if (type === 'record' || type === 'emr' || event.startsWith('updateticket')) {
      navigateWhenReady(() => navigateToMainTab('UpdateRecord'));
      return;
    }

    if (type === 'inventory' || type === 'role-management' || event.startsWith('inventory:') || event.startsWith('role:')) {
      navigateWhenReady(() => navigateToMainTab('More'));
      return;
    }

    if (type === 'staff' || type === 'general' || event === 'staff:notification' || event === 'admin:notification') {
      navigateWhenReady(() => navigateToMainTab('More'));
      return;
    }

    // Default fallback for unknown module/type notifications.
    navigateWhenReady(() => navigateToMainTab('More'));
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
    androidChannelId: string = DEFAULT_NOTIFICATION_CHANNEL_ID,
  ) => {
    // Respect user's notification channel preferences
    if (!isModuleWebEnabled(moduleKey)) return;

    const isActive = appStateRef.current === 'active';

    if (isActive && suppressOnHealthChat && isOnHealthChat()) {
      return; // User already sees it live — only skip for health-chat events
    }

    if (settingsRef.current.showBanners) {
      await showLocalNotification(notifTitle, notifBody, notifData, androidChannelId);
    }

    if (isActive && moduleKey === 'healthChat') {
      incrementBadge();
    }
  };

  // Set up notifications + register Expo push token on mount
  useEffect(() => {
    let mounted = true;

    const registerPushTokenIfNeeded = async (token: string | null) => {
      if (!mounted || !token) return;
      if (token === lastRegisteredPushTokenRef.current) return;
      await registerPushToken(token, axiosRequest);
      if (mounted) {
        lastRegisteredPushTokenRef.current = token;
      }
    };

    const handleNotificationResponse = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;

      const identifier = response.notification.request.identifier ?? null;
      if (identifier && identifier === lastHandledNotificationIdRef.current) return;
      lastHandledNotificationIdRef.current = identifier;

      navigateFromNotificationData(response.notification.request.content.data);
      try {
        await (Notifications as any).clearLastNotificationResponseAsync?.();
      } catch {
        // Non-critical, mainly used to prevent duplicate cold-start handling
      }
    };

    const bootstrapNotifications = async () => {
      try {
        await setupNotificationChannel();
        const granted = await requestNotificationPermissions();
        if (granted) {
          // Register push token with backend so remote push works when app is killed
          const token = await getExpoPushToken();
          await registerPushTokenIfNeeded(token);
        }

        // Handle notification that launched the app from a terminated state.
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        await handleNotificationResponse(lastResponse);
      } catch (err: any) {
        console.warn('[Notifications] Bootstrap failed:', err?.message ?? 'unknown error');
      }
    };

    bootstrapNotifications();

    // Navigate to the correct screen when user taps a notification
    const cleanupResponse = onNotificationResponse((response) => {
      handleNotificationResponse(response).catch(() => {});
    });

    // Expo tokens can rotate; register refreshed tokens automatically.
    const cleanupPushTokenListener = onPushTokenChanged((token) => {
      registerPushTokenIfNeeded(token).catch(() => {});
    });

    return () => {
      mounted = false;
      cleanupResponse();
      cleanupPushTokenListener();
    };
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

        const parseAnnouncementNotification = (data: any, defaultTitle: string) => {
          let title = defaultTitle;
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

          return { title, body };
        };

        // Listen for new health chat messages
        socketService.on('healthchat:new-message', async (data: any) => {
          if (data?.senderType === 'Medical' && data?.message) {
            const msg = data.message;
            const body = msg.content_type === 'file'
              ? 'Sent an image'
              : (msg.content || msg.text || 'New message');
            await handleEvent(
              'healthChat',
              'Health Chat',
              body,
              { type: 'health-chat', event: 'healthchat:new-message', chatId: data.chatId },
              true,
              HEALTH_CHAT_CHANNEL_ID,
            );
          }
        });

        // Listen for ticket approval
        socketService.on('healthchat:ticket-approved', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Approved',
            'Your health chat request has been approved. A staff member is ready to assist you.',
            { type: 'health-chat', event: 'healthchat:ticket-approved', chatId: data?.chat?.id },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // Listen for ticket closed by staff
        socketService.on('healthchat:ticket-closed', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Ended',
            'Your health chat session has been closed.',
            { type: 'health-chat', event: 'healthchat:ticket-closed', chatId: data?.chatId },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // Listen for ticket rejection
        socketService.on('healthchat:ticket-rejected', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Declined',
            'Your health chat request was not approved. You may try again later.',
            { type: 'health-chat', event: 'healthchat:ticket-rejected', chatId: data?.chat?.id },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // Listen for ticket transfer to another staff member
        socketService.on('healthchat:ticket-transferred', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Reassigned',
            'Your health chat has been reassigned to another staff member.',
            { type: 'health-chat', event: 'healthchat:ticket-transferred', chatId: data?.chatId },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // Listen for ticket takeover by another staff member
        socketService.on('healthchat:ticket-taken-over', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Updated',
            'A staff member has taken over your health chat session.',
            { type: 'health-chat', event: 'healthchat:ticket-taken-over', chatId: data?.chatId },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // Listen for session extension updates
        socketService.on('healthchat:session-extended', async (data: any) => {
          await handleEvent(
            'healthChat',
            'Health Chat Session Extended',
            'Your health chat inactivity timer has been reset.',
            { type: 'health-chat', event: 'healthchat:session-extended', chatId: data?.chatId, expiresAt: data?.expiresAt },
            true,
            HEALTH_CHAT_CHANNEL_ID,
          );
        });

        // ── Appointment events ──────────────────────────────────────────────

        socketService.on('appointment:responded', async (data: any) => {
          const status = data?.status ?? 'Updated';
          const verb = status === 'Approved' ? 'confirmed' : status.toLowerCase();
          const body = data?.notes
            ? `Your appointment has been ${verb}. Note: ${data.notes}`
            : `Your appointment has been ${verb}.`;
          await handleEvent(
            'appointments',
            `Appointment ${status}`,
            body,
            { type: 'appointment', event: 'appointment:responded', slotId: data?.slotId },
          );
        });

        socketService.on('appointment:attendance-recorded', async (data: any) => {
          await handleEvent(
            'appointments',
            'Attendance Recorded',
            'Your clinic visit has been recorded.',
            { type: 'appointment', event: 'appointment:attendance-recorded', slotId: data?.slotId },
          );
        });

        // ── Medicine events ─────────────────────────────────────────────────

        socketService.on('medicine:request:approved', async (data: any) => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Approved',
            'Your medicine request has been approved.',
            { type: 'medicine', event: 'medicine:request:approved', requestId: data?.requestId },
          );
        });

        socketService.on('medicine:request:rejected', async (data: any) => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Declined',
            'Your medicine request was declined.',
            { type: 'medicine', event: 'medicine:request:rejected', requestId: data?.requestId },
          );
        });

        socketService.on('medicine:request:cancelled', async (data: any) => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Cancelled',
            'Your medicine request was cancelled.',
            { type: 'medicine', event: 'medicine:request:cancelled', requestId: data?.requestId },
          );
        });

        socketService.on('medicine:request:pending', async (data: any) => {
          await handleEvent(
            'medicineRequests',
            'Medicine Request Received',
            'Your medicine request is being processed.',
            { type: 'medicine', event: 'medicine:request:pending', requestId: data?.requestId },
          );
        });

        socketService.on('medicine:prescription:issued', async (data: any) => {
          await handleEvent(
            'medicineRequests',
            'Prescription Ready',
            'A new prescription has been issued for you.',
            { type: 'medicine', event: 'medicine:prescription:issued', requestId: data?.requestId },
          );
        });

        // ── Document events ────────────────────────────────────────────────

        socketService.on('document:new', async (data: any) => {
          await handleEvent(
            'documents',
            'New Document Available',
            data?.message || 'A new document has been issued for you.',
            { type: 'document', event: 'document:new', documentId: data?.documentId, templateType: data?.templateType },
          );
        });

        socketService.on('document:approved', async (data: any) => {
          await handleEvent(
            'documents',
            'Document Approved',
            data?.message || 'Your submitted document has been approved.',
            { type: 'document', event: 'document:approved', documentId: data?.documentId },
          );
        });

        socketService.on('document:rejected', async (data: any) => {
          await handleEvent(
            'documents',
            'Document Rejected',
            data?.message || 'Your submitted document was rejected.',
            { type: 'document', event: 'document:rejected', documentId: data?.documentId },
          );
        });

        socketService.on('document:cancelled', async (data: any) => {
          await handleEvent(
            'documents',
            'Document Request Cancelled',
            data?.message || 'A document request has been cancelled.',
            { type: 'document', event: 'document:cancelled', documentId: data?.documentId },
          );
        });

        socketService.on('document:requested', async (data: any) => {
          await handleEvent(
            'documents',
            'Document Requested',
            data?.message || 'A healthcare provider requested a document from you.',
            { type: 'document', event: 'document:requested', documentId: data?.documentId },
          );
        });

        socketService.on('document:archived', async (data: any) => {
          await handleEvent(
            'documents',
            'Document Archived',
            data?.message || 'Your document was archived.',
            { type: 'document', event: 'document:archived', documentId: data?.documentId },
          );
        });

        // ── Update ticket events ────────────────────────────────────────────

        socketService.on('updateTicket:statusChanged', async (data: any) => {
          const newStatus = data?.newStatus ?? 'Updated';
          const body = data?.message ?? `Your record update request has been ${newStatus.toLowerCase()}.`;
          await handleEvent(
            'emr',
            `Record Update ${newStatus}`,
            body,
            { type: 'record', event: 'updateTicket:statusChanged', recordId: data?.recordId },
          );
        });

        // ── Staff announcements ─────────────────────────────────────────────

        socketService.on('staff:notification', async (data: any) => {
          const { title, body } = parseAnnouncementNotification(data, 'Message from Staff');

          if (body) {
            await handleEvent('general', title, body, { type: 'general', event: 'staff:notification' });
          }
        });

        socketService.on('admin:notification', async (data: any) => {
          const { title, body } = parseAnnouncementNotification(data, 'Message from Admin');

          if (body) {
            await handleEvent('general', title, body, { type: 'general', event: 'admin:notification' });
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
