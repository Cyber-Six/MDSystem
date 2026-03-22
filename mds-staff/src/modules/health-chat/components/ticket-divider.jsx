import React from 'react';

/**
 * Ticket Divider Component
 * Displays a divider between tickets in the chat history
 * Shows: "Ticket closed by [Staff/Patient] - [Date]" and optionally the new ticket subject
 */
const TicketDivider = ({ closedBy, closedAt, newTicketPurpose }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getClosedByText = () => {
    switch (closedBy) {
      case 'Staff':
        return 'Closed by Staff';
      case 'Patient':
        return 'Closed by Patient';
      case 'System':
        return 'Expired (auto-closed)';
      default:
        return 'Ticket Closed';
    }
  };

  return (
    <div className="flex flex-col items-center py-4 my-2">
      {/* Divider line with text */}
      <div className="flex items-center w-full max-w-md">
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        <div className="px-3 py-1.5 mx-2 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {getClosedByText()}
          </span>
        </div>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
      </div>

      {/* Date */}
      {closedAt && (
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
          {formatDate(closedAt)}
        </span>
      )}

      {/* New ticket subject */}
      {newTicketPurpose && (
        <div className="mt-3 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 max-w-sm">
          <span className="text-[10px] font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide block mb-0.5">
            New Consultation
          </span>
          <p className="text-xs text-secondary-700 dark:text-neutral-300 m-0">
            {newTicketPurpose}
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketDivider;
