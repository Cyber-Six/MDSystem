import React from 'react';
import { Info, File, Image, Film } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';

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
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px]"
          style={{
            background: '#f4f2ef',
            border: '1px solid #e8e5e0',
            color: '#78716c'
          }}
        >
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
      className={`flex gap-2 ${isPatient ? 'flex-row' : 'flex-row-reverse'} items-end`}
      style={{ marginBottom: isLastInGroup ? '5px' : '1px' }}
    >
      {/* Avatar — patient only, last in group; hidden spacer otherwise */}
      {isPatient && (
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={
            isLastInGroup
              ? { background: '#f4c430', color: '#1c1a17' }
              : { visibility: 'hidden' }
          }
        >
          {message.sender?.firstName?.[0] || 'P'}
        </div>
      )}

      {/* Content */}
      <div
        className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'}`}
        style={{ maxWidth: '52%' }}
      >
        {/* Sender label — only first in group */}
        {isFirstInGroup && (
          <span
            className="text-[10px] font-medium mb-0.5 px-1"
            style={{
              color: '#a19b93',
              fontFamily: isPatient ? 'inherit' : 'Fira Code, monospace'
            }}
          >
            {isPatient ? (message.sender?.firstName || 'Patient') : getSenderName()}
          </span>
        )}

        {/* Bubble */}
        <div
          className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
          style={
            isPatient
              ? {
                  background: '#fdfcfa',
                  color: '#1c1a17',
                  border: '1px solid #e8e5e0',
                  borderRadius: isFirstInGroup && isLastInGroup ? '4px 14px 14px 14px'
                              : isFirstInGroup                  ? '4px 14px 14px 14px'
                              : isLastInGroup                   ? '14px 14px 14px 4px'
                              :                                   '14px',
                  boxShadow: '0 1px 2px rgba(28,25,23,0.05)'
                }
              : {
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  color: '#1c1a17',
                  borderRadius: isFirstInGroup && isLastInGroup ? '14px 4px 14px 14px'
                              : isFirstInGroup                  ? '14px 4px 14px 14px'
                              : isLastInGroup                   ? '14px 14px 14px 4px'
                              :                                   '14px',
                  boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
                }
          }
        >
          {message.text}
        </div>

        {/* Timestamp — only last in group */}
        {isLastInGroup && (
          <span
            className="text-[10px] mt-0.5 px-1"
            style={{ color: '#d5d1cb', fontFamily: 'Fira Code, monospace' }}
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
  const fileUrl = getFileUrl(message.filename);
  const ext = message.filename?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
  const isPdf   = ext === 'pdf';
  const isVideo = ['mp4', 'mov'].includes(ext);

  const Icon = isImage ? Image : isVideo ? Film : File;

  return (
    <div
      className={`flex gap-2 ${isPatient ? 'flex-row' : 'flex-row-reverse'} items-end`}
      style={{ marginBottom: isLastInGroup ? '5px' : '1px' }}
    >
      {isPatient && (
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={isLastInGroup ? { background: '#f4c430', color: '#1c1a17' } : { visibility: 'hidden' }}
        >
          {message.sender?.firstName?.[0] || 'P'}
        </div>
      )}

      <div
        className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'}`}
        style={{ maxWidth: '68%' }}
      >
        {isFirstInGroup && (
          <span
            className="text-[10px] font-medium mb-0.5 px-1"
            style={{ color: '#a19b93' }}
          >
            {isPatient ? (message.sender?.firstName || 'Patient') : getSenderName()}
          </span>
        )}

        <div
          className="overflow-hidden"
          style={{
            border: isPatient ? '1px solid #e8e5e0' : 'none',
            background: isPatient ? '#fdfcfa' : '#28251f',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(28,25,23,0.06)'
          }}
        >
          {isImage && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <img src={fileUrl} alt="Attachment" className="max-w-full max-h-52 object-contain block" loading="lazy" />
            </a>
          )}
          {isPdf && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: isPatient ? '#44403c' : '#fdfcfa' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              View PDF Document
            </a>
          )}
          {isVideo && <video src={fileUrl} controls className="max-w-full max-h-52 block" preload="metadata" />}
          {!isImage && !isPdf && !isVideo && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 text-xs hover:opacity-80 transition-opacity"
              style={{ color: isPatient ? '#44403c' : '#fdfcfa' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              Download Attachment
            </a>
          )}
        </div>

        {isLastInGroup && (
          <span
            className="text-[10px] mt-0.5 px-1"
            style={{ color: '#d5d1cb', fontFamily: 'Fira Code, monospace' }}
          >
            {formatTime(message.stamp)}
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;