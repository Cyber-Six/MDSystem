import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserMenu from '@core/components/user-menu/user-menu';
import { logout } from '../../packages-core-adapter';
import { usePatientNotifications } from '../../modules/notification/notification-context';

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TopBar = ({ onMenuClick, isSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState('general');
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = usePatientNotifications();

  const handleNotifClick = (notif) => {
    markAsRead(notif.id);
    setShowNotifications(false);
    if (notif.route) navigate(notif.route);
  };
  const [themeMode, setThemeMode] = useState(() => {
    // Initialize from localStorage or default to 'system'
    return localStorage.getItem('patient_themeMode') || 'system';
  });
  const notifRef = useRef(null);

  // Apply theme based on mode
  useEffect(() => {
    const applyTheme = (mode) => {
      if (mode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemPrefersDark);
      } else if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(themeMode);
    localStorage.setItem('patient_themeMode', themeMode);

    // Listen for system theme changes when in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/record-update')) return 'Update Record';
    if (path.includes('/appointments')) return 'Appointment';
    if (path.includes('/medicine-request')) return 'Medicine Request';
    if (path.includes('/health-chat')) return 'Health Chat';
    if (path.includes('/my-documents')) return 'My Documents';
    if (path.includes('/dashboard') || path === '/') return 'Dashboard';
    return 'MDSystem';
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cycle through theme modes: light -> dark -> system -> light
  const toggleTheme = () => {
    setThemeMode((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Clear e-consultation session data to prevent session leakage across users
      localStorage.removeItem('econsultation_session_id');
      sessionStorage.removeItem('econsultation_initialized');
      // Clear stored role used for routing
      localStorage.removeItem('patient_role');
      localStorage.removeItem('patient_email'); // remove legacy key too

      // Call the proper logout function from token service
      // This clears tokens, calls backend logout, and navigates to /auth
      await logout(true);
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/auth';
    }
  };

  // Responsive: yellow in light mode, black in dark mode, on mobile
  return (
    <header
      className={`sticky top-0 z-30 transition-colors border-b
        md:bg-white md:dark:bg-neutral-900 md:border-gray-200 md:dark:border-neutral-700
        bg-primary-500 dark:bg-neutral-900 border-primary-600 dark:border-neutral-800
      `}
      style={{paddingLeft: 0}}
    >
      <div className="flex items-center justify-between px-4" style={{height: '60px'}}>
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Hamburger Menu */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page Title - Hidden on mobile when sidebar is closed */}
          <div className={`items-center space-x-2 ${
            isSidebarOpen ? 'hidden md:flex' : 'hidden md:flex'
          }`}>
            <div className="w-8 h-8 bg-primary-500 dark:bg-primary-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="hidden sm:block text-lg font-semibold text-gray-800 dark:text-white">{getPageTitle()}</span>
          </div>
        </div>

        {/* Center Title - Visible on mobile when sidebar is closed */}
        <div className="md:hidden absolute left-1/2 transform -translate-x-1/2">
          <span className="text-lg font-semibold text-gray-800 dark:text-white">{getPageTitle()}</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden z-50 flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between bg-gray-50 dark:bg-neutral-800/80 shrink-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-neutral-700 shrink-0 bg-white dark:bg-neutral-900">
                  {/* General tab */}
                  <button
                    onClick={() => setActiveNotifTab('general')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeNotifTab === 'general'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-500/10'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 ${
                        activeNotifTab === 'general' ? 'text-primary-500 dark:text-primary-400' : ''
                      }`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    General
                    {unreadCount > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-primary-500 text-white leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="max-h-96 overflow-y-auto flex-1">

                  {/* ── General Tab (all notifications including appointments) ── */}
                  {activeNotifTab === 'general' && (
                    notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="p-3 rounded-full bg-gray-100 dark:bg-neutral-800 mb-2">
                          <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No notifications</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-neutral-700/50">
                        {notifications.map((notif) => {
                          const isStaff = notif.type === 'general';

                          // Icon + colour per notification type
                          const typeConfig = {
                            appointment: {
                              icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ),
                              iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
                              badge: 'System',
                              badgeCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                              from: 'MDS System',
                              fromCls: 'text-blue-600 dark:text-blue-400',
                            },
                            medicine: {
                              icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              ),
                              iconBg: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
                              badge: 'System',
                              badgeCls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
                              from: 'MDS System',
                              fromCls: 'text-green-600 dark:text-green-400',
                            },
                            chat: {
                              icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                              ),
                              iconBg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
                              badge: 'System',
                              badgeCls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
                              from: 'MDS System',
                              fromCls: 'text-purple-600 dark:text-purple-400',
                            },
                            record: {
                              icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              ),
                              iconBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
                              badge: 'System',
                              badgeCls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
                              from: 'MDS System',
                              fromCls: 'text-orange-600 dark:text-orange-400',
                            },
                            general: {
                              icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              ),
                              iconBg: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400',
                              badge: 'Staff',
                              badgeCls: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
                              from: notif.from != null ? 'MDS Admin' : 'MDS Staff',
                              fromCls: notif.from != null ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400',
                            },
                          };

                          const cfg = typeConfig[notif.type] || typeConfig.general;

                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotifClick(notif)}
                              className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors ${
                                notif.unread ? 'bg-primary-50/40 dark:bg-primary-500/10' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Type icon */}
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${cfg.iconBg}`}>
                                  {cfg.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {/* Source badge + unread dot */}
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${cfg.badgeCls}`}>
                                      {cfg.badge}
                                    </span>
                                    {notif.unread && (
                                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{notif.title}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                  {isStaff && (
                                    <p className={`text-[11px] font-medium mt-0.5 ${cfg.fromCls}`}>From: {notif.senderName || cfg.from}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-500">{formatRelativeTime(notif.time)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <UserMenu 
            themeMode={themeMode}
            toggleTheme={toggleTheme}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
