import React, { useEffect, useRef } from 'react';
import { Loader2, User, RefreshCw } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import ChatHeader from './chat-header';
import MessageBubble from './message-bubble';
import MessageInput from './message-input';
import TypingIndicator from './typing-indicator';
import EmptyChatState from './empty-chat-state';

const ChatPanel = () => {
  const {
    selectedChatId,
    selectedTicket,
    messages,
    messagesLoading,
    typingUsers,
    refreshMessages,
    socketError
  } = useHealthChat();
  const messagesEndRef = useRef(null);

  const isPatientTyping = typingUsers[selectedChatId]?.isTyping;
  const isPending = selectedTicket?.status === 'Open';

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPatientTyping]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!selectedChatId) {
    return <EmptyChatState />;
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 h-full">
      {/* Header */}
      <ChatHeader />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* Socket error warning and refresh button */}
          {socketError && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                Connection issue - using manual refresh
              </span>
              <button
                onClick={refreshMessages}
                disabled={messagesLoading}
                className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors disabled:opacity-50"
                title="Refresh messages"
              >
                <RefreshCw className={`w-4 h-4 ${messagesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Show ticket purpose as the initial "message" from patient */}
              {selectedTicket?.purpose && (
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="max-w-[75%]">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      {selectedTicket.patient?.firstName || 'Patient'}{isPending && ' • Initial Request'}
                    </p>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-neutral-100 dark:bg-neutral-800">
                      <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap">
                        {selectedTicket.purpose}
                      </p>
                    </div>
                    {selectedTicket.session_start && (
                      <p className="text-[10px] text-neutral-400 mt-1">
                        {formatTime(selectedTicket.session_start)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Pending status indicator */}
              {isPending && (
                <div className="flex justify-center my-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Pending your response
                    </span>
                  </div>
                </div>
              )}

              {/* Regular messages */}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  formatTime={formatTime}
                />
              ))}
            </>
          )}

          {/* Typing Indicator */}
          <TypingIndicator
            isTyping={isPatientTyping}
            label="Patient is typing"
          />

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <MessageInput />
    </div>
  );
};

export default ChatPanel;
