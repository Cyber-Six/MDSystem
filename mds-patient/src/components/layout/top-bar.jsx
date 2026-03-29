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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePatientNotifications();

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
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
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
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <svg className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`px-4 py-3 border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer ${
                          notif.unread ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                        }`}
                      >
                        <div className="flex items-start">
                          {notif.unread && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{notif.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatRelativeTime(notif.time)}</p>
                          </div>
                        </div>
                      </div>
                    ))
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
