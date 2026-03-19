import React from 'react';
import { User, Heart, Info, File, Image, Film } from 'lucide-react';
import { getFileUrl } from '../health-chat-service';

/**
 * Message bubble for staff side
 * Shows actual staff names for Medical messages
 */
const MessageBubble = ({ message, formatTime }) => {
  const isPatient = message.userType === 'Patient';
  const isSystem = message.promptType === 'system';
  const isFile = message.promptType === 'file';

  // System messages
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

  // Get sender name for staff messages
  const getSenderName = () => {
    if (isPatient) return null; // No name shown for patient
    // Show actual staff name
    if (message.sender) {
      return `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 'Staff';
    }
    return 'Staff';
  };

  // File messages
  if (isFile && message.filename) {
    const fileUrl = getFileUrl(message.filename);
    const extension = message.filename?.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png'].includes(extension);
    const isPdf = extension === 'pdf';
    const isVideo = ['mp4', 'mov'].includes(extension);

    return (
      <div className={`flex gap-3 ${isPatient ? '' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isPatient
              ? 'bg-gradient-to-br from-primary-400 to-primary-600'
              : 'bg-gray-700 dark:bg-gray-600'
          }`}
        >
          {isPatient ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Heart className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Content */}
        <div className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'} flex-1`}>
          {/* Sender name for staff */}
          {!isPatient && (
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 px-1">
              {getSenderName()}
            </span>
          )}

          {/* File display */}
          <div
            className={`rounded-xl overflow-hidden shadow-sm max-w-[85%] ${
              isPatient
                ? 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                : 'bg-blue-600'
            }`}
          >
            {isImage && (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <img src={fileUrl} alt="Attachment" className="max-w-full max-h-64 object-contain" loading="lazy" />
              </a>
            )}
            {isPdf && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-3 hover:opacity-80 ${isPatient ? 'text-neutral-700 dark:text-neutral-300' : 'text-white'}`}
              >
                <File className="w-5 h-5" />
                <span className="text-sm font-medium">View PDF Document</span>
              </a>
            )}
            {isVideo && <video src={fileUrl} controls className="max-w-full max-h-64" preload="metadata" />}
            {!isImage && !isPdf && !isVideo && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-3 hover:opacity-80 ${isPatient ? 'text-neutral-700 dark:text-neutral-300' : 'text-white'}`}
              >
                <File className="w-5 h-5" />
                <span className="text-sm">Download Attachment</span>
              </a>
            )}
          </div>

          {/* Timestamp */}
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
            {formatTime(message.stamp)}
          </span>
        </div>
      </div>
    );
  }

  // Regular text messages
  return (
    <div className={`flex gap-3 ${isPatient ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isPatient
            ? 'bg-gradient-to-br from-primary-400 to-primary-600'
            : 'bg-gray-700 dark:bg-gray-600'
        }`}
      >
        {isPatient ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Heart className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'} flex-1`}>
        {/* Sender name for staff */}
        {!isPatient && (
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 px-1">
            {getSenderName()}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-xl px-4 py-2.5 shadow-sm max-w-[85%] ${
            isPatient
              ? 'bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-tl-md'
              : 'bg-blue-600 text-white rounded-tr-md shadow-md'
          }`}
        >
          <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${isPatient ? 'text-neutral-800 dark:text-neutral-100' : 'text-white'}`}>
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

export default MessageBubble;
