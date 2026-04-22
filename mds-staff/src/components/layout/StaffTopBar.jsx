import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStaffNotifications } from '../../modules/notification/notification-context';
import { useSettings } from '../../context/settings-context';
import { usePatientTabs } from '../../context/patient-tabs-context';
import { useStaffProfile } from '../../hooks/use-staff-profile';
import { usePermissions } from '../../context/permissions-context';
import { formatBranchLabel } from '../../utils/branch-utils';
import { logoutStaffSession } from '../../services/auth-session-service';

function formatRelativeTime(iso) {
  const date = new Date(iso);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfToday.getDate() - 6); // 7-day window (Mon-Sun relative to today)

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (date >= startOfToday) {
    // Same calendar day → show time only (e.g. "2:30 PM")
    return timeStr;
  }

  if (date >= startOfThisWeek) {
    // Within the last 7 days → show day abbreviation + time (e.g. "Mon 2:30 PM")
    const dayStr = date.toLocaleDateString([], { weekday: 'short' });
    return `${dayStr} ${timeStr}`;
  }

  // Older than a week → show date (e.g. "Jan 23, 2026")
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Staff Top Bar Component
 * Contains page title, search, notifications, and user menu
 */
const StaffTopBar = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState('inventory');

  const { notifications, unreadCount, markAsRead, markAllAsRead, inventoryAlerts, markInventoryAlertsAsSeen } = useStaffNotifications();
  const { settings, updateSettings } = useSettings();
  const { profile } = useStaffProfile();
  const { isAdmin, hasPermission } = usePermissions();
  const { clearTabs } = usePatientTabs();
  const { themeMode } = settings;
  const displayUnreadCount = settings.showBadges ? unreadCount : 0;
  const displayName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || profile?.fullName || profile?.name || 'Staff Member';

  const handleNotifClick = (notif) => {
    markAsRead(notif.id);
    setShowNotifications(false);
    if (notif.route) navigate(notif.route, notif.routeState ? { state: notif.routeState } : {});
  };

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Apply theme — handled by SettingsProvider; nothing here

  // Get page title - Dashboard shows "Staff Portal", other pages show their name
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'Staff Portal';
    if (path.includes('/search')) return 'Search Patient';
    if (path.includes('/patient')) return 'Patient Record';
    if (path.includes('/pending')) return 'Pending Requests';
    if (path.includes('/appointments')) return 'Appointments';
    if (path.includes('/analytics')) return 'Analytics';
    if (path.includes('/inventory')) return 'Inventory';
    if (path.includes('/settings/roles')) return 'Administration';
    if (path.includes('/settings')) return 'Settings';
    return 'Staff Portal';
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    updateSettings((prev) => {
      const order = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(prev.themeMode) + 1) % order.length];
      return { ...prev, themeMode: next };
    });
  };

  const getThemeIcon = () => {
    if (themeMode === 'dark') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    }
    if (themeMode === 'light') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <header className="h-14 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between px-4 sticky top-0 z-20">
      {/* Left: Menu + Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-md text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <h1 className="text-base font-semibold text-secondary-800 dark:text-white leading-none m-0">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              const opening = !showNotifications;
              setShowNotifications(opening);
              if (opening && activeNotifTab === 'inventory') markInventoryAlertsAsSeen();
            }}
            className="p-1.5 rounded-md text-secondary-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {displayUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-neutral-800 leading-none">
                {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (() => {
            // Only show modules the staff has permission for
            const canSeeInventory   = isAdmin || hasPermission('inventory');
            const canSeeAppointment = isAdmin || hasPermission('appointments');
            const canSeeInventoryReqs = isAdmin || hasPermission('inventory');
            const canSeeHealthChat  = isAdmin || hasPermission('healthChat');

            const chatNotifs        = canSeeHealthChat  ? notifications.filter((n) => n.type === 'chat')        : [];
            const medicineNotifs    = canSeeInventoryReqs ? notifications.filter((n) => n.type === 'medicine')  : [];
            const generalNotifs     = notifications.filter((n) => n.type === 'general');
            const appointmentNotifs = canSeeAppointment ? notifications.filter((n) => n.type === 'appointment') : [];
            const inventoryCount    = canSeeInventory ? inventoryAlerts.length : 0;

            const chatUnread        = chatNotifs.filter((n) => n.unread).length;
            const medicineUnread    = medicineNotifs.filter((n) => n.unread).length;
            const generalUnread     = generalNotifs.filter((n) => n.unread).length;
            const appointmentUnread = appointmentNotifs.filter((n) => n.unread).length;

            // Build only the tabs the staff is permitted to see
            const allTabs = [
              canSeeAppointment && {
                key: 'appointment',
                label: 'Appointments',
                count: appointmentUnread,
                urgent: false,
                icon: (
                  <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              canSeeInventoryReqs && {
                key: 'medicine',
                label: 'Requests',
                count: medicineUnread,
                urgent: false,
                icon: (
                  <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
              canSeeInventory && {
                key: 'inventory',
                label: 'Inventory',
                count: inventoryCount,
                urgent: inventoryAlerts.some((a) => a.notificationType === 'expired' || a.notificationType === 'low-stock'),
                icon: (
                  <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
              },
              canSeeHealthChat && {
                key: 'chat',
                label: 'Health Chat',
                count: chatUnread,
                urgent: false,
                icon: (
                  <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                ),
              },
              {
                key: 'general',
                label: 'General',
                count: generalUnread,
                urgent: false,
                icon: (
                  <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                ),
              },
            ].filter(Boolean);

            // Ensure the active tab is one the staff can see; fall back gracefully
            const visibleKeys = allTabs.map((t) => t.key);
            const resolvedTab = visibleKeys.includes(activeNotifTab) ? activeNotifTab : (visibleKeys[0] ?? 'general');
            if (resolvedTab !== activeNotifTab) setActiveNotifTab(resolvedTab);

            const activeTabMeta = allTabs.find((tab) => tab.key === resolvedTab) || null;
            const activeTabUnread = activeTabMeta?.count || 0;
            const footerLabel = resolvedTab === 'chat'
              ? 'View Health Chat \u2192'
              : resolvedTab === 'medicine'
              ? 'View Requests \u2192'
              : resolvedTab === 'appointment'
              ? 'View Appointments \u2192'
              : resolvedTab === 'general'
              ? 'View General \u2192'
              : 'View Inventory \u2192';

            return (
              <div className="absolute right-0 mt-2 w-[400px] max-w-[calc(100vw-1rem)] bg-white dark:bg-neutral-800 rounded-[12px] border-[0.5px] border-neutral-200 dark:border-neutral-700 z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b-[0.5px] border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-white dark:bg-neutral-800 shrink-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">Notifications</p>
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark all read
                  </button>
                </div>

                {/* Notifications-disabled banner */}
                {!settings.channels?.web && (
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b-[0.5px] border-amber-200 dark:border-amber-700/50 shrink-0">
                    <p className="text-[11px] text-amber-700 dark:text-amber-200 font-medium">
                      Web notifications are disabled.{' '}
                      <button
                        onClick={() => { setShowNotifications(false); navigate('/settings'); }}
                        className="underline hover:text-amber-900 dark:hover:text-amber-100"
                      >
                        Enable in Settings
                      </button>
                    </p>
                  </div>
                )}

                {/* Tabs — equal-width flex row, no horizontal scroll */}
                <div className="flex border-b-[0.5px] border-neutral-200 dark:border-neutral-700 shrink-0 bg-white dark:bg-neutral-800">
                  {allTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveNotifTab(tab.key);
                        if (tab.key === 'inventory') markInventoryAlertsAsSeen();
                      }}
                      className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] px-1.5 py-2 text-[10px] font-medium transition-colors ${
                        resolvedTab === tab.key
                          ? 'text-[#BA7517] dark:text-amber-400 bg-white dark:bg-neutral-800 after:content-[\"\" ] after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#BA7517] dark:after:bg-amber-400'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <span className="relative inline-flex items-center justify-center w-[14px] h-[14px]">
                        {tab.icon}
                        {tab.count > 0 && (
                          <span className="absolute -top-[7px] -right-[10px] min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold leading-none inline-flex items-center justify-center">
                            {tab.count > 99 ? '99+' : tab.count}
                          </span>
                        )}
                      </span>
                      <span className="leading-none truncate max-w-full">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="max-h-[320px] overflow-y-auto flex-1 bg-white dark:bg-neutral-800">

                  {/* ── No permissions state ── */}
                  {allTabs.length === 1 && resolvedTab === 'general' && generalNotifs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                      <div className="p-3 mb-3 rounded-full bg-neutral-100 dark:bg-neutral-700">
                        <svg className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">No module access</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Contact your administrator to be assigned module permissions.</p>
                    </div>
                  )}

                  {/* ── Inventory Tab ── */}
                  {resolvedTab === 'inventory' && (
                    inventoryAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-2">
                          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">All clear</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">No inventory alerts at this time.</p>
                      </div>
                    ) : (
                      <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-700">
                        {inventoryAlerts.map((alert) => {
                          const isLowStock = alert.notificationType === 'low-stock';
                          const daysLeft = Number.isFinite(Number(alert.daysLeft)) ? Number(alert.daysLeft) : null;
                          const dotColor = isLowStock ? 'bg-[#BA7517]' : 'bg-red-500';
                          const label = isLowStock ? 'Low stock' : 'Expiring';
                          const quantity = Number.isFinite(Number(alert.currentQuantity)) ? Number(alert.currentQuantity) : null;
                          const location = alert.location || alert.locationName || '—';
                          const batch = alert.batchNumber ? `Batch ${alert.batchNumber}` : 'Batch —';
                          const metaLine = isLowStock
                            ? `${quantity ?? '—'} unit${quantity === 1 ? '' : 's'} · ${location} · ${batch}`
                            : `${daysLeft !== null ? (daysLeft < 0 ? `expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago` : `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`) : 'expires soon'} · ${batch} · ${location}`;
                          const rowStamp = isLowStock
                            ? 'now'
                            : daysLeft !== null
                            ? (daysLeft < 0 ? 'urgent' : `${daysLeft}d`)
                            : 'soon';

                          return (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => { setShowNotifications(false); navigate('/inventory'); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${dotColor}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-0.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate leading-tight m-0">{alert.itemName}</p>
                                      <span className={`text-[10px] font-medium px-2 py-[1px] rounded-[20px] shrink-0 ${isLowStock ? 'bg-amber-50 dark:bg-amber-950/30 text-[#BA7517] dark:text-amber-300 border border-amber-200 dark:border-amber-700/50' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700/50'}`}>
                                        {label}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{rowStamp}</span>
                                  </div>
                                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate leading-snug m-0">
                                    {metaLine}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── Appointments Tab ── */}
                  {resolvedTab === 'appointment' && (
                    appointmentNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">No new appointments</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">New patient bookings will appear here.</p>
                      </div>
                    ) : (
                      <div className="divide-y-[0.5px] divide-neutral-100 dark:divide-neutral-700">
                        {appointmentNotifs.map((notif) => (
                          <button key={notif.id} type="button" onClick={() => handleNotifClick(notif)}
                            className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${notif.unread ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate leading-tight m-0">{notif.title}</p>
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{formatRelativeTime(notif.time)}</span>
                                </div>
                                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate leading-snug m-0">{notif.message}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── Medicine Requests Tab ── */}
                  {resolvedTab === 'medicine' && (
                    medicineNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">No requests</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">No new medicine requests.</p>
                      </div>
                    ) : (
                      <div className="divide-y-[0.5px] divide-neutral-100 dark:divide-neutral-700">
                        {medicineNotifs.map((notif) => (
                          <button key={notif.id} type="button" onClick={() => handleNotifClick(notif)}
                            className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${notif.unread ? 'bg-[#BA7517]' : 'bg-neutral-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate leading-tight m-0">{notif.title}</p>
                                    <span className="text-[10px] font-medium px-2 py-[1px] rounded-[20px] bg-amber-50 dark:bg-amber-950/30 text-[#BA7517] dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 shrink-0">Request</span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{formatRelativeTime(notif.time)}</span>
                                </div>
                                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate leading-snug m-0">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── Health Chat Tab ── */}
                  {resolvedTab === 'chat' && (
                    chatNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">No messages</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">No new health chat notifications.</p>
                      </div>
                    ) : (
                      <div className="divide-y-[0.5px] divide-neutral-100 dark:divide-neutral-700">
                        {chatNotifs.map((notif) => (
                          <button key={notif.id} type="button" onClick={() => handleNotifClick(notif)}
                            className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${notif.unread ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate leading-tight m-0">{notif.title}</p>
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{formatRelativeTime(notif.time)}</span>
                                </div>
                                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate leading-snug m-0">{notif.message}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── General Tab ── */}
                  {resolvedTab === 'general' && (
                    generalNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">No announcements</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">No general notifications yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y-[0.5px] divide-neutral-100 dark:divide-neutral-700">
                        {generalNotifs.map((notif) => (
                          <button key={notif.id} type="button" onClick={() => markAsRead(notif.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${notif.unread ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate leading-tight m-0">{notif.title}</p>
                                    {notif.from && (
                                      <span className="text-[10px] font-medium px-2 py-[1px] rounded-[20px] bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-600 shrink-0">Staff</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{formatRelativeTime(notif.time)}</span>
                                </div>
                                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate leading-snug m-0">{notif.message}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t-[0.5px] border-neutral-200 dark:border-neutral-700 shrink-0 bg-white dark:bg-neutral-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      if (resolvedTab === 'general') {
                        markAllAsRead();
                      } else if (resolvedTab === 'chat') {
                        navigate('/health-chat');
                      } else if (resolvedTab === 'medicine') {
                        navigate('/inventory', { state: { section: 'dispense' } });
                      } else if (resolvedTab === 'appointment') {
                        navigate('/appointments');
                      } else {
                        navigate('/inventory');
                      }
                    }}
                    className="text-[11px] font-medium text-[#BA7517] dark:text-amber-400 hover:text-[#9a5f12] dark:hover:text-amber-300 transition-colors"
                  >
                    {footerLabel}
                  </button>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{activeTabUnread} unread</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <div className="w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {profile?.firstName?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'S'}
            </div>
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50">
              {/* User profile header with avatar */}
              <div className="flex items-center gap-2.5 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {profile?.firstName?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary-800 dark:text-white truncate leading-tight m-0" title={displayName}>
                    {displayName}
                  </p>
                  {profile?.email && (
                    <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate leading-tight mt-0.5 mb-0" title={profile.email}>
                      {profile.email}
                    </p>
                  )}
                  {(isAdmin || profile?.role || profile?.branch) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 truncate" title={isAdmin ? 'Admin' : (profile?.role ?? '')}>
                        {isAdmin ? 'Admin' : (profile?.role ?? '—')}
                      </span>
                      {profile?.branch && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300">
                          {formatBranchLabel(profile.branch)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button className="w-full px-3 py-2 text-left text-sm text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700">
                Profile
              </button>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                className="w-full px-3 py-2 text-left text-sm text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                Settings
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                className="w-full px-3 py-2 text-left text-sm text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-between"
                title={`Theme: ${themeMode}`}
              >
                <span>Theme</span>
                <span className="flex items-center gap-1 text-xs">
                  {getThemeIcon()}
                  <span className="text-secondary-400 dark:text-neutral-500 capitalize">{themeMode}</span>
                </span>
              </button>
              <div className="border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-1">
                <button 
                  onClick={async () => {
                    await logoutStaffSession({
                      redirectToAuth: true,
                      clearTabs,
                    });
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-error-600 dark:text-error-400 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default StaffTopBar;
