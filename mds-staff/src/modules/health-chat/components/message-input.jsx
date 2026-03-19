import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2, File, Image, Film, CheckCircle, XCircle } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { useHealthChatSocket } from '../hooks/use-health-chat-socket';
import { uploadFile, unstageFile } from '../health-chat-service';

const ACCEPTED_TYPES = 'image/jpeg,image/png,application/pdf,video/mp4,video/quicktime';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const MessageInput = () => {
  const { selectedChatId, selectedTicket, sendMessage, approveTicket, rejectTicket } = useHealthChat();
  const { emitTyping } = useHealthChatSocket();

  const [inputValue, setInputValue] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'approve' | 'reject' | null
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const isPending = selectedTicket?.status === 'Open';
  const isActive = selectedTicket?.status === 'Ongoing';
  const isClosed = ['Closed', 'Expired'].includes(selectedTicket?.status);
  const canSend = isActive && (inputValue.trim() || attachedFile) && !isSending;

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    try {
      setIsUploading(true);
      const fileId = await uploadFile(file);
      setAttachedFile({
        fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (attachedFile?.fileId) {
      try {
        await unstageFile(attachedFile.fileId);
      } catch (err) {
        console.error('Failed to unstage file:', err);
      }
    }
    setAttachedFile(null);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim() && selectedChatId) {
      emitTyping(selectedChatId, true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!canSend || !selectedChatId) return;

    try {
      setIsSending(true);
      emitTyping(selectedChatId, false);

      // Send file if attached
      if (attachedFile) {
        await sendMessage(selectedChatId, null, attachedFile.fileId, 'file');
        setAttachedFile(null);
      }

      // Send text if present
      if (inputValue.trim()) {
        await sendMessage(selectedChatId, inputValue.trim(), null, 'text');
        setInputValue('');
      }

      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const getFileIcon = () => {
    if (attachedFile?.fileType?.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    if (attachedFile?.fileType?.startsWith('video/')) return <Film className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-red-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleApprove = async () => {
    if (!selectedChatId || actionLoading) return;

    try {
      setActionLoading('approve');
      await approveTicket(selectedChatId);
    } catch (err) {
      console.error('Failed to approve ticket:', err);
      alert('Failed to approve ticket. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedChatId || actionLoading) return;

    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      setActionLoading('reject');
      await rejectTicket(selectedChatId, reason || null);
    } catch (err) {
      console.error('Failed to reject ticket:', err);
      alert('Failed to reject ticket. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Pending ticket - show accept/reject buttons
  if (isPending) {
    return (
      <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <div className="px-4 py-4">
          <div className="text-center mb-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              This patient is waiting for your response
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              Accept to start the conversation or reject with a reason
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400
                       rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {actionLoading === 'reject' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       bg-emerald-500 text-white rounded-lg
                       hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors font-medium shadow-sm"
            >
              {actionLoading === 'approve' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Closed/Expired ticket
  if (isClosed) {
    return (
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="text-sm text-center text-neutral-500 dark:text-neutral-400">
          This conversation has ended
        </div>
      </div>
    );
  }

  // Not active (shouldn't happen, but fallback)
  if (!isActive) {
    return (
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="text-sm text-center text-neutral-500 dark:text-neutral-400">
          {selectedTicket?.status === 'Open'
            ? 'Approve this ticket to start messaging'
            : 'This conversation has ended'}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      {/* File Preview */}
      {attachedFile && (
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
                {attachedFile.fileName}
              </p>
              <p className="text-xs text-neutral-500">{formatFileSize(attachedFile.fileSize)}</p>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-2">
          {/* File Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending || attachedFile}
            className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isSending}
              className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                       placeholder-neutral-400 dark:placeholder-neutral-500
                       resize-none text-sm disabled:opacity-50"
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="p-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                     disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed
                     transition-colors shadow-sm hover:shadow-md disabled:shadow-none"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
