import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import PatientListItem from './patient-list-item';

const PatientList = () => {
  const {
    tickets,
    ticketsLoading,
    selectedChatId,
    selectChat,
    typingUsers,
    needsReplyChats,
    pendingClosedChats
  } = useHealthChat();

  // Track known ticket IDs to detect genuinely new entries for enter animation
  // Uses a persistent ref that only grows — IDs are never removed so re-renders
  // after status changes or re-sorting don't falsely trigger enter animations.
  const knownTicketIds = useRef(new Set());
  const [newTicketIds, setNewTicketIds] = useState(new Set());
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const currentIds = new Set(tickets.map(t => String(t.id)));

    // On initial load, seed the known set without animating
    if (isInitialLoad.current) {
      knownTicketIds.current = currentIds;
      isInitialLoad.current = false;
      return;
    }

    const entering = new Set();
    currentIds.forEach(id => {
      if (!knownTicketIds.current.has(id)) {
        entering.add(id);
      }
    });

    // Add new IDs to known set (never remove — prevents re-animation on re-sort)
    currentIds.forEach(id => knownTicketIds.current.add(id));

    if (entering.size > 0) {
      setNewTicketIds(entering);
      // Clear entering state after animation completes
      const timer = setTimeout(() => setNewTicketIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [tickets]);

  if (ticketsLoading && tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#d5d1cb' }} />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-6 text-center">
        {ticketsLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#f4c430' }} />
        ) : (
          <p className="text-xs" style={{ color: '#a19b93' }}>
            No conversations found
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Inline keyframes for list animations */}
      <style>{`
        @keyframes listSlideIn {
          from { opacity: 0; transform: translateY(-12px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 80px; }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0); max-height: 80px; }
          to { opacity: 0; transform: translateX(-100%); max-height: 0; overflow: hidden; }
        }
      `}</style>
      {tickets.map((ticket) => {
        const ticketId = String(ticket.id);
        const patientId = String(ticket.patientId);
        const isNew = newTicketIds.has(ticketId);
        const isExiting = pendingClosedChats[patientId]?.isExiting;

        return (
          <div
            key={ticket.id}
            style={isNew ? {
              animation: 'listSlideIn 400ms ease-out',
            } : undefined}
          >
            <PatientListItem
              ticket={ticket}
              isSelected={String(ticket.id) === String(selectedChatId)}
              isTyping={typingUsers[ticket.id]?.isTyping}
              needsReply={!!needsReplyChats[patientId]}
              isExiting={!!isExiting}
              onClick={() => selectChat(ticket.id)}
            />
          </div>
        );
      })}

      {/* Loading indicator at bottom of list */}
      {ticketsLoading && tickets.length > 0 && (
        <div className="flex items-center justify-center py-3 border-t border-neutral-100 dark:border-neutral-800">
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
        </div>
      )}
    </div>
  );
};

export default PatientList;