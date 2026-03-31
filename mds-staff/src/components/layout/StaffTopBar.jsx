import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../packages-core-adapter';
import { useStaffNotifications } from '../../modules/notification/notification-context';
import { useSettings } from '../../context/settings-context';

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Staff Top Bar Component
 * Contains page title, search, notifications, and user menu
 */
const StaffTopBar = ({ onMenuClick, isSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState('inventory');

  const { notifications, unreadCount, markAsRead, markAllAsRead, inventoryAlerts, markInventoryAlertsAsSeen } = useStaffNotifications();
  const { settings, updateSettings } = useSettings();
  const { themeMode } = settings;
  const displayUnreadCount = settings.showBadges ? unreadCount : 0;

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
    if (path.includes('/settings/roles')) return 'Role Management';
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
            const chatNotifs = notifications.filter((n) => n.type === 'chat');
            const medicineNotifs = notifications.filter((n) => n.type === 'medicine');
            const generalNotifs = notifications.filter((n) => n.type === 'general');
            const chatUnread = chatNotifs.filter((n) => n.unread).length;
            const medicineUnread = medicineNotifs.filter((n) => n.unread).length;
            const generalUnread = generalNotifs.filter((n) => n.unread).length;
            const inventoryCount = inventoryAlerts.length;

            const tabs = [
              {
                key: 'inventory',
                label: 'Inventory',
                count: inventoryCount,
                urgent: inventoryAlerts.some((a) => a.notificationType === 'expired' || a.notificationType === 'low-stock'),
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
              },
              {
                key: 'medicine',
                label: 'Requests',
                count: medicineUnread,
                urgent: false,
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
              {
                key: 'chat',
                label: 'Health Chat',
                count: chatUnread,
                urgent: false,
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                ),
              },
            ];

            return (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/80 shrink-0">
                  <p className="text-sm font-bold text-secondary-800 dark:text-white">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-neutral-200 dark:border-neutral-700 shrink-0 bg-white dark:bg-neutral-800">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveNotifTab(tab.key);
                        if (tab.key === 'inventory') markInventoryAlertsAsSeen();
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                        activeNotifTab === tab.key
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
                          : 'border-transparent text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                      }`}
                    >
                      <span className={activeNotifTab === tab.key ? 'text-primary-500 dark:text-primary-400' : ''}>{tab.icon}</span>
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                          tab.urgent
                            ? 'bg-error-500 text-white'
                            : 'bg-primary-500 text-white'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="max-h-80 overflow-y-auto flex-1">

                  {/* ── Inventory Tab ── */}
                  {activeNotifTab === 'inventory' && (
                    inventoryAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="p-3 rounded-full bg-success-100 dark:bg-success-900/30 mb-2">
                          <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">All clear</p>
                        <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">No inventory alerts at this time.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {inventoryAlerts.map((alert) => {
                          const isLowStock = alert.notificationType === 'low-stock';
                          const isExpired = alert.notificationType === 'expired';
                          const dotColor = isExpired ? 'bg-error-500' : isLowStock ? 'bg-warning-500' : 'bg-primary-500';
                          const labelColor = isExpired
                            ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                            : isLowStock
                            ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
                          const rowBg = isExpired
                            ? 'bg-error-50/40 dark:bg-error-900/10'
                            : isLowStock
                            ? 'bg-warning-50/40 dark:bg-warning-900/10'
                            : '';
                          const label = isExpired ? 'Expired' : isLowStock ? 'Low Stock' : 'Expiring Soon';

                          return (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => { setShowNotifications(false); navigate('/inventory'); }}
                              className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors ${rowBg}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">{alert.itemName}</p>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${labelColor}`}>{label}</span>
                                  </div>
                                  <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{alert.detail}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── Medicine Requests Tab ── */}
                  {activeNotifTab === 'medicine' && (
                    medicineNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">No requests</p>
                        <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">No new medicine requests.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {medicineNotifs.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => { handleNotifClick(notif); }}
                            className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors ${notif.unread ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''}`}
                          >
                            <div className="flex items-start gap-2.5">
                              {notif.unread && <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-primary-500" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">{notif.title}</p>
                                  {notif.location && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 shrink-0">{notif.location}</span>
                                  )}
                                </div>
                                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">Pending</span>
                                  <p className="text-[11px] text-secondary-400 dark:text-neutral-500">{formatRelativeTime(notif.time)}</p>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── Health Chat Tab ── */}
                  {activeNotifTab === 'chat' && (
                    chatNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">No messages</p>
                        <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">No new health chat notifications.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {chatNotifs.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => { handleNotifClick(notif); }}
                            className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors ${notif.unread ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''}`}
                          >
                            <div className="flex items-start gap-2.5">
                              {notif.unread && <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-primary-500" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">{notif.title}</p>
                                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-1">{formatRelativeTime(notif.time)}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── General Tab ── */}
                  {activeNotifTab === 'general' && (
                    generalNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-700 mb-2">
                          <svg className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">No announcements</p>
                        <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">No general notifications yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {generalNotifs.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => { markAsRead(notif.id); }}
                            className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors ${notif.unread ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''}`}
                          >
                            <div className="flex items-start gap-2.5">
                              {notif.unread && <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-primary-500" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">{notif.title}</p>
                                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-1">{formatRelativeTime(notif.time)}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 shrink-0 bg-neutral-50 dark:bg-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeNotifTab === 'general') {
                        markAllAsRead();
                        setShowNotifications(false);
                      } else {
                        setShowNotifications(false);
                        if (activeNotifTab === 'chat') {
                          navigate('/health-chat');
                        } else if (activeNotifTab === 'medicine') {
                          navigate('/inventory', { state: { section: 'dispense' } });
                        } else {
                          navigate('/inventory');
                        }
                      }
                    }}
                    className="w-full text-center text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    {activeNotifTab === 'chat'
                      ? 'Go to Health Chat →'
                      : activeNotifTab === 'medicine'
                      ? 'Go to Request Tab →'
                      : activeNotifTab === 'general'
                      ? 'Dismiss announcements'
                      : 'Go to Inventory →'
                    }
                  </button>
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
              DR
            </div>
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50">
              <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-secondary-800 dark:text-white">Dr. Staff</p>
                <p className="text-xs text-secondary-500 dark:text-neutral-400">Medical Doctor</p>
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
                    try { await logout(true); } catch { window.location.href = '/auth'; }
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
