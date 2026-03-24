import React, { useRef, useState } from 'react';
import { Paperclip, X, File, Image, Film, Loader2 } from 'lucide-react';
import { uploadFile, unstageFile, getFileUrl } from '../health-chat-service';

const ACCEPTED_TYPES = 'image/jpeg,image/png,application/pdf,video/mp4,video/quicktime';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * File attachment button with upload functionality
 */
export const FileAttachButton = ({ onFileStaged, disabled }) => {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    try {
      setIsUploading(true);
      const fileId = await uploadFile(file);
      onFileStaged?.({
        fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
    } catch (error) {
      console.error('[FileAttachment] Upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Attach file"
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </button>
    </>
  );
};

/**
 * Preview component for a staged file (before sending)
 */
export const FilePreview = ({ file, onRemove }) => {
  const [isRemoving, setIsRemoving] = useState(false);

  const getFileIcon = () => {
    if (file.fileType?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (file.fileType?.startsWith('video/')) {
      return <Film className="w-5 h-5 text-purple-500" />;
    }
    if (file.fileType === 'application/pdf') {
      return <File className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-neutral-500" />;
  };

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      await unstageFile(file.fileId);
      onRemove?.();
    } catch (error) {
      console.error('[FilePreview] Failed to remove:', error);
      onRemove?.(); // Still remove from UI
    } finally {
      setIsRemoving(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      {getFileIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
          {file.fileName}
        </p>
        <p className="text-xs text-neutral-500">
          {formatFileSize(file.fileSize)}
        </p>
      </div>
      <button
        onClick={handleRemove}
        disabled={isRemoving}
        className="p-1 text-neutral-400 hover:text-red-500 disabled:opacity-50 transition-colors"
      >
        {isRemoving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

/**
 * Display a file message in the chat (after sent)
 */
export const FileMessageBubble = ({ fileId, fileName, isPatient, timestamp, formatTime }) => {
  const fileUrl = getFileUrl(fileId);

  // Try to determine file type from extension
  const extension = fileId?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(extension);
  const isPdf = extension === 'pdf';
  const isVideo = ['mp4', 'mov'].includes(extension);

  const bubbleClass = isPatient
    ? 'bg-blue-600 text-white ml-auto'
    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white mr-auto';

  return (
    <div className={`max-w-[85%] rounded-xl overflow-hidden shadow-sm ${bubbleClass}`}>
      {isImage && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fileUrl}
            alt="Attachment"
            className="max-w-full max-h-64 object-contain"
            loading="lazy"
          />
        </a>
      )}

      {isPdf && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 p-3 ${isPatient ? 'text-white hover:bg-blue-700' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
        >
          <File className="w-6 h-6 flex-shrink-0" />
          <span className="text-sm font-medium">View PDF Document</span>
        </a>
      )}

      {isVideo && (
        <video
          src={fileUrl}
          controls
          className="max-w-full max-h-64"
          preload="metadata"
        />
      )}

      {!isImage && !isPdf && !isVideo && (
        <div
          className={`flex items-center gap-2 p-3 ${isPatient ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}`}
        >
          <File className="w-6 h-6" />
          <span className="text-sm">View Attachment</span>
        </div>
      )}

      {timestamp && (
        <div className={`px-3 py-1 text-[10px] ${isPatient ? 'text-blue-200' : 'text-neutral-400'}`}>
          {formatTime(timestamp)}
        </div>
      )}
    </div>
  );
};

export default {
  FileAttachButton,
  FilePreview,
  FileMessageBubble
};
