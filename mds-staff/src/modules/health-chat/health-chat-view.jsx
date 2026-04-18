import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Stethoscope } from 'lucide-react';
import { HealthChatProvider, useHealthChat } from './context/health-chat-context';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';
import FilterTabs from './components/filter-tabs';
import PatientList from './components/patient-list';
import ChatPanel from './components/chat-panel';
import { SidebarContext } from '../../components/layout/StaffLayout';

const DEFAULT_LIST_WIDTH = 320;
const MIN_LIST_WIDTH = 220;
const MAX_LIST_WIDTH = 520;
const MIN_CHAT_WIDTH = 360;
const LIST_WIDTH_STORAGE_KEY = 'mds-staff-health-chat-list-width';

const HealthChatContent = () => {
  const { isConnected, emitTyping } = useHealthChatSocket();
  const { socketError, refreshMessages, selectChat, conversations } = useHealthChat();
  const { state } = useLocation();
  const layoutRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH);

  const getClampedListWidth = useCallback((rawWidth) => {
    const containerWidth = layoutRef.current?.getBoundingClientRect().width;
    if (!containerWidth || Number.isNaN(containerWidth)) {
      return Math.min(Math.max(rawWidth, MIN_LIST_WIDTH), MAX_LIST_WIDTH);
    }

    const maxBasedOnContainer = Math.max(MIN_LIST_WIDTH, containerWidth - MIN_CHAT_WIDTH);
    const hardMax = Math.min(MAX_LIST_WIDTH, maxBasedOnContainer);
    return Math.min(Math.max(rawWidth, MIN_LIST_WIDTH), hardMax);
  }, []);

  const handleResizeStart = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeWithKeyboard = useCallback((event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const delta = event.key === 'ArrowLeft' ? -20 : 20;
    setListWidth(prev => getClampedListWidth(prev + delta));
  }, [getClampedListWidth]);

  useEffect(() => {
    const raw = window.localStorage.getItem(LIST_WIDTH_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setListWidth(parsed);
    }
  }, []);

  useEffect(() => {
    const syncToViewport = () => {
      setListWidth(prev => getClampedListWidth(prev));
    };

    syncToViewport();
    window.addEventListener('resize', syncToViewport);
    return () => window.removeEventListener('resize', syncToViewport);
  }, [getClampedListWidth]);

  useEffect(() => {
    window.localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(Math.round(listWidth)));
  }, [listWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event) => {
      if (!layoutRef.current) return;
      const bounds = layoutRef.current.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      setListWidth(getClampedListWidth(nextWidth));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isResizing, getClampedListWidth]);

  // If we arrived here via a notification click that included a chatId,
  // auto-select that conversation once the list has loaded.
  useEffect(() => {
    const chatId = state?.chatId;
    if (!chatId || conversations.length === 0) return;
    selectChat(chatId);
    // Only fire once per navigation (state won't change while on this route)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.chatId, conversations.length > 0]);

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
      <div ref={layoutRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left panel */}
        <div
          className="bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700"
          style={{
            width: `${listWidth}px`,
            minWidth: `${MIN_LIST_WIDTH}px`,
            maxWidth: `${MAX_LIST_WIDTH}px`,
            flexShrink: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <FilterTabs />
          <PatientList />
        </div>

        {/* Resizer */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize conversation list"
          aria-valuemin={MIN_LIST_WIDTH}
          aria-valuemax={MAX_LIST_WIDTH}
          aria-valuenow={Math.round(listWidth)}
          tabIndex={0}
          onPointerDown={handleResizeStart}
          onKeyDown={handleResizeWithKeyboard}
          className="group flex-shrink-0 bg-white dark:bg-neutral-900 focus:outline-none"
          style={{
            width: '12px',
            cursor: 'col-resize',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            touchAction: 'none',
          }}
        >
          <div
            className="h-full transition-colors"
            style={{
              width: '2px',
              backgroundColor: isResizing
                ? '#f4c430'
                : 'rgba(115, 115, 115, 0.45)',
            }}
          />
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: `${MIN_CHAT_WIDTH}px` }}>
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