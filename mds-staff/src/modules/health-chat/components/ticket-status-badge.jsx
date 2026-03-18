import React from 'react';

const TicketStatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Open':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'Ongoing':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'Closed':
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400';
      case 'Expired':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'Open':
        return 'Pending';
      case 'Ongoing':
        return 'Active';
      case 'Closed':
        return 'Closed';
      case 'Expired':
        return 'Expired';
      default:
        return status;
    }
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyles()}`}>
      {getStatusLabel()}
    </span>
  );
};

export default TicketStatusBadge;
