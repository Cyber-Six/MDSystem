import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '@core/assets/MDSystem.png';
import { useHealthChatBadge } from '../../modules/health-chat/hooks/use-health-chat-badge';
import { usePermissions } from '../../context/permissions-context';
import { useSettings } from '../../context/settings-context';
import { useStaffProfile } from '../../hooks/use-staff-profile';

const ALL_NAV_ITEMS = [
  { path: '/', icon: 'dashboard', label: 'Dashboard', exact: true },
  { path: '/search', icon: 'search', label: 'Search Patient', requiresSearchPatientAccess: true },
  { path: '/pending', icon: 'pending', label: 'Pending Requests', moduleId: 'pendingRequests' },
  { path: '/appointments', icon: 'calendar', label: 'Appointments', moduleId: 'appointments' },
  { path: '/inventory', icon: 'inventory', label: 'Inventory', moduleId: 'inventory' },
  { path: '/announcements', icon: 'announcements', label: 'Announcements', moduleId: 'announcements' },
  { path: '/health-chat', icon: 'healthchat', label: 'Health Chat', moduleId: 'healthChat' },
  { path: '/notifications', icon: 'notifications', label: 'Send Notification', moduleId: 'sendNotification' },
  { path: '/analytics', icon: 'analytics', label: 'Analytics', moduleId: 'analytics' },
  { path: '/settings/roles', icon: 'roles', label: 'Administration', adminOnly: true },
];

/**
 * Staff Sidebar Navigation Component
 * Compact, collapsible sidebar for staff dashboard
 */
const StaffSidebar = ({ isOpen, isExpanded, onClose, onToggleExpand }) => {
  const location = useLocation();
  const shouldFetchHealthChatBadge = location.pathname.startsWith('/health-chat');
  const pendingChatCount = useHealthChatBadge({ enabled: shouldFetchHealthChatBadge });
  const { hasPermission, hasSearchPatientAccess, isAdmin, isLoading } = usePermissions();
  const { settings } = useSettings();
  const showBadges = settings.showBadges;
  const { profile } = useStaffProfile();

  const handleLogoClick = () => {
    if (typeof onClose === 'function') onClose();
    window.location.assign('/');
  };

  const navItems = useMemo(() => {
    if (isLoading) return ALL_NAV_ITEMS.filter((item) => !item.moduleId && !item.adminOnly && !item.requiresSearchPatientAccess);
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.adminOnly) return isAdmin;
      if (item.requiresSearchPatientAccess) return hasSearchPatientAccess;
      if (item.moduleId) return hasPermission(item.moduleId);
      return true; // Dashboard always visible
    });
  }, [isLoading, isAdmin, hasPermission, hasSearchPatientAccess]);

  const icons = {
    dashboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    search: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    pending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    healthchat: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    analytics: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    inventory: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    roles: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    announcements: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    notifications: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  };

  const isActive = (item) => {
    if (item.exact) {
      // Handle both /staff and /staff/ (trailing slash)
      return location.pathname === item.path || location.pathname === item.path + '/';
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 transform transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isExpanded ? 'w-56' : 'w-16'} md:translate-x-0`}
      >
        {/* Logo Section */}
        <div className="h-14 flex items-center justify-center border-b border-neutral-200 dark:border-neutral-700 px-2">
          <button
            type="button"
            onClick={handleLogoClick}
            aria-label="Go to Dashboard"
            className="flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer"
          >
            <img src={logo} alt="MDSystem" className="h-8 w-8" />
          </button>
          {isExpanded && (
            <span className="ml-2 font-semibold text-secondary-800 dark:text-white text-sm">
              MDS Staff
            </span>
          )}
        </div>

        {/* Expand/Collapse Button (Desktop) */}
        <button
          onClick={onToggleExpand}
          className="hidden md:flex absolute -right-3 top-16 w-6 h-6 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-full items-center justify-center shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
        >
          <svg 
            className={`w-3 h-3 text-neutral-600 dark:text-neutral-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <ul className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  title={item.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors no-underline hover:no-underline ${
                    isActive(item)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-secondary-700 dark:text-primary-400 hover:text-secondary-700 dark:hover:text-primary-400'
                      : 'text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-secondary-600 dark:hover:text-neutral-300'
                  }`}
                >
                  <span className="flex-shrink-0 relative">
                    {icons[item.icon]}
                    {item.icon === 'healthchat' && showBadges && pendingChatCount > 0 && !isExpanded && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                        {pendingChatCount > 99 ? '99+' : pendingChatCount}
                      </span>
                    )}
                  </span>
                  {isExpanded && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {isExpanded && item.icon === 'healthchat' && showBadges && pendingChatCount > 0 && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                      {pendingChatCount > 99 ? '99+' : pendingChatCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - User Info */}
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-2">
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer justify-center`}>
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {profile?.firstName?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'S'}
            </div>
            {isExpanded && (
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0 break-all"
                  title={profile?.email ?? ''}
                >
                  {profile?.email ?? '—'}
                </p>
                <p
                  className="text-xs text-secondary-500 dark:text-neutral-400 leading-none m-0 mt-0.5 break-all"
                  title={isAdmin ? 'Admin' : (profile?.role ?? '')}
                >
                  {isAdmin ? 'Admin' : (profile?.role ?? '—')}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default StaffSidebar;
