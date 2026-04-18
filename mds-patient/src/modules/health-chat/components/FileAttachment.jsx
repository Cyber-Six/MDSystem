import React, { useRef, useState, useCallback } from 'react';
import { Paperclip, X, File, Image, Film, Loader2 } from 'lucide-react';
import { uploadFile, unstageFile, getFileUrl } from '../health-chat-service';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime';
const ACCEPTED_MIME_LIST = ACCEPTED_TYPES.split(',');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Stage a raw File object — shared by file picker and clipboard paste.
 */
const stageFileObject = async (file, onFileStaged, setIsUploading, onError) => {
  if (!ACCEPTED_MIME_LIST.includes(file.type)) {
    onError?.('Unsupported file type.');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    onError?.('File too large. Maximum size is 10MB.');
    return;
  }
  try {
    setIsUploading(true);
    const fileId = await uploadFile(file);
    onFileStaged?.({ fileId, fileName: file.name, fileType: file.type, fileSize: file.size });
  } catch (error) {
    console.error('[FileAttachment] Upload failed:', error);
    onError?.('Failed to upload file. Please try again.');
  } finally {
    setIsUploading(false);
  }
};

// Maps common image file extensions to MIME types.
// Used to resolve files copied from Windows File Explorer where item.type is often empty.
const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
};

/** Detect image MIME type from magic bytes (first 12 bytes of the file). */
const detectMimeFromBytes = (bytes) => {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
  // WebP: RIFF????WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
};

/**
 * Resolve a DataTransferItem to a typed image File.
 * Strategy: item.type → filename extension → magic bytes (async).
 * Returns a Promise<File|null>.
 */
const resolveClipboardImageFile = (item) => {
  if (item.kind !== 'file') return Promise.resolve(null);
  const raw = item.getAsFile();
  if (!raw) return Promise.resolve(null);

  // Already typed
  if (raw.type.startsWith('image/')) return Promise.resolve(raw);

  // Extension fallback (Windows File Explorer)
  const ext = raw.name.split('.').pop()?.toLowerCase();
  const mimeFromExt = EXT_TO_MIME[ext];
  if (mimeFromExt) return Promise.resolve(new File([raw], raw.name || `paste.${ext}`, { type: mimeFromExt }));

  // Magic bytes fallback (screenshots / web-copy where name is '')
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bytes = new Uint8Array(ev.target.result);
      const mime = detectMimeFromBytes(bytes);
      if (mime) {
        const detectedExt = mime.split('/')[1];
        resolve(new File([raw], `paste.${detectedExt}`, { type: mime }));
      } else {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(raw.slice(0, 12));
  });
};

/**
 * Hook: attach to a textarea/input onPaste to intercept clipboard images.
 * Returns an onPaste handler that uploads pasted images as staged files.
 */
export const useClipboardPaste = ({ onFileStaged, disabled, onError }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handlePaste = useCallback((e) => {
    if (disabled || isUploading) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    // First pass: look for a direct image file blob in the clipboard.
    // resolveClipboardImageFile handles typed items, extension fallback, and magic-bytes detection.
    for (const item of items) {
      if (item.kind !== 'file') continue;
      e.preventDefault(); // Prevent text insertion eagerly before async resolution
      resolveClipboardImageFile(item).then((file) => {
        if (!file) return;
        const ext = file.type.split('/')[1] || 'png';
        const named = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type });
        stageFileObject(named, onFileStaged, setIsUploading, onError);
      });
      return;
    }

    // Second pass: extract image from HTML clipboard content (e.g. copy from browser page)
    const html = e.clipboardData.getData('text/html');
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match) {
        const src = match[1];
        if (src.startsWith('data:image/')) {
          e.preventDefault();
          const [header, base64] = src.split(',');
          const mimeMatch = header.match(/data:([^;]+);/);
          const mime = mimeMatch?.[1] || 'image/png';
          if (ACCEPTED_MIME_LIST.includes(mime)) {
            const byteString = atob(base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const ext = mime.split('/')[1] || 'png';
            const file = new File([new Blob([ab], { type: mime })], `paste-${Date.now()}.${ext}`, { type: mime });
            stageFileObject(file, onFileStaged, setIsUploading, onError);
          }
        } else if (src.startsWith('https://') || src.startsWith('http://')) {
          e.preventDefault();
          (async () => {
            try {
              const resp = await fetch(src);
              const blob = await resp.blob();
              if (blob.type.startsWith('image/') && ACCEPTED_MIME_LIST.includes(blob.type)) {
                const ext = blob.type.split('/')[1] || 'png';
                const file = new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type });
                stageFileObject(file, onFileStaged, setIsUploading, onError);
              }
            } catch {
              // CORS or network error — silently ignore
            }
          })();
        }
      }
    }
  }, [disabled, isUploading, onFileStaged, onError]);

  return { handlePaste, isUploadingFromClipboard: isUploading };
};

/**
 * File attachment button with upload functionality
 */
export const FileAttachButton = ({ onFileStaged, disabled, onError }) => {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    await stageFileObject(file, onFileStaged, setIsUploading, onError);
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
