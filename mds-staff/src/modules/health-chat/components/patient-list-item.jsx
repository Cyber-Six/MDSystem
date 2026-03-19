import React from 'react';
import TicketStatusBadge from './ticket-status-badge';
import { formatPatientName, getPatientInitials, formatRelativeTime } from '../health-chat-service';

const PatientListItem = ({ ticket, isSelected, isTyping, onClick }) => {
  const patient = ticket.patient;

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b border-neutral-100 dark:border-neutral-800 cursor-pointer
                transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50
                ${isSelected
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500'
                  : ''
                }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
          {getPatientInitials(patient)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name and Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-neutral-900 dark:text-white truncate text-sm">
              {formatPatientName(patient)}
            </span>
            <TicketStatusBadge status={ticket.status} />
          </div>

          {/* Purpose or Typing Indicator */}
          <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {isTyping ? (
              <span className="text-primary-500 dark:text-primary-400 flex items-center gap-1">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                typing...
              </span>
            ) : (
              ticket.purpose || 'No purpose specified'
            )}
          </div>

          {/* Timestamp */}
          <div className="text-[10px] text-neutral-400 mt-1">
            {formatRelativeTime(ticket.session_start || ticket.archived_at)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientListItem;
