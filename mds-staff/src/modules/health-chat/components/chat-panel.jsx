import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
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
    typingUsers
  } = useHealthChat();
  const messagesEndRef = useRef(null);

  const isPatientTyping = typingUsers[selectedChatId]?.isTyping;

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
          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No messages yet
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                formatTime={formatTime}
              />
            ))
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
