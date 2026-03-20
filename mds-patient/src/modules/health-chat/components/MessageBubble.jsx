import React from 'react';
import { Stethoscope, Info, File, Image, Film } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';

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
        <div
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs"
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
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={
            isLastInGroup
              ? { background: 'rgba(244,196,48,0.15)', border: '1.5px solid rgba(244,196,48,0.3)' }
              : { visibility: 'hidden' }
          }
        >
          <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
        </div>
      )}

      {/* Bubble + timestamp */}
      <div
        className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: '76%' }}
      >
        {/* Sender label — only on first bubble of a staff group */}
        {!isPatient && isFirstInGroup && (
          <span
            className="text-[10px] font-medium mb-1 px-1"
            style={{ color: '#a19b93' }}
          >
            Medical Staff
          </span>
        )}

        {/* Bubble — corner radius adapts to position in group */}
        <div
          className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={
            isPatient
              ? {
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  color: '#1c1a17',
                  borderRadius: isFirstInGroup && isLastInGroup ? '18px 18px 4px 18px'
                              : isFirstInGroup                  ? '18px 18px 18px 18px'
                              : isLastInGroup                   ? '18px 18px 4px 18px'
                              :                                   '18px 18px 18px 18px',
                  boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
                }
              : {
                  background: '#fdfcfa',
                  color: '#28251f',
                  border: '1.5px solid #e8e5e0',
                  borderRadius: isFirstInGroup && isLastInGroup ? '18px 18px 18px 4px'
                              : isFirstInGroup                  ? '18px 18px 18px 18px'
                              : isLastInGroup                   ? '18px 18px 18px 4px'
                              :                                   '18px 18px 18px 18px',
                  boxShadow: '0 1px 4px rgba(28,25,23,0.06)'
                }
          }
        >
          {message.text}
        </div>

        {/* Timestamp — only on last bubble */}
        {isLastInGroup && (
          <span
            className="text-[10px] mt-1 px-1"
            style={{ color: '#a19b93' }}
          >
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
const FileMessage = ({ fileId, isPatient, timestamp, formatTime, isFirstInGroup = true, isLastInGroup = true }) => {
  const fileUrl = getFileUrl(fileId);
  const extension = fileId?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(extension);
  const isPdf = extension === 'pdf';
  const isVideo = ['mp4', 'mov'].includes(extension);

  const getIcon = () => {
    if (isImage) return <Image className="w-4 h-4" />;
    if (isVideo) return <Film className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className={`flex gap-2 ${isPatient ? 'flex-row-reverse' : 'flex-row'} items-end`}
      style={{ marginBottom: isLastInGroup ? '6px' : '2px' }}
    >
      {/* Avatar — staff only */}
      {!isPatient && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={
            isLastInGroup
              ? { background: 'rgba(244,196,48,0.15)', border: '1.5px solid rgba(244,196,48,0.3)' }
              : { visibility: 'hidden' }
          }
        >
          <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
        </div>
      )}

      <div
        className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: '76%' }}
      >
        {!isPatient && isFirstInGroup && (
          <span className="text-[10px] font-medium mb-1 px-1" style={{ color: '#a19b93' }}>
            Medical Staff
          </span>
        )}

        <div
          className="rounded-2xl overflow-hidden"
          style={
            isPatient
              ? {
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  borderBottomRightRadius: '4px',
                  boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
                }
              : {
                  background: '#fdfcfa',
                  border: '1.5px solid #e8e5e0',
                  borderBottomLeftRadius: '4px',
                  boxShadow: '0 1px 4px rgba(28,25,23,0.06)'
                }
          }
        >
          {isImage && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={fileUrl}
                alt="Attachment"
                className="max-w-full max-h-56 object-contain"
                loading="lazy"
              />
            </a>
          )}

          {isPdf && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: isPatient ? '#1c1a17' : '#44403c' }}
            >
              {getIcon()}
              View PDF
            </a>
          )}

          {isVideo && (
            <video src={fileUrl} controls className="max-w-full max-h-56" preload="metadata" />
          )}

          {!isImage && !isPdf && !isVideo && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 text-sm hover:opacity-80 transition-opacity"
              style={{ color: isPatient ? '#1c1a17' : '#44403c' }}
            >
              {getIcon()}
              Download file
            </a>
          )}
        </div>

        {isLastInGroup && (
          <span className="text-[10px] mt-1 px-1" style={{ color: '#a19b93' }}>
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;