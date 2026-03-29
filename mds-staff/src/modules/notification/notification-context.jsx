import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../packages-core-adapter';

/**
 * Staff notification events emitted by the backend.
 *
 * Role-room events ('role:medical') — received automatically because the
 * socket server auto-joins every user to `role:${userRole}` on connect:
 *   healthchat:ticket-created    — new patient chat request
 *   healthchat:new-message       — new message in a chat
 *   healthchat:ticket-closed     — chat closed by patient
 *   healthchat:ticket-status-changed — ticket status changed
 *
 * Branch-room events — received after the client emits notification:join-branch:
 *   appointment:submitted        — patient submitted an appointment
 *   medicine:request:new         — patient submitted a medicine request
 *   updateTicket                 — patient submitted a record-update ticket
 */
const EVENT_MAP = {
  'healthchat:ticket-created': (data) => ({
    type: 'chat',
    route: '/health-chat',
    title: 'New Chat Request',
    message: 'A patient submitted a new health chat request.',
    refId: data?.chat?.id ?? null,
  }),
  'healthchat:new-message': (data) => ({
    type: 'chat',
    route: '/health-chat',
    title: 'New Chat Message',
    message: data?.message?.content
      ? `Patient: ${String(data.message.content).slice(0, 80)}`
      : 'A patient sent a new message.',
    refId: data?.chatId ?? data?.chat?.id ?? null,
  }),
  'healthchat:ticket-closed': (data) => ({
    type: 'chat',
    route: '/health-chat',
    title: 'Chat Session Closed',
    message: 'A health chat session has been closed.',
    refId: data?.chat?.id ?? null,
  }),
  'healthchat:ticket-status-changed': (data) => ({
    type: 'chat',
    route: '/health-chat',
    title: 'Chat Ticket Updated',
    message: `A health chat ticket is now ${(data?.status ?? '').toLowerCase() || 'updated'}.`,
    refId: data?.chat?.id ?? null,
  }),
  'appointment:submitted': (data) => ({
    type: 'appointment',
    route: '/appointments',
    title: 'New Appointment Request',
    message: `A patient submitted an appointment request${data?.date ? ` for ${data.date}` : ''}.`,
    refId: data?.slotId ?? null,
  }),
  'medicine:request:new': (data) => ({
    type: 'medicine',
    route: '/inventory',
    routeState: { section: 'dispense' },
    title: 'New Medicine Request',
    message: [
      data?.patientId ? `Patient #${data.patientId}` : null,
      data?.location ? `at ${data.location}` : null,
      'submitted a new medicine request.',
    ].filter(Boolean).join(' '),
    refId: data?.requestId ?? null,
    patientId: data?.patientId ?? null,
    location: data?.location ?? null,
  }),
  'updateTicket': (data) => ({
    type: 'record',
    route: '/pending',
    title: 'Record Update Request',
    message: 'A patient submitted a record update request.',
    refId: data?.recordId ?? null,
  }),
};

const STORAGE_KEY = 'staff_notifications';
const MAX_NOTIFICATIONS = 50;

function loadPersistedNotifications() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistNotifications(notifications) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // sessionStorage full — silently skip
  }
}

const NotificationContext = createContext(null);

export function StaffNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => loadPersistedNotifications());
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const socketRef = useRef(null);
  const subscribersRef = useRef({});

  const addNotification = useCallback((event, data) => {
    const factory = EVENT_MAP[event];
    if (!factory) return;

    const notif = factory(data);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...notif,
      time: new Date().toISOString(),
      unread: true,
    };

    setNotifications((prev) => {
      const next = [entry, ...prev].slice(0, MAX_NOTIFICATIONS);
      persistNotifications(next);
      return next;
    });
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, unread: false } : n));
      persistNotifications(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, unread: false }));
      persistNotifications(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Connect socket and subscribe to all staff notification events
  useEffect(() => {
    let isMounted = true;
    let service = null;

    const connect = async () => {
      service = createSocketService({
        getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
        getToken: () => tokenService.TokenStorage.getAccessToken(),
        onAuthError: async () => { await tokenService.refreshAccessToken(); },
        options: {
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
        },
      });

      try {
        await service.connect();
      } catch {
        return;
      }

      if (!isMounted) {
        service.disconnect();
        return;
      }

      socketRef.current = service;

      // Join the staff member's branch room so they receive branch-scoped events
      // (appointment:submitted, medicine:request:new, updateTicket)
      service.emit('notification:join-branch', {});

      // Subscribe to all staff notification events
      Object.keys(EVENT_MAP).forEach((event) => {
        service.on(event, (data) => {
          if (!isMounted) return;
          addNotification(event, data);
          const subs = subscribersRef.current[event];
          if (subs) subs.forEach((cb) => cb(data));
        });
      });
    };

    connect();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = useCallback((event, callback) => {
    const subs = subscribersRef.current;
    if (!subs[event]) subs[event] = new Set();
    subs[event].add(callback);
    return () => subs[event].delete(callback);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length + inventoryAlerts.length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, subscribe, inventoryAlerts, setInventoryAlerts }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useStaffNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useStaffNotifications must be used inside StaffNotificationProvider');
  return ctx;
}
