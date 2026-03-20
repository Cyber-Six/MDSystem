import React from 'react';
import { MessageSquare } from 'lucide-react';

const EmptyChatState = () => {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8"
      style={{ background: '#f4f2ef' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: '#e8e5e0' }}
      >
        <MessageSquare className="w-7 h-7" style={{ color: '#a19b93' }} />
      </div>
      <p
        className="font-semibold text-sm mb-1"
        style={{ color: '#28251f', fontFamily: 'Poppins, sans-serif' }}
      >
        No conversation selected
      </p>
      <p
        className="text-xs text-center max-w-[200px] leading-relaxed"
        style={{ color: '#a19b93' }}
      >
        Select a patient from the list to view their conversation
      </p>
    </div>
  );
};

export default EmptyChatState;