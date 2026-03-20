import React, { useEffect, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPatientTyping]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedChatId) return <EmptyChatState />;

  // Build unified list: synthetic purpose entry + real messages
  // so grouping logic works seamlessly across the boundary
  const purposeSynth = selectedTicket?.purpose ? [{
    id: '__purpose__',
    text: selectedTicket.purpose,
    userType: 'Patient',
    promptType: 'text',
    stamp: selectedTicket.session_start,
    sender: { firstName: selectedTicket.patient?.firstName || 'Patient' },
    _isPurpose: true,
  }] : [];

  const allItems = [...purposeSynth, ...messages];

  return (
    <div
      className="flex-1 flex flex-col h-full min-h-0"
      style={{ background: '#fdfcfa' }}
    >
      {/* Header */}
      <ChatHeader />

      {/* Connection warning */}
      {socketError && (
        <div
          className="flex items-center gap-2 px-5 py-2 text-xs flex-shrink-0"
          style={{
            background: '#FFF7ED',
            borderBottom: '1px solid #FED7AA',
            color: '#C2410C'
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F97316' }} />
          <span className="flex-1">Connection issue - messages may be delayed</span>
          <button
            onClick={refreshMessages}
            disabled={messagesLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                       transition-colors disabled:opacity-50"
            style={{ color: '#C2410C', border: '1px solid #FED7AA' }}
          >
            <RefreshCw className={`w-3 h-3 ${messagesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Messages - only this div scrolls */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ background: '#f4f2ef' }}
      >
        <div className="px-5 py-4">

          {/* Loading spinner */}
          {messagesLoading && messages.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#d5d1cb' }} />
            </div>
          )}

          {/* Unified message list with correct grouping */}
          {allItems.map((message, i) => {
            const prev = allItems[i - 1];
            const next = allItems[i + 1];
            const isFirst = !prev
              || prev.userType !== message.userType
              || prev.promptType === 'system'
              || message.promptType === 'system';
            const isLast = !next
              || next.userType !== message.userType
              || next.promptType === 'system'
              || message.promptType === 'system';

            return (
              <MessageBubble
                key={message.id}
                message={message}
                formatTime={formatTime}
                isFirstInGroup={isFirst}
                isLastInGroup={isLast}
              />
            );
          })}

          {/* Pending badge after purpose bubble */}
          {isPending && (
            <div className="flex justify-center py-3">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(244,196,48,0.08)',
                  border: '1px solid rgba(244,196,48,0.25)',
                  color: '#C9A01E'
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: '#f4c430' }}
                />
                Awaiting your response
              </div>
            </div>
          )}

          {/* Typing indicator */}
          <TypingIndicator isTyping={isPatientTyping} label="Patient is typing" />

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <MessageInput />
    </div>
  );
};

export default ChatPanel;