import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, X, Lock, RefreshCw, Stethoscope, Clock, Pill, Plus, Paperclip, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { FilePreview, useClipboardPaste } from './FileAttachment';
import ConfirmModal from './ConfirmModal';
import ExpiryWarningBanner from './ExpiryWarningBanner';
import { uploadFile } from '../health-chat-service';

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
  onOpenCloseModal,
  showCloseModal,
  onCancelCloseModal,
  formatTime,
  onRetry,
  onRefresh,
  ticketStatus,
  ticketPurpose,
  ticketCreatedAt,
  staffName,
  staffRole,
  isStaffTyping,
  attachedFile,
  onFileStaged,
  onFileRemoved,
  isSocketConnected,
  socketError,
  onOpenMedicineRequest,
  expiresAt,
  isExtendingSession,
  onExtendSession,
}) => {
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';
  const canSendMessage = isActive && connectionStatus === 'connected' && !isInitializing;

  // Plus action menu
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const plusMenuRef = useRef(null);
  const localFileInputRef = useRef(null);

  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClickOutside = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  useEffect(() => {
    if (attachedFile) setAttachmentError('');
  }, [attachedFile]);

  useEffect(() => {
    if (!isActive) setAttachmentError('');
  }, [isActive]);

  const handleLocalFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const allowed = 'image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime'.split(',');
    if (!allowed.includes(file.type)) {
      setAttachmentError('Unsupported file type.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('File too large. Max 10MB.');
      return;
    }
    setIsFileUploading(true);
    try {
      const fileId = await uploadFile(file);
      setAttachmentError('');
      onFileStaged({ fileId, fileName: file.name, fileType: file.type, fileSize: file.size });
    } catch {
      setAttachmentError('Upload failed. Please try again.');
    } finally {
      setIsFileUploading(false);
    }
  };

  const { handlePaste } = useClipboardPaste({
    onFileStaged,
    onError: setAttachmentError,
    disabled: !canSendMessage || isLoading || !!attachedFile,
  });

  const getStatusDot = () => {
    if (isFrozen) return '#a19b93';
    if (isPending) return '#f4c430';
    // Show green if socket connected OR polling fallback is working
    if (isActive && (isSocketConnected || connectionStatus === 'connected')) return '#22c55e';
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
    // Polling fallback is working - show Online instead of Connecting
    if (connectionStatus === 'connected') return 'Online';
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
      className="flex flex-col h-full font-sans bg-white dark:bg-neutral-900"
    >

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700"
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
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-900 transition-all duration-300"
              style={{ background: getStatusDot() }}
            />
          </div>
          <div>
            <p
              className="font-heading font-semibold text-sm text-secondary-800 dark:text-white leading-tight m-0"
            >
              {staffName || 'Medical Staff'}
            </p>
            <p
              className="text-xs leading-tight m-0 mt-0.5 flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400"
            >
              {isStaffTyping ? (
                <span className="text-primary-600 font-medium">Typing…</span>
              ) : staffRole && !isFrozen && !isPending ? (
                staffRole
              ) : (
                getStatusLabel()
              )}
            </p>
          </div>
        </div>

        {/* Right: refresh + close */}
        <div className="flex items-center gap-2">
          {/* Socket reconnect button */}
          {!isSocketConnected && !isInitializing && isActive && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg transition-colors disabled:opacity-50 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {/* Close ticket button - only show when active */}
          {isActive && (
            <button
              onClick={onOpenCloseModal}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                         transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                         text-neutral-600 dark:text-neutral-300
                         border border-neutral-200 dark:border-neutral-700 bg-transparent
                         hover:text-red-600 dark:hover:text-red-400
                         hover:border-red-300 dark:hover:border-red-700
                         hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <X className="w-3.5 h-3.5" />
              Close Ticket
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area — ONLY this div scrolls ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto bg-neutral-100 dark:bg-neutral-800"
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
                  <p className="text-[10px] text-right mt-1 flex items-center justify-end gap-1 text-neutral-400 dark:text-neutral-500">
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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-primary-500/10 dark:bg-primary-500/20 border border-primary-500/30 dark:border-primary-500/40 text-primary-700 dark:text-primary-400">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary-500" />
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
          <TypingIndicator isTyping={isStaffTyping} label={staffName || 'Medical Staff'} />

          {/* Error inline */}
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
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
          className="px-5 py-3 flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
        >
          <FilePreview file={attachedFile} onRemove={onFileRemoved} />
        </div>
      )}

      {/* ── Expiry warning banner ── */}
      <ExpiryWarningBanner
        expiresAt={expiresAt}
        isExtending={isExtendingSession}
        onExtend={onExtendSession}
      />

      {/* ── Input area ── */}
      <div
        className="px-4 py-2.5 flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 shadow-lg dark:shadow-dark-sm"
      >
        {attachmentError && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {attachmentError}
          </div>
        )}

        {/* Frozen */}
        {isFrozen && (
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"
          >
            <Lock className="w-3.5 h-3.5" />
            This conversation is closed
          </div>
        )}

        {/* Pending */}
        {isPending && (
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50/70 dark:bg-yellow-900/20"
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
            {/* Hidden file input */}
            <input
              ref={localFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
              onChange={handleLocalFileSelect}
              className="hidden"
            />

            {/* Plus action menu */}
            <div ref={plusMenuRef} className="relative flex-shrink-0">
              <style>{`
                @keyframes hc-sheet-up {
                  from { opacity: 0; transform: translateY(14px) scale(0.97); }
                  to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
              `}</style>
              {showPlusMenu && (
                <div
                  className="absolute bottom-full left-0 mb-2 z-50 min-w-[220px] rounded-2xl overflow-hidden
                             bg-white dark:bg-[rgba(22,22,26,0.97)]
                             border border-neutral-200 dark:border-white/[0.06]
                             shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.3)]
                             backdrop-blur-md"
                  style={{ animation: 'hc-sheet-up 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
                >
                  {/* Attach File */}
                  <button
                    type="button"
                    onClick={() => { localFileInputRef.current?.click(); setShowPlusMenu(false); }}
                    disabled={!canSendMessage || isLoading || !!attachedFile}
                    className="w-full flex items-center justify-between px-5 py-4
                               text-neutral-800 dark:text-white
                               hover:bg-neutral-100 dark:hover:bg-white/[0.07]
                               active:bg-neutral-200 dark:active:bg-white/10
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-[15px] font-medium tracking-[-0.01em]">
                      {isFileUploading ? 'Uploading…' : 'Attach file'}
                    </span>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-[rgba(59,130,246,0.25)]">
                      {isFileUploading
                        ? <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                        : <Paperclip className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      }
                    </span>
                  </button>

                  <div className="mx-4 border-b border-neutral-200 dark:border-white/[0.07]" />

                  {/* Medicine Request */}
                  <button
                    type="button"
                    onClick={() => { onOpenMedicineRequest?.(); setShowPlusMenu(false); }}
                    className="w-full flex items-center justify-between px-5 py-4
                               text-neutral-800 dark:text-white
                               hover:bg-neutral-100 dark:hover:bg-white/[0.07]
                               active:bg-neutral-200 dark:active:bg-white/10
                               transition-colors"
                  >
                    <span className="text-[15px] font-medium tracking-[-0.01em]">Medicine request</span>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100 dark:bg-[rgba(16,185,129,0.25)]">
                      <Pill className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </button>
                </div>
              )}
              {/* Plus trigger button */}
              <button
                type="button"
                onClick={() => setShowPlusMenu(v => !v)}
                disabled={!canSendMessage || isLoading}
                className={`p-2 rounded-full transition-all duration-200 disabled:opacity-40
                            ${showPlusMenu
                              ? 'bg-neutral-200 dark:bg-neutral-700 text-secondary-900 dark:text-white'
                              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
              >
                <Plus
                  className="w-5 h-5 transition-transform duration-200"
                  style={{ transform: showPlusMenu ? 'rotate(45deg)' : 'rotate(0deg)' }}
                />
              </button>
            </div>

            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                onPaste={handlePaste}
                placeholder={getPlaceholder()}
                disabled={!canSendMessage || isLoading}
                className="w-full px-3 py-1.5 text-sm rounded-full resize-none leading-snug
                           text-secondary-800 dark:text-white placeholder-neutral-400 transition-all duration-200
                           focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                           bg-neutral-100 dark:bg-neutral-800
                           border border-neutral-200 dark:border-neutral-700
                           focus:border-primary-500 dark:focus:border-primary-400
                           focus:shadow-lg focus:shadow-primary-500/10"
                style={{
                  maxHeight: '60px',
                  scrollbarWidth: 'none'
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
                         transition-all duration-200 active:scale-95 disabled:cursor-not-allowed
                         text-secondary-900 dark:text-secondary-900
                         hover:shadow-lg dark:hover:shadow-dark-md
                         disabled:opacity-40 disabled:shadow-none"
              style={{
                background:
                  canSendMessage && (inputValue.trim() || attachedFile)
                    ? 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)'
                    : '#e8e5e0',
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

      {/* Close Ticket Confirmation Modal */}
      <ConfirmModal
        isOpen={showCloseModal}
        onClose={onCancelCloseModal}
        onConfirm={onCloseTicket}
        title="Close Ticket"
        message="Are you sure you want to close this ticket? You will no longer be able to send messages."
        confirmText="Close Ticket"
        cancelText="Cancel"
        variant="warning"
      />

    </div>
  );
};

export default ChatBox;
