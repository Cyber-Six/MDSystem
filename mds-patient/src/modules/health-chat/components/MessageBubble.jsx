import React from 'react';
import { User, Heart, Info, File, Image, Film } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';

/**
 * Message bubble component for health chat
 * Supports text, file, and system messages
 *
 * Message structure:
 * - text: String content
 * - filename: UUID for file attachments
 * - promptType: 'text' | 'file' | 'system'
 * - userType: 'Patient' | 'Medical'
 * - stamp: Date timestamp
 * - sender: { firstName, lastName } (optional)
 */
const MessageBubble = ({ message, formatTime }) => {
  const isPatient = message.userType === 'Patient';
  const isSystem = message.promptType === 'system';
  const isFile = message.promptType === 'file';

  // System messages (ticket approved, closed, etc.)
  if (isSystem) {
    return (
      <div className="flex justify-center py-2 px-4">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-full max-w-[80%]">
          <Info className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
            {message.text}
          </span>
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
      />
    );
  }

  // Regular text messages
  return (
    <div className={`flex gap-3 ${isPatient ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isPatient
            ? 'bg-gray-700 dark:bg-gray-600'
            : 'bg-gradient-to-br from-primary-500 to-primary-600'
        }`}
      >
        {isPatient ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Heart className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'} flex-1`}>
        {/* Sender name - only show "Medical Staff" for non-patient messages */}
        {!isPatient && (
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 px-1">
            Medical Staff
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-xl px-4 py-2.5 shadow-sm max-w-[85%] ${
            isPatient
              ? 'bg-blue-600 text-white rounded-tr-md shadow-md'
              : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-tl-md'
          }`}
        >
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${
              isPatient ? 'text-white' : 'text-neutral-800 dark:text-neutral-100'
            }`}
          >
            {message.text}
          </p>
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
          {formatTime(message.stamp)}
        </span>
      </div>
    </div>
  );
};

/**
 * File message component
 */
const FileMessage = ({ fileId, isPatient, timestamp, formatTime }) => {
  const fileUrl = getFileUrl(fileId);

  // Determine file type from UUID extension
  const extension = fileId?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(extension);
  const isPdf = extension === 'pdf';
  const isVideo = ['mp4', 'mov'].includes(extension);

  const getFileTypeIcon = () => {
    if (isImage) return <Image className="w-5 h-5" />;
    if (isVideo) return <Film className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className={`flex gap-3 ${isPatient ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isPatient
            ? 'bg-gray-700 dark:bg-gray-600'
            : 'bg-gradient-to-br from-primary-500 to-primary-600'
        }`}
      >
        {isPatient ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Heart className="w-4 h-4 text-white" />
        )}
      </div>

      {/* File content */}
      <div className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'} flex-1`}>
        {/* Sender name */}
        {!isPatient && (
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 px-1">
            Medical Staff
          </span>
        )}

        {/* File display */}
        <div
          className={`rounded-xl overflow-hidden shadow-sm max-w-[85%] ${
            isPatient
              ? 'bg-blue-600'
              : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
          }`}
        >
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
              className={`flex items-center gap-2 p-3 hover:opacity-80 ${
                isPatient
                  ? 'text-white'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {getFileTypeIcon()}
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
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 p-3 hover:opacity-80 ${
                isPatient
                  ? 'text-white'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {getFileTypeIcon()}
              <span className="text-sm">Download Attachment</span>
            </a>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
