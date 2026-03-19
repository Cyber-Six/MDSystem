import React from 'react';
import { Send, AlertCircle, X, Lock, RefreshCw, Stethoscope, Clock } from 'lucide-react';
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
  ticketStatus,
  ticketPurpose,
  ticketCreatedAt,
  isStaffTyping,
  attachedFile,
  onFileStaged,
  onFileRemoved,
  isSocketConnected
}) => {
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';
  const canSendMessage = isActive && connectionStatus === 'connected' && !isInitializing;

  const getStatusDot = () => {
    if (isFrozen) return '#a19b93';
    if (isPending) return '#f4c430';
    if (isActive && isSocketConnected) return '#22c55e';
    return '#f4c430';
  };

  const getStatusLabel = () => {
    if (isInitializing) return 'Connecting…';
    if (connectionStatus === 'offline') return 'Service unavailable';
    if (connectionStatus === 'error') return 'Connection error';
    if (isFrozen) return 'Conversation closed';
    if (isPending) return 'Waiting for staff';
    if (isStaffTyping) return 'Typing…';
    if (isSocketConnected) return 'Online';
    return 'Connecting…';
  };

  const getPlaceholder = () => {
    if (isInitializing) return 'Connecting…';
    if (connectionStatus === 'offline') return 'Service unavailable…';
    if (connectionStatus === 'error') return 'Connection error — please retry.';
    if (isFrozen) return 'This conversation is closed';
    if (isPending) return 'Waiting for staff approval…';
    return 'Type a message…';
  };

  return (
    <div
      className="flex flex-col h-full font-sans"
      style={{ background: '#fdfcfa' }}
    >

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{
          background: '#fdfcfa',
          borderBottom: '1.5px solid #e8e5e0',
        }}
      >
        {/* Left: avatar + name + status */}
        <div className="flex items-center gap-3">
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(244,196,48,0.12)',
              border: '1.5px solid rgba(244,196,48,0.25)'
            }}
          >
            <Stethoscope className="w-5 h-5 text-primary-500" />
            {/* Status dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: getStatusDot(),
                borderColor: '#fdfcfa',
                transition: 'background 0.3s'
              }}
            />
          </div>
          <div>
            <p
              className="font-heading font-semibold text-sm text-secondary-800 dark:text-white leading-tight m-0"
            >
              Medical Staff
            </p>
            <p
              className="text-xs leading-tight m-0 mt-0.5 flex items-center gap-1.5"
              style={{ color: '#a19b93' }}
            >
              {isStaffTyping ? (
                <span className="text-primary-600 font-medium">Typing…</span>
              ) : (
                getStatusLabel()
              )}
            </p>
          </div>
        </div>

        {/* Right: expiry + close */}
        <div className="flex items-center gap-2">
          {/* Socket reconnect button */}
          {!isSocketConnected && !isInitializing && isActive && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ color: '#a19b93' }}
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {isActive && (
            <button
              onClick={onCloseTicket}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                         transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: '#78716c',
                border: '1.5px solid #e8e5e0',
                background: 'transparent'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#fca5a5';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.background = '#fef2f2';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e8e5e0';
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X className="w-3.5 h-3.5" />
              End chat
            </button>
          )}
        </div>
      </div>

      {/* ── Connection warning banner ── */}
      {!isSocketConnected && !isInitializing && isActive && (
        <div
          className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0 text-xs"
          style={{
            background: '#fff7ed',
            borderBottom: '1px solid #fed7aa',
            color: '#c2410c'
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: '#f97316' }}
          />
          Connection issue — messages may be delayed
        </div>
      )}

      {/* ── Messages area — ONLY this div scrolls ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ background: '#f4f2ef' }}
      >
        <div className="px-5 py-5 space-y-1">

          {/* Initializing */}
          {messages.length === 0 && isInitializing && !ticketPurpose && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3"
                style={{ borderColor: '#f4c430', borderTopColor: 'transparent' }}
              />
              <p className="text-sm">Loading your conversation…</p>
            </div>
          )}

          {/* Offline */}
          {messages.length === 0 && !isInitializing && connectionStatus === 'offline' && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <AlertCircle className="w-10 h-10 mb-3 text-neutral-300" />
              <p className="text-sm mb-4">Service unavailable right now</p>
              <button
                onClick={onRetry}
                className="px-5 py-2 rounded-full text-sm font-medium text-secondary-900 transition-all"
                style={{ background: '#f4c430', boxShadow: '0 2px 8px rgba(244,196,48,0.3)' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Ticket purpose as first bubble */}
          {ticketPurpose && (
            <div className="flex justify-end mb-1">
              <div style={{ maxWidth: '78%' }}>
                <div
                  className="px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed text-secondary-900"
                  style={{
                    background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                    boxShadow: '0 3px 10px rgba(244,196,48,0.3)'
                  }}
                >
                  {ticketPurpose}
                </div>
                {ticketCreatedAt && (
                  <p
                    className="text-[10px] text-right mt-1 flex items-center justify-end gap-1"
                    style={{ color: '#a19b93' }}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(ticketCreatedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pending badge */}
          {isPending && (
            <div className="flex justify-center py-3">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(244,196,48,0.1)',
                  border: '1px solid rgba(244,196,48,0.3)',
                  color: '#C9A01E'
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: '#f4c430' }}
                />
                Waiting for a staff member to accept
              </div>
            </div>
          )}

          {/* Frozen empty */}
          {isFrozen && messages.length === 0 && !ticketPurpose && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <Lock className="w-10 h-10 mb-3 text-neutral-300" />
              <p className="text-sm">This conversation has ended</p>
            </div>
          )}

          {/* Messages — avatar grouped by consecutive sender */}
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const isFirstInGroup = !prev || prev.userType !== message.userType || prev.promptType === 'system';
            const isLastInGroup  = !next || next.userType !== message.userType || next.promptType === 'system';
            return (
              <MessageBubble
                key={message.id}
                message={message}
                formatTime={formatTime}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
              />
            );
          })}

          {/* Typing indicator */}
          <TypingIndicator isTyping={isStaffTyping} />

          {/* Error inline */}
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626'
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── File preview ── */}
      {attachedFile && (
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{
            borderTop: '1.5px solid #e8e5e0',
            background: '#fdfcfa'
          }}
        >
          <FilePreview file={attachedFile} onRemove={onFileRemoved} />
        </div>
      )}

      {/* ── Input area ── */}
      <div
        className="px-4 py-2.5 flex-shrink-0"
        style={{
          background: '#fdfcfa',
          borderTop: '1.5px solid #e8e5e0',
          boxShadow: '0 -2px 8px rgba(28,25,23,0.04)'
        }}
      >
        {/* Frozen */}
        {isFrozen && (
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs"
            style={{ color: '#a19b93', background: '#f4f2ef' }}
          >
            <Lock className="w-3.5 h-3.5" />
            This conversation is closed
          </div>
        )}

        {/* Pending */}
        {isPending && (
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs"
            style={{ color: '#C9A01E', background: 'rgba(244,196,48,0.07)' }}
          >
            <div
              className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
              style={{ borderColor: '#f4c430', borderTopColor: 'transparent' }}
            />
            Waiting for staff approval…
          </div>
        )}

        {/* Active input */}
        {isActive && (
          <div className="flex items-center gap-2">
            {/* Attach */}
            <FileAttachButton
              onFileStaged={onFileStaged}
              disabled={!canSendMessage || isLoading || attachedFile}
            />

            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                placeholder={getPlaceholder()}
                disabled={!canSendMessage || isLoading}
                className="w-full px-3.5 py-2 text-sm rounded-full resize-none leading-snug
                           text-secondary-800 placeholder-neutral-400 transition-all duration-200
                           focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#f4f2ef',
                  border: '1.5px solid #e8e5e0',
                  maxHeight: '80px',
                  scrollbarWidth: 'none'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#f4c430';
                  e.target.style.boxShadow = '0 0 0 3px rgba(244,196,48,0.12)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e8e5e0';
                  e.target.style.boxShadow = 'none';
                }}
                rows={1}
              />
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSendMessage || isLoading || (!inputValue.trim() && !attachedFile)}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                         transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
              style={{
                background:
                  canSendMessage && (inputValue.trim() || attachedFile)
                    ? 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)'
                    : '#e8e5e0',
                boxShadow:
                  canSendMessage && (inputValue.trim() || attachedFile)
                    ? '0 2px 8px rgba(244,196,48,0.35)'
                    : 'none',
                color:
                  canSendMessage && (inputValue.trim() || attachedFile)
                    ? '#1c1a17'
                    : '#a19b93'
              }}
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBox;