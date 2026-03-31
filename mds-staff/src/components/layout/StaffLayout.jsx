import React, { useState, createContext, useEffect } from 'react';
import StaffSidebar from './StaffSidebar';
import StaffTopBar from './StaffTopBar';
import { useSettings } from '../../context/settings-context';

/**
 * Context for sidebar state
 */
export const SidebarContext = createContext({
  sidebarExpanded: true,
});

/**
 * Staff Layout Component
 * Main layout wrapper for staff dashboard with sidebar and topbar
 */
const StaffLayout = ({ children }) => {
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    // Check localStorage, default to true on desktop, false on mobile
    const saved = localStorage.getItem('staff_sidebar_expanded');
    if (saved !== null) return JSON.parse(saved);
    return window.innerWidth >= 768; // Default: expanded on desktop
  });

  // Sync compact sidebar setting
  useEffect(() => {
    if (settings.compactSidebar && sidebarExpanded && window.innerWidth >= 768) {
      setSidebarExpanded(false);
    }
  }, [settings.compactSidebar]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('staff_sidebar_expanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarExpanded(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebarExpand = () => setSidebarExpanded(!sidebarExpanded);

  return (
    <SidebarContext.Provider value={{ sidebarExpanded }}>
      <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Sidebar */}
        <StaffSidebar
          isOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          onClose={closeSidebar}
          onToggleExpand={toggleSidebarExpand}
        />

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 transition-[margin-left] duration-300 ${
          sidebarExpanded ? 'md:ml-56' : 'md:ml-16'
        }`}>
          {/* Top Bar */}
          <StaffTopBar
            onMenuClick={toggleSidebar}
            isSidebarOpen={sidebarOpen}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-900">
            <div className="p-4 md:p-6 max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default StaffLayout;
