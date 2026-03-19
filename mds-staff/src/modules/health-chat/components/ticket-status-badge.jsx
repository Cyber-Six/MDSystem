import React from 'react';

const STATUS_MAP = {
  Open:    { label: 'Pending',  bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  Ongoing: { label: 'Active',   bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  Closed:  { label: 'Closed',   bg: '#F4F2EF', color: '#57534E', dot: '#A19B93' },
  Expired: { label: 'Expired',  bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
};

const TicketStatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.Closed;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="w-1 h-1 rounded-full flex-shrink-0"
        style={{ background: s.dot }}
      />
      {s.label}
    </span>
  );
};

export default TicketStatusBadge;