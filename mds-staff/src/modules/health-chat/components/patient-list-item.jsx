import React from 'react';
import TicketStatusBadge from './ticket-status-badge';
import { formatPatientName, getPatientInitials, formatRelativeTime } from '../health-chat-service';

/**
 * Patient List Item - Messenger Style
 * Shows: Name, Last message preview, Time ago, Status badge
 * Highlights unread conversations
 * Shows subtle "reply" badge when patient sent last message and staff hasn't replied
 */
const PatientListItem = ({ ticket, isSelected, isTyping, needsReply, isExiting, onClick }) => {
  const patient = ticket.patient;
  const initials = getPatientInitials(patient);
  const hasUnread = ticket.unreadCount > 0;

  // Get last message preview text
  const getLastMessagePreview = () => {
    if (isTyping) {
      return (
        <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
          <span className="flex gap-0.5">
            {[0, 150, 300].map((d, i) => (
              <span
                key={i}
                className="inline-block w-1 h-1 rounded-full bg-primary-500 animate-bounce"
                style={{ animationDelay: `${d}ms`, animationDuration: '700ms' }}
              />
            ))}
          </span>
          typing…
        </span>
      );
    }

    if (ticket.lastMessage) {
      const prefix = ticket.lastMessage.userType === 'Medical' ? 'You: ' : '';
      const text = ticket.lastMessage.promptType === 'file'
        ? '📎 Sent a file'
        : ticket.lastMessage.text || '';
      return prefix + text;
    }

    return ticket.purpose || 'No messages yet';
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-3 py-2.5 cursor-pointer
        transition-all duration-300 ease-in-out
        border-l-[3px] border-b
        ${isExiting ? 'animate-[slideOut_400ms_ease-in-out_forwards]' : ''}
        ${isSelected
          ? 'bg-amber-50 dark:bg-amber-900/20 border-l-primary-500 border-b-neutral-100 dark:border-b-neutral-800'
          : hasUnread
            ? 'bg-primary-50/50 dark:bg-primary-900/10 border-l-primary-400 border-b-neutral-100 dark:border-b-neutral-800 hover:bg-primary-50 dark:hover:bg-primary-900/20'
            : 'bg-transparent border-l-transparent border-b-neutral-100 dark:border-b-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
        }
      `}
      style={{
        willChange: 'transform, opacity',
        ...(isExiting ? {
          animation: 'slideOut 400ms ease-in-out forwards',
        } : {})
      }}
    >
      {/* Avatar with unread indicator */}
      <div className="relative flex-shrink-0">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            text-xs font-bold
            ${isSelected
              ? 'bg-primary-500 text-secondary-900'
              : hasUnread
                ? 'bg-primary-400 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
            }
          `}
        >
          {initials}
        </div>
        {/* Unread dot indicator */}
        {hasUnread && !isSelected && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary-500 rounded-full border-2 border-white dark:border-neutral-900" />
        )}
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Name + Time row */}
        <div className="flex items-center justify-between gap-1.5">
          <span className={`text-xs overflow-hidden text-ellipsis whitespace-nowrap ${
            hasUnread
              ? 'font-bold text-secondary-900 dark:text-white'
              : 'font-semibold text-secondary-900 dark:text-white'
          }`}>
            {formatPatientName(patient)}
          </span>
          <span className={`text-[10px] flex-shrink-0 ${
            hasUnread
              ? 'text-primary-600 dark:text-primary-400 font-medium'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}>
            {formatRelativeTime(ticket.lastMessageAt || ticket.session_start || ticket.archived_at)}
          </span>
        </div>

        {/* Last message + Status row */}
        <div className="flex items-center justify-between gap-1.5">
          <p className={`text-xs overflow-hidden text-ellipsis whitespace-nowrap m-0 flex-1 ${
            hasUnread
              ? 'font-medium text-secondary-700 dark:text-neutral-300'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}>
            {getLastMessagePreview()}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasUnread && !isSelected && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary-500 text-secondary-900">
                {ticket.unreadCount > 99 ? '99+' : ticket.unreadCount}
              </span>
            )}
            {needsReply && !hasUnread && !isSelected && (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 italic">
                reply
              </span>
            )}
            <TicketStatusBadge status={ticket.status} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientListItem;
