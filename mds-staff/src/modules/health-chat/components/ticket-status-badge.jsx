import React from 'react';

const STATUS_MAP = {
  Open:    { label: 'Pending',  bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  Ongoing: { label: 'Active',   bg: 'bg-emerald-100 dark:bg-emerald-900/30', color: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  Closed:  { label: 'Closed',   bg: 'bg-neutral-100 dark:bg-neutral-800', color: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' },
  Expired: { label: 'Expired',  bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

const TicketStatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.Closed;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${s.bg} ${s.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
};

export default TicketStatusBadge;
