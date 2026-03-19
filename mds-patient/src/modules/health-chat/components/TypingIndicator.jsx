import React from 'react';

/**
 * Typing indicator that shows when other party is typing
 * Displays bouncing dots animation
 */
const TypingIndicator = ({ isTyping, label = 'Medical Staff is typing' }) => {
  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full px-3 py-2">
        <div
          className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '600ms' }}
        />
        <div
          className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '600ms' }}
        />
        <div
          className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '600ms' }}
        />
      </div>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
    </div>
  );
};

export default TypingIndicator;
