import React, { useState } from 'react';
import Sidebar from './sidebar';
import TopBar from './top-bar';
import { useSettings } from '../../context/settings-context';

const Layout = ({ children, isInactive = false }) => {
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-stone-100 dark:bg-neutral-800">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isInactive={isInactive}
        compact={settings.compactSidebar}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${settings.compactSidebar ? 'md:ml-24' : 'md:ml-72'}`}>
        {/* Top Bar */}
        <TopBar onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
