import React, { useEffect, useRef, useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import ChatHeader from './chat-header';
import MessageBubble from './message-bubble';
import MessageInput from './message-input';
import TypingIndicator from './typing-indicator';
import EmptyChatState from './empty-chat-state';
import TicketDivider from './ticket-divider';

const ChatPanel = () => {
  const {
    selectedChatId,
    selectedPatientId,
    selectedTicket,
    selectedConversation,
    messages,
    messagesLoading,
    typingUsers,
    refreshMessages,
    socketError
  } = useHealthChat();

  const messagesEndRef = useRef(null);

  // Get ticket details for dividers (from selectedTicket.tickets array)
  const ticketDetailsMap = useMemo(() => {
    const map = {};
    if (selectedTicket?.tickets) {
      selectedTicket.tickets.forEach(t => {
        map[t.id] = t;
      });
    }
    // Also add the latest ticket if available
    if (selectedConversation?.latestTicket) {
      map[selectedConversation.latestTicket.id] = selectedConversation.latestTicket;
    }
    return map;
  }, [selectedTicket, selectedConversation]);

  // Build unified list with ticket dividers inserted where ticket changes
  const itemsWithDividers = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const result = [];
    let currentTicketId = null;
    let lastClosedTicket = null;

    // Sort messages by stamp to ensure chronological order
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.stamp) - new Date(b.stamp)
    );

    for (let i = 0; i < sortedMessages.length; i++) {
      const message = sortedMessages[i];
      const msgTicketId = message.consultationVirtualId;

      // If ticket changed, insert a divider
      if (currentTicketId !== null && msgTicketId !== currentTicketId) {
        const prevTicket = ticketDetailsMap[currentTicketId];
        const newTicket = ticketDetailsMap[msgTicketId];

        // Only show divider if previous ticket was closed
        if (prevTicket && ['Closed', 'Expired'].includes(prevTicket.status)) {
          result.push({
            _isDivider: true,
            id: `divider-${currentTicketId}-${msgTicketId}`,
            closedBy: prevTicket.closedBy || 'Staff',
            closedAt: prevTicket.session_end || prevTicket.archived_at,
            newTicketPurpose: newTicket?.purpose
          });
        }
      }

      result.push(message);
      currentTicketId = msgTicketId;
    }

    return result;
  }, [messages, ticketDetailsMap]);

  const isArchived = selectedTicket && ['Closed', 'Expired'].includes(selectedTicket.status);
  const isPatientTyping = !isArchived && typingUsers[selectedPatientId || selectedChatId]?.isTyping;
  const isPending = selectedTicket?.status === 'Open';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isPatientTyping, selectedChatId]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedChatId && !selectedPatientId) return <EmptyChatState />;

  // Build unified list: synthetic purpose entry + messages with dividers
  // The purpose now comes from the first ticket for this patient
  const firstTicket = selectedTicket?.tickets?.[0] || selectedConversation?.latestTicket;
  const purposeSynth = firstTicket?.purpose ? [{
    id: '__purpose__',
    text: firstTicket.purpose,
    userType: 'Patient',
    promptType: 'text',
    stamp: firstTicket.session_start,
    sender: { firstName: selectedTicket?.patient?.firstName || 'Patient' },
    _isPurpose: true,
  }] : [];

  const allItems = [...purposeSynth, ...itemsWithDividers];

  return (
    <div
      className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-neutral-900"
    >
      {/* Header */}
      <ChatHeader />

      {/* Messages - only this div scrolls */}
      <div
        className="flex-1 min-h-0 overflow-y-auto bg-neutral-100 dark:bg-neutral-800"
      >
        <div className="px-5 py-4">

          {/* Loading spinner */}
          {messagesLoading && messages.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-300 dark:text-neutral-600" />
            </div>
          )}

          {/* Unified message list with ticket dividers */}
          {allItems.map((item, i) => {
            // Render ticket divider
            if (item._isDivider) {
              return (
                <TicketDivider
                  key={item.id}
                  closedBy={item.closedBy}
                  closedAt={item.closedAt}
                  newTicketPurpose={item.newTicketPurpose}
                />
              );
            }

            // Render message
            const message = item;
            const prev = allItems[i - 1];
            const next = allItems[i + 1];

            // Skip dividers when calculating grouping
            const prevMsg = prev && !prev._isDivider ? prev : null;
            const nextMsg = next && !next._isDivider ? next : null;

            const isFirst = !prevMsg
              || prevMsg.userType !== message.userType
              || prevMsg.promptType === 'system'
              || message.promptType === 'system';
            const isLast = !nextMsg
              || nextMsg.userType !== message.userType
              || nextMsg.promptType === 'system'
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-primary-500/10 dark:bg-primary-500/20 border border-primary-500/25 dark:border-primary-500/30 text-primary-700 dark:text-primary-400">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary-500" />
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