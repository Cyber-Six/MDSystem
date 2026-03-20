import React from 'react';
import TicketStatusBadge from './ticket-status-badge';
import { formatPatientName, getPatientInitials, formatRelativeTime } from '../health-chat-service';

const PatientListItem = ({ ticket, isSelected, isTyping, onClick }) => {
  const patient = ticket.patient;
  const initials = getPatientInitials(patient);

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-3 py-[7px] cursor-pointer transition-colors duration-100
        border-l-[3px] border-b
        ${isSelected
          ? 'bg-amber-50 dark:bg-amber-900/20 border-l-primary-500 border-b-neutral-100 dark:border-b-neutral-800'
          : 'bg-transparent border-l-transparent border-b-neutral-100 dark:border-b-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
        }
      `}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
          text-[10px] font-bold self-center
          ${isSelected
            ? 'bg-primary-500 text-secondary-900'
            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
          }
        `}
      >
        {initials}
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Name + badge */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold text-secondary-900 dark:text-white overflow-hidden text-ellipsis whitespace-nowrap">
            {formatPatientName(patient)}
          </span>
          <TicketStatusBadge status={ticket.status} />
        </div>

        {/* Purpose */}
        <p className={`text-[10px] overflow-hidden text-ellipsis whitespace-nowrap m-0 ${isTyping ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
          {isTyping ? (
            <span className="flex items-center gap-1">
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
          ) : (
            ticket.purpose || 'No purpose specified'
          )}
        </p>

        {/* Timestamp */}
        <p className="text-[9px] text-neutral-300 dark:text-neutral-600 m-0">
          {formatRelativeTime(ticket.session_start || ticket.archived_at)}
        </p>
      </div>
    </div>
  );
};

export default PatientListItem;
