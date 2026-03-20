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
      textareaRef.current?.focus();
    } catch { alert('Failed to send. Please try again.'); }
    finally { setIsSending(false); }
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
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderTop: '1px solid #e8e5e0', background: '#fdfcfa' }}
      >
        <p
          className="text-xs text-center mb-3"
          style={{ color: '#a19b93' }}
        >
          Patient is waiting — accept to start the conversation
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                       transition-all duration-150 disabled:opacity-50"
            style={{ border: '1.5px solid #FECACA', color: '#DC2626' }}
            onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                       transition-all duration-150 disabled:opacity-50"
            style={{ background: '#D1FAE5', color: '#065F46' }}
            onMouseEnter={e => e.currentTarget.style.background = '#A7F3D0'}
            onMouseLeave={e => e.currentTarget.style.background = '#D1FAE5'}
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
      <div
        className="flex-shrink-0 px-5 py-3 text-xs text-center"
        style={{ borderTop: '1px solid #e8e5e0', background: '#f4f2ef', color: '#a19b93' }}
      >
        This conversation has ended
      </div>
    );
  }

  // ── Active input ──
  return (
    <div
      className="flex-shrink-0"
      style={{ borderTop: '1px solid #e8e5e0', background: '#fdfcfa' }}
    >
      {/* File preview bar */}
      {attachedFile && (
        <div
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{ borderBottom: '1px solid #f4f2ef', background: '#f4f2ef' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#e8e5e0' }}
          >
            <FileIcon className="w-3.5 h-3.5" style={{ color: '#78716c' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#28251f' }}>
              {attachedFile.fileName}
            </p>
            <p className="text-[10px]" style={{ color: '#a19b93' }}>
              {formatFileSize(attachedFile.fileSize)}
            </p>
          </div>
          <button
            onClick={handleRemoveFile}
            className="p-1 rounded transition-colors"
            style={{ color: '#a19b93' }}
            onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
            onMouseLeave={e => e.currentTarget.style.color = '#a19b93'}
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
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-40"
          style={{ color: '#a19b93' }}
          onMouseEnter={e => e.currentTarget.style.color = '#57534e'}
          onMouseLeave={e => e.currentTarget.style.color = '#a19b93'}
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
                     focus:outline-none disabled:opacity-50"
          style={{
            background: '#f4f2ef',
            border: '1px solid #e8e5e0',
            color: '#1c1a17',
            maxHeight: '80px',
            lineHeight: '1.4',
            scrollbarWidth: 'none'
          }}
          onFocus={e => {
            e.target.style.borderColor = '#f4c430';
            e.target.style.boxShadow = '0 0 0 2px rgba(244,196,48,0.12)';
          }}
          onBlur={e => {
            e.target.style.borderColor = '#e8e5e0';
            e.target.style.boxShadow = 'none';
          }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                     transition-all duration-150 active:scale-95 disabled:cursor-not-allowed"
          style={{
            background: canSend ? 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)' : '#e8e5e0',
            color: canSend ? '#1c1a17' : '#a19b93',
            boxShadow: canSend ? '0 2px 8px rgba(244,196,48,0.3)' : 'none',
          }}
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