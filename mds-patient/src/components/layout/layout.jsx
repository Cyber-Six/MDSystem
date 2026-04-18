import React, { useState } from 'react';
import Sidebar from './sidebar';
import TopBar from './top-bar';

const Layout = ({ children, isInactive = false, allowInactiveRecordUpdate = true }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isInactive={isInactive}
        allowInactiveRecordUpdate={allowInactiveRecordUpdate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-32">
        {/* Top Bar */}
        <TopBar onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-900">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
