import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, X, Loader2, File, Image, Film, CheckCircle, XCircle, Pill, Plus, Stethoscope } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { uploadFile, unstageFile } from '../health-chat-service';


const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maps common image extensions to MIME types for files copied from Windows Explorer (type is often '').
const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
};
/** Detect image MIME type from the first 12 magic bytes. */
const detectMimeFromBytes = (bytes) => {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
};
/** Resolves a DataTransferItem to a typed image File (async: may read magic bytes). */
const resolveClipboardImageFile = (item) => {
  if (item.kind !== 'file') return Promise.resolve(null);
  const raw = item.getAsFile();
  if (!raw) return Promise.resolve(null);
  if (raw.type.startsWith('image/')) return Promise.resolve(raw);
  const ext = raw.name.split('.').pop()?.toLowerCase();
  const mimeFromExt = EXT_TO_MIME[ext];
  if (mimeFromExt) return Promise.resolve(new File([raw], raw.name || `paste.${ext}`, { type: mimeFromExt }));
  // Magic bytes fallback for screenshots / web-copied images with no name/type
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bytes = new Uint8Array(ev.target.result);
      const mime = detectMimeFromBytes(bytes);
      resolve(mime ? new File([raw], `paste.${mime.split('/')[1]}`, { type: mime }) : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(raw.slice(0, 12));
  });
};

