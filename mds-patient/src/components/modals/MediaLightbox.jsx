import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { X, FileText } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.25;

function normalizeContentType(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

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
    const normalizedContentType = normalizeContentType(contentType);

    if (normalizedContentType) {
      if (normalizedContentType.startsWith('image/')) return 'image';
      if (normalizedContentType === 'application/pdf') return 'pdf';
      if (normalizedContentType.startsWith('video/')) return 'video';
      return 'file';
    }
    // Fallback to extension
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['mp4', 'mov', 'webm', 'ogg', 'avi'].includes(ext)) return 'video';
    return 'file';
  };

  const mediaType = useMemo(getMediaType, [contentType, filename]);
  const isImage = mediaType === 'image';
  const isPdf = mediaType === 'pdf';
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginRef = useRef(null);

  const clampScale = useCallback((nextScale) => {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(nextScale.toFixed(3))));
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    dragOriginRef.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    setScale((previousScale) => clampScale(previousScale + ZOOM_STEP));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    setScale((previousScale) => {
      const nextScale = clampScale(previousScale - ZOOM_STEP);
      if (nextScale <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return nextScale;
    });
  }, [clampScale]);

  // Handle escape key to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (!isImage) {
      return;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-') {
      e.preventDefault();
      zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      resetView();
    }
  }, [onClose, isImage, zoomIn, zoomOut, resetView]);

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

  const handleWheel = useCallback((event) => {
    if (!isImage) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setScale((previousScale) => {
      const nextScale = clampScale(previousScale + delta);
      if (nextScale <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return nextScale;
    });
  }, [isImage, clampScale]);

  const handleMouseDown = useCallback((event) => {
    if (!isImage || scale <= 1 || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
    dragOriginRef.current = {
      x: event.clientX - pan.x,
      y: event.clientY - pan.y
    };
  }, [isImage, scale, pan.x, pan.y]);

  const handleMouseMove = useCallback((event) => {
    if (!isDragging || !dragOriginRef.current) {
      return;
    }

    setPan({
      x: event.clientX - dragOriginRef.current.x,
      y: event.clientY - dragOriginRef.current.y
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragOriginRef.current = null;
  }, []);

  useEffect(() => {
    resetView();
  }, [url, mediaType, resetView]);

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

          {isImage && (
            <div className="mr-2 flex items-center gap-1">
              <button
                onClick={zoomOut}
                disabled={scale <= MIN_SCALE}
                className="px-2 py-1 rounded text-xs font-semibold text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom out"
              >
                -
              </button>
              <button
                onClick={resetView}
                className="px-2 py-1 rounded text-[11px] font-mono text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                title="Reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={scale >= MAX_SCALE}
                className="px-2 py-1 rounded text-xs font-semibold text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom in"
              >
                +
              </button>
            </div>
          )}

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
          {isImage ? (
            <div
              className="flex min-h-full w-full items-center justify-center overflow-hidden p-4"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={resetView}
              style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            >
              <img
                src={url}
                alt={filename || 'Image'}
                className="object-contain"
                loading="lazy"
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                style={{
                  maxWidth: scale > 1 ? 'none' : '100%',
                  maxHeight: scale > 1 ? 'none' : '100%',
                  transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 120ms ease-out',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
            </div>
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
                {normalizeContentType(contentType) || 'Unknown type'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
