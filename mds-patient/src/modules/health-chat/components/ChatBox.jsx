import React from 'react';
import { Send, AlertCircle, Heart, X, Lock, RefreshCw } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { FileAttachButton, FilePreview } from './FileAttachment';

const ChatBox = ({
  messages,
  isLoading,
  isInitializing,
  connectionStatus,
  error,
  inputValue,
  inputRef,
  messagesEndRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onCloseTicket,
  formatTime,
  onRetry,
  onRefresh,
  // Health chat specific props
  ticketStatus,
  ticketPurpose,
  ticketCreatedAt,
  isStaffTyping,
  attachedFile,
  onFileStaged,
  onFileRemoved,
  isSocketConnected
}) => {
  // Determine if input should be disabled
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';
  const canSendMessage = isActive && connectionStatus === 'connected' && !isInitializing;

  const getStatusText = () => {
    if (isInitializing) return 'Connecting...';
    if (connectionStatus === 'offline') return 'Service unavailable';
    if (connectionStatus === 'error') return 'Connection error';
    if (isFrozen) return 'Conversation closed';
    if (isPending) return 'Waiting for staff approval';
    if (isStaffTyping) return 'Staff is typing...';
    if (isSocketConnected) return 'Online';
    return 'Connecting...';
  };

  const getStatusColor = () => {
    if (isFrozen) return 'bg-neutral-400';
    if (isPending) return 'bg-amber-400';
    if (isActive && isSocketConnected) return 'bg-emerald-500';
    return 'bg-amber-400';
  };

  const getPlaceholder = () => {
    if (isInitializing) return 'Connecting...';
    if (connectionStatus === 'offline') return 'Service unavailable...';
    if (connectionStatus === 'error') return 'Connection error. Please retry.';
    if (isFrozen) return 'This conversation is closed';
    if (isPending) return 'Waiting for staff approval...';
    return 'Type your message...';
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${getStatusColor()}`} />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white leading-tight truncate m-0 mb-0.5">
              Health Chat
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight truncate m-0 mt-0.5">
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Close ticket button - only show when active */}
        {isActive && (
          <button
            onClick={onCloseTicket}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400
                     hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30
                     rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Close this conversation"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="px-6 py-6 space-y-4">
          {/* Socket connection issue warning */}
          {!isSocketConnected && !isInitializing && isActive && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                Connection issue - using manual refresh
              </span>
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors disabled:opacity-50"
                title="Refresh messages"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Empty state when initializing */}
          {messages.length === 0 && isInitializing && !ticketPurpose && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading conversation...</p>
            </div>
          )}

          {/* Empty state when offline */}
          {messages.length === 0 && !isInitializing && connectionStatus === 'offline' && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <AlertCircle className="w-12 h-12 mb-3 text-neutral-400" />
              <p className="text-sm mb-3">Service unavailable</p>
              <button
                onClick={onRetry}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Show ticket purpose as the first "message" */}
          {ticketPurpose && (
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-primary-500 text-white">
                  <p className="text-sm whitespace-pre-wrap">{ticketPurpose}</p>
                </div>
                {ticketCreatedAt && (
                  <p className="text-[10px] text-neutral-400 mt-1 text-right">
                    {formatTime(ticketCreatedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pending status indicator after initial message */}
          {isPending && (
            <div className="flex justify-center my-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Waiting for staff to accept your request
                </span>
              </div>
            </div>
          )}

          {/* Frozen state indicator */}
          {isFrozen && messages.length === 0 && !ticketPurpose && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <Lock className="w-12 h-12 mb-3 text-neutral-400" />
              <p className="text-sm">This conversation has ended</p>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              formatTime={formatTime}
            />
          ))}

          {/* Typing Indicator */}
          <TypingIndicator isTyping={isStaffTyping} />

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* File Preview (if attached) */}
      {attachedFile && (
        <div className="px-6 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <FilePreview file={attachedFile} onRemove={onFileRemoved} />
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-6 py-4 flex-shrink-0">
        {/* Frozen state message */}
        {isFrozen && (
          <div className="flex items-center justify-center gap-2 text-neutral-500 py-2">
            <Lock className="w-4 h-4" />
            <span className="text-sm">This conversation is closed</span>
          </div>
        )}

        {/* Pending state message */}
        {isPending && (
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 py-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Waiting for staff approval...</span>
          </div>
        )}

        {/* Input form - only show when active */}
        {isActive && (
          <form onSubmit={onSubmit}>
            <div className="flex items-end gap-2">
              {/* File attachment button */}
              <FileAttachButton
                onFileStaged={onFileStaged}
                disabled={!canSendMessage || isLoading || attachedFile}
              />

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={onInputChange}
                  onKeyDown={onKeyDown}
                  placeholder={getPlaceholder()}
                  disabled={!canSendMessage || isLoading}
                  className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           placeholder-neutral-400 dark:placeholder-neutral-500
                           resize-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  rows="1"
                />
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={!canSendMessage || isLoading || (!inputValue.trim() && !attachedFile)}
                className="flex-shrink-0 w-10 h-10 rounded-lg transition-all duration-200 flex items-center justify-center
                         shadow-sm hover:shadow-md disabled:shadow-none self-center
                         bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700
                         text-white disabled:cursor-not-allowed"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChatBox;
