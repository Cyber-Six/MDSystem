import React, { useEffect, useCallback } from 'react';
import { X, FileText } from 'lucide-react';

/**
 * MediaLightbox - A modal component for viewing images, PDFs, and videos (view-only, no download)
 *
 * @param {string} url - The URL of the media file
 * @param {string} filename - The filename to display
 * @param {string} contentType - MIME type (e.g., 'image/jpeg', 'application/pdf', 'video/mp4')
 * @param {function} onClose - Callback when the lightbox is closed
 */
const MediaLightbox = ({ url, filename, contentType, onClose }) => {
  // Determine media type from contentType or filename extension
  const getMediaType = () => {
    if (contentType) {
      if (contentType.startsWith('image/')) return 'image';
      if (contentType === 'application/pdf') return 'pdf';
      if (contentType.startsWith('video/')) return 'video';
      return 'file';
    }
    // Fallback to extension
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
    return 'file';
  };

  const mediaType = getMediaType();
  const isPdf = mediaType === 'pdf';

  // Handle escape key to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[60]"
      style={{ padding: isPdf ? '0.5rem' : '1rem' }}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden ${
          isPdf ? 'h-[calc(100vh-1rem)]' : 'max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <p className="text-xs font-semibold text-secondary-800 dark:text-white">
              {mediaType === 'image' ? 'Image' : mediaType === 'pdf' ? 'Document' : mediaType === 'video' ? 'Video' : 'File'}
            </p>
            <p className="text-[10px] text-secondary-400 dark:text-neutral-500 font-mono truncate">
              {filename || 'Attachment'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-secondary-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center min-h-0 ${
          isPdf ? 'overflow-hidden' : 'overflow-auto'
        }`}>
          {mediaType === 'image' ? (
            <img
              src={url}
              alt={filename || 'Image'}
              className="max-w-full max-h-full object-contain p-4"
              loading="lazy"
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={filename || 'PDF Document'}
              className="w-full h-full border-0"
            />
          ) : mediaType === 'video' ? (
            <video
              src={url}
              controls
              controlsList="nodownload"
              className="max-w-full max-h-full p-4"
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                <FileText className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
              </div>
              <p className="text-sm text-secondary-600 dark:text-neutral-400">
                Preview not available for this file type.
              </p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500">
                {contentType || 'Unknown type'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
