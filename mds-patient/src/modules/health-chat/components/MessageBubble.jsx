import React, { useState } from 'react';
import { Stethoscope, Info, File, Image, Film, Loader2 } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';
import { useAuthFile } from '../hooks/use-auth-file';
import MediaLightbox from '../../../components/modals/MediaLightbox';

/**
 * MessageBubble — patient side
 * Warm & casual: amber sent bubbles, white received, friendly avatars
 * isFirstInGroup — show sender label (staff only)
 * isLastInGroup  — show avatar; hide it for middle bubbles in a run
 */
const MessageBubble = ({ message, formatTime, isFirstInGroup = true, isLastInGroup = true }) => {
  const isPatient = message.userType === 'Patient';
  const isSystem = message.promptType === 'system';
  const isFile = message.promptType === 'file';

  // System event pill
  if (isSystem) {
    return (
      <div className="flex justify-center py-3 px-4">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
          <Info className="w-3 h-3 flex-shrink-0" />
          {message.text}
        </div>
      </div>
    );
  }

  // File messages
  if (isFile && message.filename) {
    return (
      <FileMessage
        fileId={message.filename}
        isPatient={isPatient}
        timestamp={message.stamp}
        formatTime={formatTime}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
        senderName={message.sender?.firstName
          ? `${message.sender.firstName}${message.sender.lastName ? ' ' + message.sender.lastName : ''}`
          : null}
      />
    );
  }

  // Text messages
  return (
    <div className={`flex gap-2 ${isPatient ? 'flex-row-reverse' : 'flex-row'} items-end`}
      style={{ marginBottom: isLastInGroup ? '6px' : '2px' }}
    >
      {/* Avatar — staff only, hidden on patient side entirely */}
      {!isPatient && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary-500/15 border-[1.5px] border-primary-500/30"
          style={!isLastInGroup ? { visibility: 'hidden' } : undefined}
        >
          <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
        </div>
      )}

      {/* Bubble + timestamp */}
      <div
        className={`flex flex-col min-w-0 max-w-[90%] sm:max-w-[82%] lg:max-w-[76%] ${isPatient ? 'items-end' : 'items-start'}`}
      >
        {/* Sender label — only on first bubble of a staff group */}
        {!isPatient && isFirstInGroup && (
          <span className="text-[10px] font-medium mb-1 px-1 text-neutral-400 dark:text-neutral-500">
            {message.sender?.firstName
              ? `${message.sender.firstName}${message.sender.lastName ? ' ' + message.sender.lastName : ''}`
              : 'Medical Staff'}
          </span>
        )}

        {/* Bubble — corner radius adapts to position in group */}
        {isPatient ? (
          // Patient bubble - keeps brand gradient (works in both modes)
          <div
            className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-secondary-900"
            style={{
              background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
              borderRadius: isFirstInGroup && isLastInGroup ? '18px 18px 4px 18px'
                          : isFirstInGroup                  ? '18px 18px 18px 18px'
                          : isLastInGroup                   ? '18px 18px 4px 18px'
                          :                                   '18px 18px 18px 18px',
              boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
            }}
          >
            {message.text}
          </div>
        ) : (
          // Staff bubble - needs dark mode
          <div
            className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white dark:bg-neutral-800 text-secondary-800 dark:text-neutral-100 border-[1.5px] border-neutral-200 dark:border-neutral-700 shadow-sm"
            style={{
              borderRadius: isFirstInGroup && isLastInGroup ? '18px 18px 18px 4px'
                          : isFirstInGroup                  ? '18px 18px 18px 18px'
                          : isLastInGroup                   ? '18px 18px 18px 4px'
                          :                                   '18px 18px 18px 18px'
            }}
          >
            {message.text}
          </div>
        )}

        {/* Timestamp — only on last bubble */}
        {isLastInGroup && (
          <span className="text-[10px] mt-1 px-1 text-neutral-400 dark:text-neutral-500">
            {formatTime(message.stamp)}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * FileMessage — patient side
 */
const FileMessage = ({ fileId, isPatient, timestamp, formatTime, isFirstInGroup = true, isLastInGroup = true, senderName }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileUrl = getFileUrl(fileId);
  const { blobUrl, loading: fileLoading, error: fileError, contentType } = useAuthFile(fileUrl);
  // Use Content-Type from response header — filename is stored as UUID without extension
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  const isVideo = contentType.startsWith('video/');

  const getIcon = () => {
    if (isImage) return <Image className="w-4 h-4" />;
    if (isVideo) return <Film className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const displayUrl = blobUrl || fileUrl;

  return (
    <>
      <div className={`flex gap-2 ${isPatient ? 'flex-row-reverse' : 'flex-row'} items-end`}
        style={{ marginBottom: isLastInGroup ? '6px' : '2px' }}
      >
        {/* Avatar — staff only */}
        {!isPatient && (
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary-500/15 border-[1.5px] border-primary-500/30"
            style={!isLastInGroup ? { visibility: 'hidden' } : undefined}
          >
            <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
          </div>
        )}

        <div
          className={`flex flex-col min-w-0 max-w-[90%] sm:max-w-[82%] lg:max-w-[76%] ${isPatient ? 'items-end' : 'items-start'}`}
        >
          {!isPatient && isFirstInGroup && (
            <span className="text-[10px] font-medium mb-1 px-1 text-neutral-400 dark:text-neutral-500">
              {senderName || 'Medical Staff'}
            </span>
          )}

          {fileLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              <span className="text-xs text-neutral-400">Loading file…</span>
            </div>
          ) : fileError ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {getIcon()}
              <span className="text-xs text-neutral-400">Unable to load file</span>
            </div>
          ) : isPatient ? (
            // Patient file container
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                borderBottomRightRadius: '4px',
                boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
              }}
            >
              {isImage && (
                <button onClick={() => setLightboxOpen(true)} className="cursor-zoom-in block">
                  <img src={displayUrl} alt="Attachment" className="max-w-full max-h-56 object-contain" loading="lazy" />
                </button>
              )}
              {isPdf && (
                <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-80 transition-opacity text-secondary-900">
                  {getIcon()}
                  View PDF Document
                </button>
              )}
              {isVideo && <video src={displayUrl} controls className="max-w-full max-h-56" preload="metadata" />}
              {!isImage && !isPdf && !isVideo && (
                <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-sm hover:opacity-80 transition-opacity text-secondary-900">
                  {getIcon()}
                  View Attachment
                </button>
              )}
            </div>
          ) : (
            // Staff file container
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-800 border-[1.5px] border-neutral-200 dark:border-neutral-700 shadow-sm"
              style={{ borderBottomLeftRadius: '4px' }}
            >
              {isImage && (
                <button onClick={() => setLightboxOpen(true)} className="cursor-zoom-in block">
                  <img src={displayUrl} alt="Attachment" className="max-w-full max-h-56 object-contain" loading="lazy" />
                </button>
              )}
              {isPdf && (
                <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-80 transition-opacity text-neutral-600 dark:text-neutral-300">
                  {getIcon()}
                  View PDF Document
                </button>
              )}
              {isVideo && <video src={displayUrl} controls className="max-w-full max-h-56" preload="metadata" />}
              {!isImage && !isPdf && !isVideo && (
                <button onClick={() => setLightboxOpen(true)} className="flex items-center gap-2 px-4 py-3 text-sm hover:opacity-80 transition-opacity text-neutral-600 dark:text-neutral-300">
                  {getIcon()}
                  View Attachment
                </button>
              )}
            </div>
          )}

          {isLastInGroup && (
            <span className="text-[10px] mt-1 px-1 text-neutral-400 dark:text-neutral-500">
              {formatTime(timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Media Lightbox */}
      {lightboxOpen && blobUrl && (
        <MediaLightbox
          url={blobUrl}
          filename={fileId}
          contentType={contentType}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default React.memo(MessageBubble);
