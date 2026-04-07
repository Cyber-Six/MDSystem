import React, { useContext } from 'react';
import { RefreshCw, Stethoscope } from 'lucide-react';
import { HealthChatProvider, useHealthChat } from './context/health-chat-context';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';
import FilterTabs from './components/filter-tabs';
import PatientList from './components/patient-list';
import ChatPanel from './components/chat-panel';
import { SidebarContext } from '../../components/layout/StaffLayout';

const HealthChatContent = () => {
  const { isConnected, emitTyping } = useHealthChatSocket();
  const { socketError, refreshMessages } = useHealthChat();

  const connStatus = socketError
    ? { dot: '#F59E0B', label: 'Manual refresh' }
    : isConnected
    ? { dot: '#10B981', label: 'Connected' }
    : { dot: '#F59E0B', label: 'Connecting…' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="bg-neutral-100 dark:bg-neutral-800">

      {/* ── Page header ── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#f4c430' }}
          >
            <Stethoscope className="w-4 h-4" style={{ color: '#1c1a17' }} />
          </div>

          {/* Title + status — explicit line-heights, no leading-none */}
          <div className="flex flex-col justify-center" style={{ gap: '3px' }}>
            <h1
              className="text-sm font-bold text-secondary-900 dark:text-white"
              style={{ fontFamily: 'Poppins, sans-serif', lineHeight: 1.2, margin: 0 }}
            >
              Health Chat
            </h1>
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: connStatus.dot }}
              />
              <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: '10px', fontFamily: 'Fira Code, monospace', lineHeight: 1.2 }}>
                {connStatus.label}
              </span>
            </span>
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={refreshMessages}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                     text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700
                     hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Refresh all messages"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Messenger layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left panel */}
        <div
          className="bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700"
          style={{
            width: '320px',
            minWidth: '220px',
            flexShrink: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <FilterTabs />
          <PatientList />
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: '280px' }}>
          <ChatPanel emitTyping={emitTyping} />
        </div>

      </div>
    </div>
  );
};

const HealthChatView = () => {
  const { sidebarExpanded } = useContext(SidebarContext);

  // Calculate left position based on sidebar state
  const leftPosition = sidebarExpanded ? '14rem' : '3.75rem'; // 224px when expanded, 60px when collapsed

  return (
    <HealthChatProvider>
      <div
        style={{
          position: 'fixed',
          top: '3.5rem',     /* matches StaffLayout top navbar height — adjust if needed */
          left: leftPosition,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 5,
          transition: 'left 300ms ease-in-out',
        }}
      >
        <HealthChatContent />
      </div>
    </HealthChatProvider>
  );
};

export default HealthChatView;