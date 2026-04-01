import React, { useState } from 'react';
import { Info, File, Image, Film, Loader2 } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';
import { useAuthFile } from '../hooks/use-auth-file';
import MediaViewer from '../../../components/ui/MediaViewer';

/**
 * Staff-side MessageBubble
 * - Patient messages: left, stone background, amber avatar initials
 * - Staff messages: right, dark secondary background, white text, real sender name above
 * - System: centered pill
 * - isFirstInGroup / isLastInGroup: controls avatar and label visibility
 */
const MessageBubble = ({ message, formatTime, isFirstInGroup = true, isLastInGroup = true }) => {
  const isPatient = message.userType === 'Patient';
  const isSystem  = message.promptType === 'system';
  const isFile    = message.promptType === 'file';

  const getSenderName = () => {
    if (message.sender) {
      return `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 'Staff';
    }
    return 'Staff';
  };

  // ── System pill ──
  if (isSystem) {
    return (
      <div className="flex justify-center py-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
          <Info className="w-3 h-3 flex-shrink-0" />
          {message.text}
        </div>
      </div>
    );
  }

  // ── File message ──
  if (isFile && message.filename) {
    return (
      <FileMessage
        message={message}
        isPatient={isPatient}
        getSenderName={getSenderName}
        formatTime={formatTime}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    );
  }

  // ── Text message ──
  return (
    <div
      className={`flex gap-2 min-w-0 ${isPatient ? 'flex-row' : 'flex-row-reverse'} items-end`}
      style={{ marginBottom: isLastInGroup ? '5px' : '1px', width: '100%' }}
    >
      {/* Avatar — patient only, last in group; hidden spacer otherwise */}
      {isPatient && (
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-primary-500 text-secondary-900"
          style={!isLastInGroup ? { visibility: 'hidden' } : undefined}
        >
          {message.sender?.firstName?.[0] || 'P'}
        </div>
      )}

      {/* Content */}
      <div
        className={`flex flex-col min-w-0 ${isPatient ? 'items-start' : 'items-end'}`}
        style={{ maxWidth: '75%' }}
      >
        {/* Sender label — only first in group */}
        {isFirstInGroup && (
          <span
            className="text-[10px] font-medium mb-0.5 px-1 text-neutral-400 dark:text-neutral-500"
            style={{ fontFamily: isPatient ? 'inherit' : 'Fira Code, monospace' }}
          >
            {isPatient ? (message.sender?.firstName || 'Patient') : getSenderName()}
          </span>
        )}

        {/* Bubble */}
        {isPatient ? (
          // Patient bubble - needs dark mode
          <div
            className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white dark:bg-neutral-800 text-secondary-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 shadow-sm"
            style={{
              borderRadius: isFirstInGroup && isLastInGroup ? '4px 14px 14px 14px'
                          : isFirstInGroup                  ? '4px 14px 14px 14px'
                          : isLastInGroup                   ? '14px 14px 14px 4px'
                          :                                   '14px'
            }}
          >
            {message.text}
          </div>
        ) : (
          // Staff bubble - keeps brand gradient (works in both modes)
          <div
            className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-secondary-900"
            style={{
              background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
              borderRadius: isFirstInGroup && isLastInGroup ? '14px 4px 14px 14px'
                          : isFirstInGroup                  ? '14px 4px 14px 14px'
                          : isLastInGroup                   ? '14px 14px 14px 4px'
                          :                                   '14px',
              boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
            }}
          >
            {message.text}
          </div>
        )}

        {/* Timestamp — only last in group */}
        {isLastInGroup && (
          <span
            className="text-[10px] mt-0.5 px-1 text-neutral-300 dark:text-neutral-600"
            style={{ fontFamily: 'Fira Code, monospace' }}
          >
            {formatTime(message.stamp)}
          </span>
        )}
      </div>
    </div>
  );
};

// ── File sub-component ──
const FileMessage = ({ message, isPatient, getSenderName, formatTime, isFirstInGroup, isLastInGroup }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileUrl = getFileUrl(message.filename);
  const { blobUrl, loading: fileLoading, error: fileError, contentType } = useAuthFile(fileUrl);
  // Use the server-supplied Content-Type for reliable type detection.
  // message.filename is stored as a UUID without extension, so extension sniffing fails.
  const isImage = contentType.startsWith('image/');
  const isPdf   = contentType === 'application/pdf';
  const isVideo = contentType.startsWith('video/');

  const Icon = isImage ? Image : isVideo ? Film : File;
  const displayUrl = blobUrl || fileUrl;

  return (
    <>
      <div
        className={`flex gap-2 min-w-0 ${isPatient ? 'flex-row' : 'flex-row-reverse'} items-end`}
        style={{ marginBottom: isLastInGroup ? '5px' : '1px', width: '100%' }}
      >
        {isPatient && (
          <div
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-primary-500 text-secondary-900"
            style={!isLastInGroup ? { visibility: 'hidden' } : undefined}
          >
            {message.sender?.firstName?.[0] || 'P'}
          </div>
        )}

        <div
          className={`flex flex-col min-w-0 ${isPatient ? 'items-start' : 'items-end'}`}
          style={{ maxWidth: '75%' }}
        >
          {isFirstInGroup && (
            <span className="text-[10px] font-medium mb-0.5 px-1 text-neutral-400 dark:text-neutral-500">
              {isPatient ? (message.sender?.firstName || 'Patient') : getSenderName()}
            </span>
          )}

          {/* Loading state */}
          {fileLoading && (
            <div className="flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 w-full max-w-[280px] min-h-[100px]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                <span className="text-xs text-neutral-400">Loading…</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {!fileLoading && fileError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 w-full max-w-[280px]">
              <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <span className="text-xs text-neutral-400">Unable to load file</span>
            </div>
          )}

          {/* Loaded content */}
          {!fileLoading && !fileError && (
            isPatient ? (
              // Patient file container
              <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm max-w-full">
                {isImage && (
                  <button onClick={() => setLightboxOpen(true)} className="cursor-zoom-in block max-w-full">
                    <img src={displayUrl} alt="Attachment" className="max-w-full max-h-52 object-contain block" loading="lazy" />
                  </button>
                )}
                {isPdf && (
                  <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs font-medium hover:opacity-80 transition-opacity text-neutral-600 dark:text-neutral-300 w-full">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    View PDF Document
                  </button>
                )}
                {isVideo && (
                  <button onClick={() => setLightboxOpen(true)} className="cursor-pointer block w-full">
                    <video src={displayUrl} className="max-w-full max-h-52 block pointer-events-none" preload="metadata" />
                  </button>
                )}
                {!isImage && !isPdf && !isVideo && (
                  <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs hover:opacity-80 transition-opacity text-neutral-600 dark:text-neutral-300 w-full">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    View Attachment
                  </button>
                )}
              </div>
            ) : (
              // Staff file container
              <div className="overflow-hidden rounded-xl bg-neutral-800 dark:bg-neutral-900 shadow-sm max-w-full">
                {isImage && (
                  <button onClick={() => setLightboxOpen(true)} className="cursor-zoom-in block max-w-full">
                    <img src={displayUrl} alt="Attachment" className="max-w-full max-h-52 object-contain block" loading="lazy" />
                  </button>
                )}
                {isPdf && (
                  <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs font-medium hover:opacity-80 transition-opacity text-neutral-100 w-full">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    View PDF Document
                  </button>
                )}
                {isVideo && (
                  <button onClick={() => setLightboxOpen(true)} className="cursor-pointer block w-full">
                    <video src={displayUrl} className="max-w-full max-h-52 block pointer-events-none" preload="metadata" />
                  </button>
                )}
                {!isImage && !isPdf && !isVideo && (
                  <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs hover:opacity-80 transition-opacity text-neutral-100 w-full">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    View Attachment
                  </button>
                )}
              </div>
            )
          )}

          {isLastInGroup && (
            <span
              className="text-[10px] mt-0.5 px-1 text-neutral-300 dark:text-neutral-600"
              style={{ fontFamily: 'Fira Code, monospace' }}
            >
              {formatTime(message.stamp)}
            </span>
          )}
        </div>
      </div>

      {/* Media Viewer */}
      {lightboxOpen && blobUrl && (
        <MediaViewer
          url={blobUrl}
          filename={message.filename}
          contentType={contentType}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default React.memo(MessageBubble);
