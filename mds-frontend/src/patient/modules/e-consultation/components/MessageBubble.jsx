import React from 'react';
import { Bot, User } from 'lucide-react';

const MessageBubble = ({ message, formatTime }) => {
  return (
    <div
      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        message.role === 'assistant'
          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
          : 'bg-gray-700 dark:bg-gray-600'
      }`}>
        {message.role === 'assistant' ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} flex-1`}>
        <div
          className={`rounded-xl px-4 py-2.5 shadow-sm max-w-[85%] ${
            message.role === 'assistant'
              ? 'bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-tl-md'
              : 'bg-blue-600 text-white rounded-tr-md shadow-md'
          }`}
        >
          <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${
            message.role === 'assistant' ? 'text-neutral-800 dark:text-neutral-100' : 'text-white'
          }`}>{message.content}</p>
        </div>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
