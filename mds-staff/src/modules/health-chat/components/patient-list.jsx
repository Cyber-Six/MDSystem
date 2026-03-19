import React from 'react';
import { Loader2 } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import PatientListItem from './patient-list-item';

const PatientList = () => {
  const {
    tickets,
    ticketsLoading,
    selectedChatId,
    selectChat,
    typingUsers
  } = useHealthChat();

  if (ticketsLoading && tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
          No conversations found
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {tickets.map((ticket) => (
        <PatientListItem
          key={ticket.id}
          ticket={ticket}
          isSelected={String(ticket.id) === String(selectedChatId)}
          isTyping={typingUsers[ticket.id]?.isTyping}
          onClick={() => selectChat(ticket.id)}
        />
      ))}
    </div>
  );
};

export default PatientList;