const MessageInput = ({ emitTyping, onOpenPrescription, onOpenConsultation }) => {
  const { selectedChatId, activeTicketId, selectedTicket, sendMessage, approveTicket, rejectTicket } = useHealthChat();

  const [inputValue, setInputValue]   = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading]         = useState(false);
  const [isSending, setIsSending]               = useState(false);
  const [actionLoading, setActionLoading]       = useState(null);
  const [showPlusMenu, setShowPlusMenu]         = useState(false);
  const fileInputRef  = useRef(null);
  const textareaRef   = useRef(null);
  const plusMenuRef   = useRef(null);

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

  const isPending = selectedTicket?.status === 'Open';
  const isActive  = selectedTicket?.status === 'Ongoing';
  const isClosed  = ['Closed', 'Expired'].includes(selectedTicket?.status);
  const canSend   = isActive && (inputValue.trim() || attachedFile) && !isSending && activeTicketId;

  const stageFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ACCEPTED_TYPES.split(',');
    if (!allowed.includes(file.type)) { alert('Unsupported file type.'); return; }
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Max 10MB.'); return; }
    try {
      setIsUploading(true);
      const fileId = await uploadFile(file);
      setAttachedFile({ fileId, fileName: file.name, fileType: file.type, fileSize: file.size });
    } catch { alert('Upload failed. Please try again.'); }
    finally { setIsUploading(false); }
  }, []);

  const handleFileSelect = (e) => {
    stageFile(e.target.files[0]);
    e.target.value = '';
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // First pass: direct image blob — resolveClipboardImageFile handles typed items,
    // extension fallback, and magic-bytes for screenshots/web-copies with no name.
    for (const item of items) {
      if (item.kind !== 'file') continue;
      e.preventDefault(); // Prevent text insertion eagerly before async resolution
      resolveClipboardImageFile(item).then((file) => {
        if (file && !attachedFile && !isUploading) {
          const ext = file.type.split('/')[1] || 'png';
          const named = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type });
          stageFile(named);
        }
      });
      return;
    }

    // Second pass: extract image from HTML clipboard content (e.g. copy from browser page)
    if (!attachedFile && !isUploading) {
      const html = e.clipboardData.getData('text/html');
      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match) {
          const src = match[1];
          const accepted = ACCEPTED_TYPES.split(',');
          if (src.startsWith('data:image/')) {
            e.preventDefault();
            const [header, base64] = src.split(',');
            const mimeMatch = header.match(/data:([^;]+);/);
            const mime = mimeMatch?.[1] || 'image/png';
            if (accepted.includes(mime)) {
              const byteString = atob(base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              const ext = mime.split('/')[1] || 'png';
              const file = new File([new Blob([ab], { type: mime })], `paste-${Date.now()}.${ext}`, { type: mime });
              stageFile(file);
            }
          } else if (src.startsWith('https://') || src.startsWith('http://')) {
            e.preventDefault();
            (async () => {
              try {
                const resp = await fetch(src);
                const blob = await resp.blob();
                if (blob.type.startsWith('image/') && accepted.includes(blob.type)) {
                  const ext = blob.type.split('/')[1] || 'png';
                  const file = new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type });
                  stageFile(file);
                }
              } catch {
                // CORS or network error — silently ignore
              }
            })();
          }
        }
      }
    }
  }, [attachedFile, isUploading, stageFile]);

  const handleRemoveFile = async () => {
    if (attachedFile?.fileId) {
      try { await unstageFile(attachedFile.fileId); } catch {}
    }
    setAttachedFile(null);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim() && activeTicketId) emitTyping(activeTicketId, true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = async () => {
    if (!canSend || !activeTicketId) return;
    try {
      setIsSending(true);
      emitTyping(activeTicketId, false);
      if (attachedFile) {
        console.log('[MessageInput] Sending file message');
        await sendMessage(activeTicketId, null, attachedFile.fileId, 'file');
        setAttachedFile(null);
      }
      if (inputValue.trim()) {
        console.log('[MessageInput] Sending text message');
        await sendMessage(activeTicketId, inputValue.trim(), null, 'text');
        setInputValue('');
      }
    } catch (err) {
      console.error('[MessageInput] Send failed:', err);
      alert(`Failed to send message: ${err.message || 'Unknown error'}`);
    }
    finally {
      setIsSending(false);
      // Refocus input after sending so user can continue typing
      // Use double requestAnimationFrame for reliable focus after state updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      });
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
    if (actionLoading || !activeTicketId) return;
    try { setActionLoading('approve'); await approveTicket(activeTicketId); }
    catch { alert('Failed to approve.'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (actionLoading || !activeTicketId) return;
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try { setActionLoading('reject'); await rejectTicket(activeTicketId, reason || null); }
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
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileSelect} className="hidden" />

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
              className="absolute bottom-full left-0 mb-2 z-50 min-w-[240px] rounded-2xl overflow-hidden
                         bg-white dark:bg-[rgba(22,22,26,0.97)]
                         border border-neutral-200 dark:border-white/[0.06]
                         shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.3)]
                         backdrop-blur-md"
              style={{ animation: 'hc-sheet-up 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              {/* Attach File */}
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                disabled={isUploading || isSending || !!attachedFile}
                className="w-full flex items-center justify-between px-5 py-4
                           text-neutral-800 dark:text-white
                           hover:bg-neutral-100 dark:hover:bg-white/[0.07]
                           active:bg-neutral-200 dark:active:bg-white/10
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-[15px] font-medium tracking-[-0.01em]">
                  {isUploading ? 'Uploading…' : 'Attach file'}
                </span>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-[rgba(59,130,246,0.25)]">
                  {isUploading
                    ? <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    : <Paperclip className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  }
                </span>
              </button>

              <div className="mx-4 border-b border-neutral-200 dark:border-white/[0.07]" />

              {/* Consultation */}
              <button
                type="button"
                onClick={() => { onOpenConsultation?.(); setShowPlusMenu(false); }}
                disabled={isSending}
                className="w-full flex items-center justify-between px-5 py-4
                           text-neutral-800 dark:text-white
                           hover:bg-neutral-100 dark:hover:bg-white/[0.07]
                           active:bg-neutral-200 dark:active:bg-white/10
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-[15px] font-medium tracking-[-0.01em]">Consultation</span>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-[rgba(59,130,246,0.25)]">
                  <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </span>
              </button>

              <div className="mx-4 border-b border-neutral-200 dark:border-white/[0.07]" />

              {/* Prescription */}
              <button
                type="button"
                onClick={() => { onOpenPrescription?.(); setShowPlusMenu(false); }}
                disabled={isSending}
                className="w-full flex items-center justify-between px-5 py-4
                           text-neutral-800 dark:text-white
                           hover:bg-neutral-100 dark:hover:bg-white/[0.07]
                           active:bg-neutral-200 dark:active:bg-white/10
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-[15px] font-medium tracking-[-0.01em]">Prescription</span>
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
            disabled={isSending}
            className={`p-1.5 rounded-full transition-all duration-200 disabled:opacity-40
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
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
