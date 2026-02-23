import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../../../assets/MDSystem.png';

/**
 * Staff Sidebar Navigation Component
 * Compact, collapsible sidebar for staff dashboard
 */
const StaffSidebar = ({ isOpen, isExpanded, onClose, onToggleExpand }) => {
  const location = useLocation();

  const navItems = [
    { path: '/staff', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/staff/search', icon: 'search', label: 'Search Patient' },
    { path: '/staff/pending', icon: 'pending', label: 'Pending Requests' },
    { path: '/staff/appointments', icon: 'calendar', label: 'Appointments' },
    { path: '/staff/analytics', icon: 'analytics', label: 'Analytics' },
    { path: '/staff/inventory', icon: 'inventory', label: 'Inventory' },
    { path: '/staff/settings/roles', icon: 'roles', label: 'Role Management' },
  ];

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
  };

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
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
          <img src={logo} alt="MDSystem" className="h-8 w-8" />
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
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  title={item.label}
                  className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  <span className="flex-shrink-0">{icons[item.icon]}</span>
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - User Info */}
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-2">
          <div className={`flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer ${
            isExpanded ? '' : 'justify-center'
          }`}>
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              DR
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-secondary-800 dark:text-white truncate">
                  Dr. Staff
                </p>
                <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate">
                  Medical Doctor
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
