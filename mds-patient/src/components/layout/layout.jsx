import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './sidebar';
import TopBar from './top-bar';

const Layout = ({ children, isInactive = false, allowInactiveRecordUpdate = true }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('patient_sidebar_expanded');
    if (saved !== null) return JSON.parse(saved);
    if (window.innerWidth < 768) return false;
    return !location.pathname.startsWith('/settings');
  });

  useEffect(() => {
    localStorage.setItem('patient_sidebar_expanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 768 && location.pathname.startsWith('/settings')) {
      setSidebarExpanded(false);
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const toggleSidebarExpand = () => {
    setSidebarExpanded((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-stone-100 dark:bg-neutral-800">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isExpanded={sidebarExpanded}
        onClose={closeSidebar}
        onToggleExpand={toggleSidebarExpand}
        isInactive={isInactive}
        allowInactiveRecordUpdate={allowInactiveRecordUpdate}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-[margin-left] duration-300 ${
        sidebarExpanded ? 'md:ml-72' : 'md:ml-32'
      }`}>
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
