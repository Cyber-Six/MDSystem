import React from 'react';
import { RefreshCw, Stethoscope } from 'lucide-react';
import { HealthChatProvider, useHealthChat } from './context/health-chat-context';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';
import FilterTabs from './components/filter-tabs';
import PatientList from './components/patient-list';
import ChatPanel from './components/chat-panel';

const HealthChatContent = () => {
  const { isConnected, refreshMessages } = useHealthChatSocket();
  const { socketError } = useHealthChat();

  const connStatus = socketError
    ? { dot: '#F59E0B', label: 'Manual refresh' }
    : isConnected
    ? { dot: '#10B981', label: 'Connected' }
    : { dot: '#F59E0B', label: 'Connecting…' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f4f2ef' }}>

      {/* ── Page header ── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{
          background: '#fdfcfa',
          borderBottom: '1px solid #e8e5e0',
        }}
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
              className="text-sm font-bold"
              style={{ color: '#1c1a17', fontFamily: 'Poppins, sans-serif', lineHeight: 1.2, margin: 0 }}
            >
              Health Chat
            </h1>
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: connStatus.dot }}
              />
              <span style={{ fontSize: '10px', color: '#a19b93', fontFamily: 'Fira Code, monospace', lineHeight: 1.2 }}>
                {connStatus.label}
              </span>
            </span>
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={refreshMessages}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ color: '#78716c', border: '1px solid #e8e5e0' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#f4f2ef';
            e.currentTarget.style.color = '#28251f';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#78716c';
          }}
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
          style={{
            width: '320px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fdfcfa',
            borderRight: '1px solid #e8e5e0',
          }}
        >
          <FilterTabs />
          <PatientList />
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ChatPanel />
        </div>

      </div>
    </div>
  );
};

const HealthChatView = () => (
  <HealthChatProvider>
    <div
      style={{
        position: 'fixed',
        top: '3.5rem',     /* matches StaffLayout top navbar height — adjust if needed */
        left: '3.75rem',   /* matches StaffLayout collapsed sidebar width */
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <HealthChatContent />
    </div>
  </HealthChatProvider>
);

export default HealthChatView;