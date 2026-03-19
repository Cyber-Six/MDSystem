import React from 'react';
import { Heart, MessageSquare } from 'lucide-react';

const EmptyChatState = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500 dark:text-neutral-400">
      <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <MessageSquare className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
      </div>
      <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
        Select a conversation
      </h3>
      <p className="text-sm text-center max-w-xs">
        Choose a patient from the list to view their health chat conversation
      </p>
    </div>
  );
};

export default EmptyChatState;
