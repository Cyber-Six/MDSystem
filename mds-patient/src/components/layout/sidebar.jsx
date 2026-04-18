import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '@core/assets/MDSystem.png';

const Sidebar = ({
  isOpen,
  onClose,
  isInactive = false,
  allowInactiveRecordUpdate = true,
}) => {
  const location = useLocation();
  const showExpandedContent = isOpen;

  const handleLogoClick = () => {
    if (typeof onClose === 'function') onClose();
    window.location.assign('/');
  };

  const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard' },
    { path: '/record-update', icon: 'edit', label: 'Record Update' },
    { path: '/appointments', icon: 'calendar', label: 'Appointment' },
    { path: '/medicine-request', icon: 'medication', label: 'Medicine Request' },
    { path: '/health-chat', icon: 'chat', label: 'Health Chat' },
    { path: '/my-documents', icon: 'documents', label: 'My Documents' },
  ];

  const icons = {
    dashboard: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    edit: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    medication: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 20.5l10-10a4.95 4.95 0 10-7-7l-10 10a4.95 4.95 0 107 7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 8.5l7 7" />
      </svg>
    ),
    chat: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    documents: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  };

  return (
    <>
      {/* Mobile Overlay - Full screen dark overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-40 md:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-primary-500 dark:bg-neutral-900 transform transition-all duration-300 ease-in-out shadow-2xl w-72 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:w-32`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-center border-b border-neutral-800/10 dark:border-white/10 bg-primary-500 dark:bg-neutral-900" style={{height: '60px'}}>
            <button
              type="button"
              onClick={handleLogoClick}
              aria-label="Go to Dashboard"
              className="flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer"
            >
              <img src={logo} alt="MDSystem" className="h-12 w-12" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto">
            {navItems.map((item) => {
              // Exact match for all paths
              const isActive = location.pathname === item.path;
              // When account is inactive, only Record Update is accessible
              const isDisabled = isInactive && (!allowInactiveRecordUpdate || item.path !== '/record-update');

              const itemClassName = `flex items-center transition-all duration-200 ${
                showExpandedContent
                  ? 'flex-row space-x-4 py-4 px-6'
                  : 'flex-col justify-center space-y-1.5 py-4'
              } ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed text-white dark:text-white/70'
                  : isActive
                    ? 'bg-white dark:bg-neutral-800 text-primary-500 dark:text-yellow-400 border-l-4 border-primary-500 dark:border-yellow-400 font-semibold'
                    : 'text-white dark:text-white/70 hover:bg-white/10 dark:hover:bg-neutral-800 hover:text-white dark:hover:text-white'
              }`;

              const itemContent = (
                <>
                  <span>{icons[item.icon]}</span>
                  <span className={`font-medium leading-tight ${showExpandedContent ? 'text-base' : 'text-sm text-center'}`}>
                    {item.label}
                  </span>
                </>
              );

              return (
                <li key={item.path}>
                  {isDisabled ? (
                    <span title={item.label} className={itemClassName}>
                      {itemContent}
                    </span>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={() => onClose()}
                      title={item.label}
                      className={itemClassName}
                    >
                      {itemContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-neutral-800/10 dark:border-white/10">
            <p className="text-[10px] text-neutral-700 dark:text-white/50 text-center leading-tight">
              © 2026 mdsystem
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
