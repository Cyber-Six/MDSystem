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
      <div className="flex-1 flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#d5d1cb' }} />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-6 text-center">
        <p className="text-xs" style={{ color: '#a19b93' }}>
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