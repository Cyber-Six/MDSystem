import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { getPatientMessages } from '../health-chat-service';
import ChatHeader from './chat-header';
import MessageBubble from './message-bubble';
import MessageInput from './message-input';
import TypingIndicator from './typing-indicator';
import EmptyChatState from './empty-chat-state';
import TicketDivider from './ticket-divider';
import PrescriptionPanel from './PrescriptionModal';
import ConsultationPanel from './ConsultationPanel';

const ChatPanel = ({ emitTyping }) => {
  const {
    selectedChatId,
    selectedPatientId,
    selectedTicket,
    selectedConversation,
    messages,
    messagesLoading,
    setMessages,
    typingUsers,
    refreshMessages,
    socketError,
    activeTicketId,
    sendMessage
  } = useHealthChat();

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [panelMode, setPanelMode] = useState(null); // null | 'consultation' | 'prescription'
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const prevScrollHeightRef = useRef(0);
  const isLoadingOlderRef = useRef(false);

  // Load older messages when scrolling to top
  const handleScroll = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages || !selectedPatientId) return;

    // Trigger load when scrolled near the top (within 80px)
    if (container.scrollTop < 80) {
      try {
        setLoadingOlder(true);
        isLoadingOlderRef.current = true;
        prevScrollHeightRef.current = container.scrollHeight;

        const olderMessages = await getPatientMessages(
          Number(selectedPatientId),
          { before: messages[0]?.stamp, limit: 50 }
        );

        if (!olderMessages || olderMessages.length === 0) {
          setHasMoreMessages(false);
        } else {
          // Prepend older messages (they come in ASC order)
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m.id)));
            const newMsgs = olderMessages.filter(m => !existingIds.has(String(m.id)));
            return [...newMsgs, ...prev];
          });

          // Maintain scroll position after prepending
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollContainerRef.current) {
                const newScrollHeight = scrollContainerRef.current.scrollHeight;
                scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
              }
              isLoadingOlderRef.current = false;
            });
          });
        }
      } catch (err) {
        console.error('[ChatPanel] Failed to load older messages:', err);
      } finally {
        setLoadingOlder(false);
      }
    }
  }, [loadingOlder, hasMoreMessages, selectedPatientId, messages]);

  // Reset pagination state when patient changes
  useEffect(() => {
    setHasMoreMessages(true);
    setLoadingOlder(false);
  }, [selectedPatientId]);

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

  // Scroll to bottom when messages load or chat changes
  // Skip when loading older messages (pagination) to preserve scroll position
  useEffect(() => {
    if (isLoadingOlderRef.current) return;
    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isLoadingOlderRef.current) return;
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        });
      });
    };
    scrollToBottom();
  }, [messages, isPatientTyping, selectedChatId]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Close side panel when patient/chat changes
  useEffect(() => {
    setPanelMode(null);
  }, [selectedChatId, selectedPatientId]);

  if (!selectedChatId && !selectedPatientId) return <EmptyChatState />;

  // Build unified list: synthetic purpose entry + messages with dividers
  // Use the OLDEST ticket's purpose as the initial context message so it aligns
  // with the oldest messages rendered at the top of the chat.
  const allSubTickets = selectedTicket?.tickets || [];
  const firstTicket = allSubTickets.length > 0
    ? allSubTickets[allSubTickets.length - 1]   // oldest (array is DESC)
    : selectedConversation?.latestTicket;
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

  const patient = selectedTicket?.patient;
  const patientFullName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : '';

  return (
    <div className="flex-1 flex h-full min-h-0">
    {/* Chat column */}
    <div
      className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-neutral-900"
    >
      {/* Header */}
      <ChatHeader />

      {/* Messages - only this div scrolls */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto bg-neutral-100 dark:bg-neutral-800"
      >
        <div className="px-5 py-4">

          {/* Loading older messages spinner */}
          {loadingOlder && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400 dark:text-neutral-500" />
              <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">Loading older messages…</span>
            </div>
          )}

          {/* No more messages indicator */}
          {!hasMoreMessages && messages.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Beginning of conversation</span>
            </div>
          )}

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
      <MessageInput emitTyping={emitTyping} onOpenPanel={(mode) => setPanelMode(mode)} />
    </div>

    {/* ── Side panel with slide animation ── */}
    <div
      className={`h-full flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
        panelMode ? 'w-[380px] opacity-100' : 'w-0 opacity-0'
      }`}
    >
      {panelMode === 'consultation' && (
        <ConsultationPanel
          isOpen={panelMode === 'consultation'}
          onClose={() => setPanelMode(null)}
          patientId={selectedTicket?.patientId}
          patientName={patientFullName}
          onIssuePrescription={() => setPanelMode('prescription')}
        />
      )}
      {panelMode === 'prescription' && (
        <PrescriptionPanel
          isOpen={panelMode === 'prescription'}
          onClose={() => setPanelMode(null)}
          patientId={selectedTicket?.patientId}
          patientName={patientFullName}
          patientDob={patient?.dateOfBirth}
          patientSex={patient?.sex}
          activeTicketId={activeTicketId}
          sendMessage={sendMessage}
        />
      )}
    </div>
    </div>
  );
};

export default ChatPanel;