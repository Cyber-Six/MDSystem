import React from 'react';
import TicketStatusBadge from './ticket-status-badge';
import { formatPatientName, getPatientInitials, formatRelativeTime } from '../health-chat-service';

const PatientListItem = ({ ticket, isSelected, isTyping, onClick }) => {
  const patient = ticket.patient;
  const initials = getPatientInitials(patient);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-colors duration-100"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 12px',
        background: isSelected ? '#FFFBEB' : 'transparent',
        borderLeft: isSelected ? '3px solid #f4c430' : '3px solid transparent',
        borderBottom: '1px solid #f4f2ef',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#faf9f7'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div
        style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          alignSelf: 'center',
          background: isSelected ? '#f4c430' : '#e8e5e0',
          color: isSelected ? '#1c1a17' : '#57534e',
        }}
      >
        {initials}
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
        {/* Name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1c1a17', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatPatientName(patient)}
          </span>
          <TicketStatusBadge status={ticket.status} />
        </div>

        {/* Purpose */}
        <p style={{ fontSize: '10px', color: isTyping ? '#C9A01E' : '#a19b93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {isTyping ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'flex', gap: '2px' }}>
                {[0, 150, 300].map((d, i) => (
                  <span
                    key={i}
                    className="animate-bounce"
                    style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f4c430', animationDelay: `${d}ms`, animationDuration: '700ms', display: 'inline-block' }}
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
        <p style={{ fontSize: '9px', color: '#d5d1cb', margin: 0 }}>
          {formatRelativeTime(ticket.session_start || ticket.archived_at)}
        </p>
      </div>
    </div>
  );
};

export default PatientListItem;