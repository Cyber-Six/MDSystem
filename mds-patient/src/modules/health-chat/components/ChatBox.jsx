import React from 'react';
import { Send, AlertCircle, Sparkles, RotateCcw, StopCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import LoadingIndicator from './LoadingIndicator';
import EmptyState from './EmptyState';

const ChatBox = ({
  messages,
  isLoading,
  isInitializing,
  connectionStatus,
  streamingContent,
  error,
  inputValue,
  inputRef,
  messagesEndRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onClearChat,
  onCancelGeneration,
  formatTime,
  onRetry
}) => {
  const AI_MODEL_NAME = 'AI Chatbot: econsul-ey';

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 relative z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${isLoading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white leading-tight truncate m-0 mb-0.5">
              {AI_MODEL_NAME}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight truncate m-0 mt-0.5">
              {isLoading ? (streamingContent ? 'Generating response...' : 'Thinking...') : 'Online • Ready to help'}
            </p>
          </div>
        </div>
        <button
          onClick={onClearChat}
          disabled={isLoading || connectionStatus !== 'connected'}
          className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white 
                   hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear chat and start new session"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="h-[550px] overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="px-6 py-6 space-y-4">
          {/* Show empty states only when no messages and initializing/offline/error */}
          {messages.length === 0 && isInitializing && (
            <EmptyState type="initializing" />
          )}

          {messages.length === 0 && !isInitializing && connectionStatus === 'offline' && (
            <EmptyState type="offline" onRetry={onRetry} />
          )}

          {messages.length === 0 && !isInitializing && connectionStatus === 'error' && (
            <EmptyState type="error" error={error} onRetry={onRetry} />
          )}

          {/* Messages - show when connected or when messages exist */}
          {messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              formatTime={formatTime} 
            />
          ))}

          {/* Loading Indicator - only show when loading AND no streaming content */}
          {!isInitializing && connectionStatus === 'connected' && isLoading && !streamingContent && (
            <LoadingIndicator />
          )}

          {/* Error Message - only show when connected and has messages */}
          {!isInitializing && connectionStatus === 'connected' && messages.length > 0 && error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-6 py-4">
        <form onSubmit={onSubmit}>
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                placeholder={
                  isInitializing ? 'Connecting...' :
                  connectionStatus === 'offline' ? 'Service unavailable...' :
                  connectionStatus === 'error' ? 'Connection error. Please retry.' :
                  'Ask me anything about your health...'
                }
                disabled={connectionStatus !== 'connected' || isInitializing}
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                         placeholder-neutral-400 dark:placeholder-neutral-500
                         resize-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                rows="1"
              />
            </div>
            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? onCancelGeneration : undefined}
              disabled={!isLoading && (!inputValue.trim() || connectionStatus !== 'connected' || isInitializing)}
              className={`flex-shrink-0 w-10 h-10 rounded-lg transition-all duration-200 flex items-center justify-center
                       shadow-sm hover:shadow-md disabled:shadow-none self-center
                       ${isLoading 
                         ? 'bg-red-600 hover:bg-red-700 text-white' 
                         : 'bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white disabled:cursor-not-allowed'
                       }`}
              title={isLoading ? 'Stop generation' : 'Send message'}
            >
              {isLoading ? (
                <StopCircle className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;
