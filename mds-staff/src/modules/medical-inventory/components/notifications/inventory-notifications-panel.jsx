import React, { useRef, useEffect, useState } from 'react';

// ── Icons ────────────────────────────────────────────────────────────────────

const BellIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const LowStockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const ExpiryIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-3 h-3 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// ── Notification Row ─────────────────────────────────────────────────────────

const NotificationRow = ({ notification, onClick }) => {
  const isLowStock = notification.notificationType === 'low-stock';
  const isExpired = notification.notificationType === 'expired';

  const rowColor = isExpired
    ? 'border-l-error-500 bg-error-50/50 dark:bg-error-900/10 hover:bg-error-50 dark:hover:bg-error-900/20'
    : isLowStock
    ? 'border-l-warning-500 bg-warning-50/50 dark:bg-warning-900/10 hover:bg-warning-50 dark:hover:bg-warning-900/20'
    : 'border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-50 dark:hover:bg-primary-900/20';

  const typeBadgeColor = isExpired
    ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
    : isLowStock
    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
    : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';

  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-l-2 transition-colors duration-100 ${rowColor}`}
    >
      <div className={`mt-0.5 shrink-0 p-1 rounded ${typeBadgeColor}`}>
        {isLowStock ? <LowStockIcon /> : <ExpiryIcon />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-secondary-800 dark:text-white truncate">
            {notification.itemName}
          </span>
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${typeBadgeColor}`}>
            {notification.itemType}
          </span>
        </div>

        <p className="text-[11px] text-secondary-500 dark:text-neutral-400 mt-0.5 leading-snug">
          {notification.detail}
        </p>

        {!isLowStock && notification.expiryDate && (
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-0.5">
            Expiry: {formatDate(notification.expiryDate)}
            {notification.currentQuantity > 0 && ` · ${notification.currentQuantity} unit${notification.currentQuantity === 1 ? '' : 's'} affected`}
          </p>
        )}
      </div>

      <ChevronRightIcon />
    </button>
  );
};

// ── Group Section ─────────────────────────────────────────────────────────────

const GroupSection = ({ title, icon, count, colorClass, notifications, onNotificationClick, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-750 border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className={`p-0.5 rounded ${colorClass}`}>{icon}</span>
          <span className="text-[11px] font-semibold text-secondary-700 dark:text-neutral-300 uppercase tracking-wide">
            {title}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}`}>
            {count}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onClick={onNotificationClick} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

/**
 * InventoryNotificationsPanel
 *
 * Renders a bell-icon trigger button; clicking it opens a dropdown panel that
 * lists inventory notifications grouped by type (Low Stock / Expiring / Expired).
 *
 * Props:
 *   grouped  — { lowStock: [], expiring: [], expired: [] }
 *   counts   — { lowStock, expiring, expired, total }
 *   onSelectItem(item) — called with { id: itemId } to navigate to item detail
 *   onNavigate(section) — called with a section key to switch tabs
 */
const InventoryNotificationsPanel = ({ grouped, counts, onSelectItem, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleNotificationClick = (notification) => {
    setOpen(false);
    // Navigate to the item detail view
    onSelectItem({ id: notification.itemId });
  };

  const urgentCount = counts.expired + counts.lowStock;
  const hasAny = counts.total > 0;

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Inventory alerts: ${counts.total}`}
        className={`relative p-1.5 rounded-lg transition-colors ${
          open
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
        }`}
      >
        <BellIcon className="w-5 h-5" />
        {hasAny && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full text-white ${
              urgentCount > 0 ? 'bg-error-500' : 'bg-warning-500'
            }`}
          >
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 max-h-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden flex flex-col z-50">
          {/* Panel header */}
          <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs font-bold text-secondary-800 dark:text-white leading-none">
                Inventory Alerts
              </p>
              {hasAny ? (
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-0.5">
                  {counts.total} alert{counts.total === 1 ? '' : 's'} require attention
                </p>
              ) : (
                <p className="text-[10px] text-success-600 dark:text-success-400 mt-0.5">
                  All items are in good standing
                </p>
              )}
            </div>

            {/* Summary badges */}
            {hasAny && (
              <div className="flex gap-1 ml-2">
                {counts.lowStock > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">
                    {counts.lowStock} low
                  </span>
                )}
                {counts.expiring > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                    {counts.expiring} soon
                  </span>
                )}
                {counts.expired > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400">
                    {counts.expired} expired
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Scrollable notification list */}
          <div className="overflow-y-auto flex-1 divide-y divide-neutral-100 dark:divide-neutral-800">
            {!hasAny ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="p-3 rounded-full bg-success-100 dark:bg-success-900/30 mb-3">
                  <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">No alerts</p>
                <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-1">
                  All inventory items have adequate stock and no expiring batches.
                </p>
              </div>
            ) : (
              <>
                <GroupSection
                  title="Low Stock"
                  icon={<LowStockIcon />}
                  count={counts.lowStock}
                  colorClass="bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400"
                  notifications={grouped.lowStock}
                  onNotificationClick={handleNotificationClick}
                  defaultOpen
                />
                <GroupSection
                  title="Expired"
                  icon={<ExpiryIcon />}
                  count={counts.expired}
                  colorClass="bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400"
                  notifications={grouped.expired}
                  onNotificationClick={handleNotificationClick}
                  defaultOpen
                />
                <GroupSection
                  title="Expiring Soon"
                  icon={<ExpiryIcon />}
                  count={counts.expiring}
                  colorClass="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                  notifications={grouped.expiring}
                  onNotificationClick={handleNotificationClick}
                  defaultOpen={counts.expired === 0}
                />
              </>
            )}
          </div>

          {/* Footer */}
          {hasAny && (
            <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 shrink-0">
              <button
                type="button"
                onClick={() => { setOpen(false); onNavigate('items'); }}
                className="w-full text-center text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                View all items →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryNotificationsPanel;
