import React, { useState, createContext } from 'react';
import StaffSidebar from './StaffSidebar';
import StaffTopBar from './StaffTopBar';

/**
 * Context for sidebar state
 */
export const SidebarContext = createContext({
  sidebarExpanded: false,
});

/**
 * Staff Layout Component
 * Main layout wrapper for staff dashboard with sidebar and topbar
 */
const StaffLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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
