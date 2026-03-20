import React from 'react';

/**
 * TicketDivider — patient side
 * A soft, warm visual break between closed and new conversations
 */
const TicketDivider = ({ closedAt, closedBy }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const closedByText =
    closedBy === 'Patient'
      ? 'You closed this'
      : closedBy === 'System'
      ? 'Session expired'
      : 'Staff closed this';

  return (
    <div className="flex items-center gap-3 py-2 my-2">
      <div className="flex-1 h-px" style={{ background: '#e8e5e0' }} />
      <div
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
        style={{
          background: '#f4f2ef',
          border: '1px solid #e8e5e0',
          color: '#a19b93'
        }}
      >
        <span
          className="w-1 h-1 rounded-full flex-shrink-0"
          style={{ background: '#d5d1cb' }}
        />
        {closedByText} · {formatDate(closedAt)}
      </div>
      <div className="flex-1 h-px" style={{ background: '#e8e5e0' }} />
    </div>
  );
};

export default TicketDivider;