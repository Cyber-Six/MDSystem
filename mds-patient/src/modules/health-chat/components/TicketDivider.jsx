import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * Visual divider shown between ticket conversations
 * Displays when a previous conversation was closed and a new one started
 */
const TicketDivider = ({ closedAt, closedBy }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const closedByText = closedBy === 'Patient'
    ? 'You closed this conversation'
    : 'Medical Staff closed this conversation';

  return (
    <div className="flex items-center gap-3 py-4 my-4">
      <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600" />
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full">
        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          {closedByText} on {formatDate(closedAt)}
        </span>
      </div>
      <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600" />
    </div>
  );
};

export default TicketDivider;
