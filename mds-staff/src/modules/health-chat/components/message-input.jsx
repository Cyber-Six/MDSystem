import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2, File, Image, Film, CheckCircle, XCircle } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { useHealthChatSocket } from '../hooks/use-health-chat-socket';
import { uploadFile, unstageFile } from '../health-chat-service';

const ACCEPTED_TYPES = 'image/jpeg,image/png,application/pdf,video/mp4,video/quicktime';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MessageInput = () => {
  const { selectedChatId, selectedTicket, sendMessage, approveTicket, rejectTicket } = useHealthChat();
  const { emitTyping } = useHealthChatSocket();

  const [inputValue, setInputValue]   = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending]     = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);

  const isPending = selectedTicket?.status === 'Open';
  const isActive  = selectedTicket?.status === 'Ongoing';
  const isClosed  = ['Closed', 'Expired'].includes(selectedTicket?.status);
  const canSend   = isActive && (inputValue.trim() || attachedFile) && !isSending;

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Max 10MB.'); return; }
    try {
      setIsUploading(true);
      const fileId = await uploadFile(file);
      setAttachedFile({ fileId, fileName: file.name, fileType: file.type, fileSize: file.size });
    } catch { alert('Upload failed. Please try again.'); }
    finally { setIsUploading(false); }
  };

  const handleRemoveFile = async () => {
    if (attachedFile?.fileId) {
      try { await unstageFile(attachedFile.fileId); } catch {}
    }
    setAttachedFile(null);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim() && selectedChatId) emitTyping(selectedChatId, true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = async () => {
    if (!canSend || !selectedChatId) return;
    try {
      setIsSending(true);
      emitTyping(selectedChatId, false);
      if (attachedFile) { await sendMessage(selectedChatId, null, attachedFile.fileId, 'file'); setAttachedFile(null); }
      if (inputValue.trim()) { await sendMessage(selectedChatId, inputValue.trim(), null, 'text'); setInputValue(''); }
    } catch { alert('Failed to send. Please try again.'); }
    finally {
      setIsSending(false);
      // Refocus input after sending so user can continue typing
      // Use setTimeout to ensure state updates have applied
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const FileIcon = attachedFile?.fileType?.startsWith('image/') ? Image
                 : attachedFile?.fileType?.startsWith('video/') ? Film
                 : File;

  const handleApprove = async () => {
    if (actionLoading) return;
    try { setActionLoading('approve'); await approveTicket(selectedChatId); }
    catch { alert('Failed to approve.'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (actionLoading) return;
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try { setActionLoading('reject'); await rejectTicket(selectedChatId, reason || null); }
    catch { alert('Failed to reject.'); }
    finally { setActionLoading(null); }
  };

  // ── Pending state ──
  if (isPending) {
    return (
      <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <p className="text-xs text-center mb-3 text-neutral-400 dark:text-neutral-500">
          Patient is waiting — accept to start the conversation
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                       transition-all duration-150 disabled:opacity-50
                       border-[1.5px] border-red-200 dark:border-red-800 text-red-600 dark:text-red-400
                       hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {actionLoading === 'reject'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <XCircle className="w-4 h-4" />
            }
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={!!actionLoading}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                       transition-all duration-150 disabled:opacity-50
                       bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400
                       hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
          >
            {actionLoading === 'approve'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle className="w-4 h-4" />
            }
            Accept Conversation
          </button>
        </div>
      </div>
    );
  }

  // ── Closed state ──
  if (isClosed) {
    return (
      <div className="flex-shrink-0 px-5 py-3 text-xs text-center border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500">
        This conversation has ended
      </div>
    );
  }

  // ── Active input ──
  return (
    <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      {/* File preview bar */}
      {attachedFile && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-neutral-200 dark:bg-neutral-700">
            <FileIcon className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-secondary-800 dark:text-white">
              {attachedFile.fileName}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              {formatFileSize(attachedFile.fileSize)}
            </p>
          </div>
          <button
            onClick={handleRemoveFile}
            className="p-1 rounded transition-colors text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Attach */}
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isSending || !!attachedFile}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-40
                     text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          {isUploading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Paperclip className="w-4 h-4" />
          }
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          disabled={isSending}
          rows={1}
          className="flex-1 px-3.5 py-2 text-sm resize-none rounded-xl transition-all duration-150
                     bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
                     text-secondary-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500
                     focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20
                     disabled:opacity-50"
          style={{ maxHeight: '80px', lineHeight: '1.4', scrollbarWidth: 'none' }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                     transition-all duration-150 active:scale-95 disabled:cursor-not-allowed
                     disabled:bg-neutral-200 dark:disabled:bg-neutral-700 disabled:text-neutral-400 dark:disabled:text-neutral-500"
          style={canSend ? {
            background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
            color: '#1c1a17',
            boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
          } : undefined}
        >
          {isSending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Send className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
