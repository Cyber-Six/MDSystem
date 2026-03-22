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
      ? 'Ticket Closed by: Patient'
      : closedBy === 'System'
      ? 'Ticket Closed by: System'
      : closedBy === 'Staff'
      ? 'Ticket Closed by: Staff'
      : 'Ticket Closed';

  return (
    <div className="flex items-center gap-3 py-3 my-3">
      <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-neutral-300 dark:bg-neutral-600" />
        {closedByText} · {formatDate(closedAt)}
      </div>
      <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
};

export default TicketDivider;
