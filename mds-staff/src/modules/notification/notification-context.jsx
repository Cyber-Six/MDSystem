import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../packages-core-adapter';
import { fetchMedicalItems, fetchMedicineBatches, fetchSupplyBatches } from '../medical-inventory/medical-inventory-service';
import { computeItemStats } from '../medical-inventory/inventory-seed-data';

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
  'admin:notification': (data) => {
    let title = 'Announcement';
    let message = data?.message ?? 'You received a notification.';
    try {
      const parsed = JSON.parse(data?.message);
      if (parsed?.title) { title = parsed.title; message = parsed.body ?? message; }
    } catch (_) {}
    return { type: 'general', route: null, title, message, refId: data?.id ?? null, from: data?.from ?? null };
  },
  'staff:notification': (data) => {
    let title = 'Staff Message';
    let message = data?.message ?? 'You received a notification.';
    try {
      const parsed = JSON.parse(data?.message);
      if (parsed?.title) { title = parsed.title; message = parsed.body ?? message; }
    } catch (_) {}
    return { type: 'general', route: null, title, message, refId: data?.id ?? null, from: data?.from ?? null };
  },
};

// ── Inventory alert helpers ─────────────────────────────────────────────────

const EXPIRY_WARN_DAYS = 60;

function computeInventoryAlerts(enrichedItems, batches) {
  const result = [];
  const now = new Date();

  enrichedItems.forEach((item) => {
    if (!item.isLowStock) return;
    const category = item.category?.toLowerCase();
    const lowBranches = item.lowStockBranches || [];

    lowBranches.forEach(({ location, stock }) => {
      // Find all batches for this item in this location
      const batchesForThisBranch = batches.filter(
        (b) => String(b.medicalItemId) === String(item.id) && b.location === location
      );
      const batchNumbers = batchesForThisBranch.map((b) => b.batchNumber).filter(Boolean);
      const batchLabel = batchNumbers.length > 0 ? ` · Batch ${batchNumbers.join(', ')}` : '';

      result.push({
        id: `low-stock-${item.id}-${location}`,
        notificationType: 'low-stock',
        itemType: category === 'medicine' ? 'Medicine' : 'Medical Supply',
        itemId: item.id,
        batchId: null,
        itemName: item.item_name,
        location,
        detail: `${stock} unit${stock === 1 ? '' : 's'} remaining in ${location}${batchLabel}`,
        currentQuantity: stock,
        reorderLevel: item.reorder_level,
        expiryDate: null,
        daysLeft: null,
      });
    });
  });

  const itemMap = new Map(enrichedItems.map((i) => [String(i.id), i]));

  batches.forEach((batch) => {
    if (!batch.expiryDate) return;
    const expiry = new Date(batch.expiryDate);
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysLeft > EXPIRY_WARN_DAYS) return;

    const item = itemMap.get(String(batch.medicalItemId));
    const itemName = item?.item_name ?? `Item #${batch.medicalItemId}`;
    const category = item?.category?.toLowerCase();
    const itemType = category === 'medicine' ? 'Medicine' : 'Medical Supply';
    const notificationType = daysLeft < 0 ? 'expired' : 'expiring';
    const expiryLabel =
      daysLeft < 0
        ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
        : daysLeft === 0
        ? 'Expires today'
        : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

    result.push({
      id: `${notificationType}-batch-${batch.id}`,
      notificationType,
      itemType,
      itemId: batch.medicalItemId,
      batchId: batch.id,
      itemName,
      batchNumber: batch.batchNumber,
      location: batch.location,
      detail: `${expiryLabel} · Batch ${batch.batchNumber}${batch.location ? ` · ${batch.location}` : ''}`,
      currentQuantity: batch.availableQuantity ?? batch.currentQuantity ?? 0,
      reorderLevel: null,
      expiryDate: batch.expiryDate,
      daysLeft,
    });
  });

  return result;
}

const STORAGE_KEY = 'staff_notifications';
const SEEN_INVENTORY_KEY = 'staff_seen_inventory_alerts';

function loadSeenInventoryIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_INVENTORY_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeenInventoryIds(ids) {
  try {
    sessionStorage.setItem(SEEN_INVENTORY_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}
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
  const [seenInventoryIds, setSeenInventoryIds] = useState(() => loadSeenInventoryIds());
  const socketRef = useRef(null);
  const subscribersRef = useRef({});
  const fetchInventoryRef = useRef(null);

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
        console.error('[NOTIFICATION] Socket connection failed');
        return;
      }

      if (!isMounted) {
        service.disconnect();
        return;
      }

      console.log('[NOTIFICATION] Socket connected successfully');
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

      // Re-fetch inventory alerts immediately when any stock change occurs
      service.on('inventory:stock-changed', (data) => {
        console.log('[NOTIFICATION] Received inventory:stock-changed event:', data);
        if (!isMounted) {
          console.warn('[NOTIFICATION] Not mounted, ignoring event');
          return;
        }
        if (fetchInventoryRef.current) {
          console.log('[NOTIFICATION] Triggering inventory re-fetch...');
          fetchInventoryRef.current();
        } else {
          console.warn('[NOTIFICATION] fetchInventoryRef is null!');
        }
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

  const markInventoryAlertsAsSeen = useCallback(() => {
    setSeenInventoryIds((prev) => {
      const next = new Set([...prev, ...inventoryAlerts.map((a) => a.id)]);
      persistSeenInventoryIds(next);
      return next;
    });
  }, [inventoryAlerts]);

  const subscribe = useCallback((event, callback) => {
    const subs = subscribersRef.current;
    if (!subs[event]) subs[event] = new Set();
    subs[event].add(callback);
    return () => subs[event].delete(callback);
  }, []);

  // Fetch inventory data and compute alerts at the app level so they are
  // always available regardless of which page the user is currently on.
  useEffect(() => {
    let isMounted = true;

    const fetchAndComputeAlerts = async () => {
      try {
        console.log('[INVENTORY_ALERTS] Fetching items and batches...');
        const items = await fetchMedicalItems(null, 0, 500);
        const batchResults = await Promise.all(
          items.map((item) => {
            const isMedicine = item.category?.toLowerCase() === 'medicine';
            if (isMedicine) {
              return fetchMedicineBatches(Number(item.id)).then((bs) =>
                bs.map((b) => ({
                  id: b.id,
                  medicalItemId: Number(b.medicalItemId),
                  batchNumber: b.batchNumber,
                  availableQuantity: Number(b.availableQuantity ?? 0),
                  expiryDate: b.expiryDate,
                  location: b.location,
                }))
              );
            } else {
              return fetchSupplyBatches(Number(item.id)).then((bs) =>
                bs.map((b) => ({
                  id: b.id,
                  medicalItemId: Number(b.supplyItemId),
                  batchNumber: b.batchNumber,
                  availableQuantity: Number(b.currentQuantity ?? 0),
                  expiryDate: b.expiryDate,
                  location: b.location,
                }))
              );
            }
          })
        );
        const flatBatches = batchResults.flat();
        const enrichedItems = computeItemStats(items, flatBatches);
        if (!isMounted) return;
        const alerts = computeInventoryAlerts(enrichedItems, flatBatches);
        console.log('[INVENTORY_ALERTS] Computed alerts:', alerts);
        setInventoryAlerts(alerts);
        // Prune seen IDs that no longer exist so the set doesn't grow unbounded
        const currentIds = new Set(alerts.map((a) => a.id));
        setSeenInventoryIds((prev) => {
          const pruned = new Set([...prev].filter((id) => currentIds.has(id)));
          persistSeenInventoryIds(pruned);
          return pruned;
        });
      } catch (err) {
        console.warn('[Inventory notifications] Failed to fetch:', err);
      }
    };

    fetchInventoryRef.current = fetchAndComputeAlerts;
    fetchAndComputeAlerts();

    return () => {
      isMounted = false;
      fetchInventoryRef.current = null;
    };
  }, []);

  const refreshInventoryAlerts = useCallback(() => {
    if (fetchInventoryRef.current) fetchInventoryRef.current();
  }, []);

  const unseenInventoryCount = inventoryAlerts.filter((a) => !seenInventoryIds.has(a.id)).length;
  const unreadCount = notifications.filter((n) => n.unread).length + unseenInventoryCount;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, subscribe, inventoryAlerts, markInventoryAlertsAsSeen, refreshInventoryAlerts }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useStaffNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useStaffNotifications must be used inside StaffNotificationProvider');
  return ctx;
}
