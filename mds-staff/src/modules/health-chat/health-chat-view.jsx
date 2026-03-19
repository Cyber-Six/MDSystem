import React from 'react';
import { Heart } from 'lucide-react';
import { HealthChatProvider, useHealthChat } from './context/health-chat-context';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';
import FilterTabs from './components/filter-tabs';
import PatientList from './components/patient-list';
import ChatPanel from './components/chat-panel';

/**
 * Inner component that uses the context
 */
const HealthChatContent = () => {
  // Initialize socket connection
  const { isConnected } = useHealthChatSocket();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Health Chat
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {isConnected ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  Connecting...
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Messenger-like layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Patient List */}
        <div className="w-80 border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900">
          <FilterTabs />
          <PatientList />
        </div>

        {/* Right Panel - Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

/**
 * Main Health Chat View Component
 * Wrapped with HealthChatProvider for state management
 */
const HealthChatView = () => {
  return (
    <HealthChatProvider>
      <div className="h-[calc(100vh-4rem)]">
        <HealthChatContent />
      </div>
    </HealthChatProvider>
  );
};

export default HealthChatView;
