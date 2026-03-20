import React from 'react';
import { MessageSquare } from 'lucide-react';

const EmptyChatState = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-100 dark:bg-neutral-800">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-neutral-200 dark:bg-neutral-700">
        <MessageSquare className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
      </div>
      <p className="font-semibold text-sm mb-1 text-secondary-800 dark:text-white font-heading">
        No conversation selected
      </p>
      <p className="text-xs text-center max-w-[200px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        Select a patient from the list to view their conversation
      </p>
    </div>
  );
};

export default EmptyChatState;
