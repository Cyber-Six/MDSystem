import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../packages-core-adapter';

/**
 * Patient notification events emitted by the backend to this user.
 * Each entry maps a socket event name to a notification factory.
 */
const EVENT_MAP = {
  'appointment:responded': (data) => ({
    type: 'appointment',
    route: '/appointments',
    title: `Appointment ${data?.status === 'Approved' ? 'Confirmed' : data?.status ?? 'Updated'}`,
    message: data?.notes
      ? `Your appointment has been ${(data?.status ?? '').toLowerCase()}. Note: ${data.notes}`
      : `Your appointment has been ${(data?.status ?? '').toLowerCase()}.`,
  }),
  'appointment:attendance-recorded': () => ({
    type: 'appointment',
    route: '/appointments',
    title: 'Attendance Recorded',
    message: 'Your visit attendance has been recorded.',
  }),
  'healthchat:new-message': (data) => ({
    type: 'chat',
    route: '/health-chat',
    title: 'New Message',
    message: data?.message?.content
      ? `Doctor: ${String(data.message.content).slice(0, 80)}`
      : 'You have a new message from your doctor.',
  }),
  'healthchat:ticket-approved': () => ({
    type: 'chat',
    route: '/health-chat',
    title: 'Health Chat Approved',
    message: 'Your health chat request has been approved.',
  }),
  'healthchat:ticket-rejected': () => ({
    type: 'chat',
    route: '/health-chat',
    title: 'Health Chat Declined',
    message: 'Your health chat request was declined.',
  }),
  'healthchat:ticket-closed': () => ({
    type: 'chat',
    route: '/health-chat',
    title: 'Chat Session Closed',
    message: 'Your health chat session has been closed.',
  }),
  'medicine:request:approved': () => ({
    type: 'medicine',
    route: '/medicine-request',
    title: 'Medicine Request Approved',
    message: 'Your medicine request has been approved.',
  }),
  'medicine:request:rejected': () => ({
    type: 'medicine',
    route: '/medicine-request',
    title: 'Medicine Request Declined',
    message: 'Your medicine request was declined.',
  }),
  'medicine:request:pending': () => ({
    type: 'medicine',
    route: '/medicine-request',
    title: 'Medicine Request Received',
    message: 'Your medicine request is now being processed.',
  }),
  'medicine:prescription:issued': () => ({
    type: 'medicine',
    route: '/medicine-request',
    title: 'Prescription Ready',
    message: 'A new prescription has been issued for you.',
  }),
  'document:new': (data) => ({
    type: 'document',
    route: '/my-documents',
    title: 'New Document Available',
    message: data?.message || `A new ${data?.templateType || 'document'} has been issued for you.`,
  }),
  'document:requested': (data) => ({
    type: 'document',
    route: '/my-documents',
    title: 'Document Requested',
    message: data?.notes 
      ? `${data?.label || 'A document'}\nNote: ${data.notes}`
      : `${data?.label || 'A document'}`,
    refId: data?.documentId ?? null,
  }),
  'document:approved': (data) => ({
    type: 'document',
    route: '/my-documents',
    title: 'Document Approved',
    message: data?.message || (data?.notes
      ? `Your submitted document "${data?.label}" has been approved. Note: ${data.notes}`
      : `Your submitted document "${data?.label}" has been approved.`),
    refId: data?.documentId ?? null,
  }),
  'document:rejected': (data) => ({
    type: 'document',
    route: '/my-documents',
    title: 'Document Rejected',
    message: data?.message || (data?.notes
      ? `Your document "${data?.label}" was rejected. Reason: ${data.notes}`
      : `Your document "${data?.label}" was rejected. Please resubmit.`),
    refId: data?.documentId ?? null,
  }),
  'document:cancelled': (data) => ({
    type: 'document',
    route: '/my-documents',
    title: 'Document Request Cancelled',
    message: data?.message || `The request for "${data?.label || 'a document'}" has been cancelled.`,
    refId: data?.documentId ?? null,
  }),
  'updateTicket:statusChanged': (data) => ({
    type: 'record',
    route: '/record-update',
    title: `Record Update ${data?.newStatus ?? 'Updated'}`,
    message: data?.message ?? `Your record update request has been ${(data?.newStatus ?? '').toLowerCase()}.`,
  }),
  'staff:notification': (data) => {
    // Parse message field which may contain JSON with title and body
    let title = 'Message from Staff';
    let message = '';
    
    if (data?.message) {
      // Try to parse as JSON first
      if (typeof data.message === 'string' && data.message.startsWith('{')) {
        try {
          const parsed = JSON.parse(data.message);
          title = parsed.title || title;
          message = parsed.body || '';
        } catch {
          // If parsing fails, use message as-is
          message = data.message;
        }
      } else {
        message = data.message;
      }
    }
    
    // Include sender name if available
    const senderName = data?.fromName || 'Staff Member';
    
    return {
      type: 'general',
      route: null, // No specific route for general notifications
      title: title,
      message: message,
      senderName: senderName, // Include sender information
    };
  },
};

const STORAGE_KEY = 'patient_notifications';
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

/** @type {React.Context} */
const NotificationContext = createContext(null);

export function PatientNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => loadPersistedNotifications());
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

  // Connect socket and subscribe to all patient notification events
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
        // Auth failed or network error — bail out silently
        return;
      }

      if (!isMounted) {
        service.disconnect();
        return;
      }

      socketRef.current = service;

      // Join the user's branch room to receive branch-scoped events
      service.emit('notification:join-branch', {});

      // Subscribe to all patient notification events
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

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, subscribe }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function usePatientNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('usePatientNotifications must be used inside PatientNotificationProvider');
  return ctx;
}
