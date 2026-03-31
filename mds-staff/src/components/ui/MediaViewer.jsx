import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.3;

function deriveMediaType(contentType, filename) {
  if (contentType) {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'pdf';
    if (contentType.startsWith('video/')) return 'video';
  }
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'webm', 'ogg', 'avi'].includes(ext)) return 'video';
  return 'file';
}

/**
 * MediaViewer — full-screen media lightbox
 *
 * Supports:
 *  - Images: mouse-wheel zoom, click-drag pan, double-click to reset, keyboard +/-/0
 *  - Videos: native controls (download disabled)
 *  - PDFs: iframe full-height viewer
 *  - Fallback: file info card
 *
 * Usage (any module):
 *   import MediaViewer from '@/components/ui/MediaViewer';
 *   <MediaViewer url={blobUrl} contentType="image/jpeg" filename="photo.jpg" onClose={() => setOpen(false)} />
 *
 * Props:
 *   url         {string}   Blob URL or remote URL of the file to display
 *   contentType {string?}  MIME type — used for reliable type detection
 *   filename    {string?}  Display name shown in the toolbar
 *   onClose     {fn}       Called when the viewer should close
 */
const MediaViewer = ({ url, contentType, filename, onClose }) => {
  const mediaType = deriveMediaType(contentType, filename);
  const isImage = mediaType === 'image';
  const isPdf   = mediaType === 'pdf';
  const isVideo = mediaType === 'video';

  // ── Image zoom / pan state ──────────────────────────────────────────────
  const [scale, setScale]       = useState(1);
  const [pan, setPan]           = useState({ x: 0, y: 0 });
  const [isDragging, setDrag]   = useState(false);
  const dragOriginRef           = useRef(null);
  const contentRef              = useRef(null);

  const clampScale = (s) => parseFloat(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)).toFixed(3));

  const zoomIn = useCallback(() => setScale(s => clampScale(s + ZOOM_STEP)), []);
  const zoomOut = useCallback(() =>
    setScale(s => {
      const next = clampScale(s - ZOOM_STEP);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    }), []);
  const resetView = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!isImage) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      if (e.key === '-')                  { e.preventDefault(); zoomOut(); }
      if (e.key === '0')                  { e.preventDefault(); resetView(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, isImage, zoomIn, zoomOut, resetView]);

  // ── Mouse-wheel zoom (non-passive so preventDefault works) ──────────────
  const handleWheel = useCallback((e) => {
    if (!isImage) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setScale(s => {
      const next = clampScale(s + delta);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, [isImage]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isImage) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel, isImage]);

  // ── Click-drag pan ──────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (!isImage || scale <= 1 || e.button !== 0) return;
    e.preventDefault();
    setDrag(true);
    dragOriginRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = useCallback((e) => {
    if (!isDragging || !dragOriginRef.current) return;
    setPan({ x: e.clientX - dragOriginRef.current.x, y: e.clientY - dragOriginRef.current.y });
  }, [isDragging]);
  const onMouseUp = useCallback(() => {
    setDrag(false);
    dragOriginRef.current = null;
  }, []);

  // Touch pinch-to-zoom
  const lastTouchDist = useRef(null);
  const onTouchStart = (e) => {
    if (!isImage || e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist.current = Math.hypot(dx, dy);
  };
  const onTouchMove = (e) => {
    if (!isImage || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (lastTouchDist.current) {
      const ratio = dist / lastTouchDist.current;
      setScale(s => {
        const next = clampScale(s * ratio);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
    lastTouchDist.current = dist;
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const typeLabel  = isImage ? 'Image' : isPdf ? 'Document' : isVideo ? 'Video' : 'File';
  const pctDisplay = `${Math.round(scale * 100)}%`;
  const imageCursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';

  return (
    // Backdrop — z-[9999] ensures it is always above layout chrome (topbar z-20, sidebar z-50)
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 h-12 bg-neutral-900/95 border-b border-white/10 flex-shrink-0 backdrop-blur-sm select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* File info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-neutral-300 flex-shrink-0">{typeLabel}</span>
          {filename && (
            <span className="text-[10px] text-neutral-500 font-mono truncate">{filename}</span>
          )}
        </div>

        {/* Zoom controls — images only */}
        {isImage && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              title="Zoom out (−)"
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-300 disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              title="Reset zoom (0)"
              className="px-2 py-1 rounded text-[10px] font-mono text-neutral-400 hover:bg-white/10 transition-colors min-w-[52px] text-center"
            >
              {pctDisplay}
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              title="Zoom in (+)"
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-300 disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={resetView}
              title="Reset to fit"
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-500"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close viewer"
          className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-300 flex-shrink-0 ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={isImage ? { cursor: imageCursor } : undefined}
        onMouseDown={isImage ? onMouseDown : undefined}
        onMouseMove={isImage ? onMouseMove : undefined}
        onMouseUp={isImage ? onMouseUp : undefined}
        onMouseLeave={isImage ? onMouseUp : undefined}
        onDoubleClick={isImage ? resetView : undefined}
        onTouchStart={isImage ? onTouchStart : undefined}
        onTouchMove={isImage ? onTouchMove : undefined}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Image ─────────────────────────────────────────────────────── */}
        {isImage && (
          <img
            src={url}
            alt={filename || 'Image'}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              maxWidth:  scale > 1 ? 'none' : '100%',
              maxHeight: scale > 1 ? 'none' : '100%',
              objectFit: 'contain',
              transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 120ms ease-out',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── PDF ───────────────────────────────────────────────────────── */}
        {isPdf && (
          <iframe
            src={url}
            title={filename || 'PDF Document'}
            className="w-full h-full border-0 bg-neutral-800"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* ── Video ─────────────────────────────────────────────────────── */}
        {isVideo && (
          <video
            src={url}
            controls
            controlsList="nodownload"
            className="w-full h-full"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          >
            Your browser does not support video playback.
          </video>
        )}

        {/* ── Generic file fallback ──────────────────────────────────────── */}
        {!isImage && !isPdf && !isVideo && (
          <div
            className="flex flex-col items-center gap-4 p-10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center">
              <FileText className="w-10 h-10 text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-400">Preview not available for this file type.</p>
            {contentType && (
              <p className="text-xs text-neutral-600 font-mono">{contentType}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Image hint bar (only when at 1× scale) ────────────────────────── */}
      {isImage && scale === 1 && (
        <div className="flex-shrink-0 flex justify-center pb-3 pointer-events-none">
          <span className="text-[10px] text-neutral-600 font-mono select-none">
            Scroll to zoom · Drag to pan · Double-click to reset
          </span>
        </div>
      )}
    </div>
  );
};

export default MediaViewer;
