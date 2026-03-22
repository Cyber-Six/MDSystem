import React, { useState } from 'react';
import PatientSectionCard from './section-card';

const REQ_STATUS_STYLES = {
  Dispensed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Pending:   'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-600',
  Cancelled: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  Rejected:  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
};

const REQ_STATUS_DOT = {
  Dispensed: 'bg-success-500',
  Pending:   'bg-primary-500',
  Cancelled: 'bg-neutral-400',
  Rejected:  'bg-error-500',
};

function StatusBadge({ status }) {
  const style = REQ_STATUS_STYLES[status] || REQ_STATUS_STYLES.Pending;
  const dot   = REQ_STATUS_DOT[status]   || REQ_STATUS_DOT.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium leading-none ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

export default function PatientMedicineRequestsTab({ patient }) {
  const requests = patient.history.medicineRequests || [];
  const [filter, setFilter] = useState('All');

  const statuses = ['All', 'Pending', 'Dispensed', 'Cancelled', 'Rejected'];
  const filtered = filter === 'All' ? requests : requests.filter(r => r.status === filter);

  return (
    <PatientSectionCard
      title="Medicine Requests"
      right={
        <div className="flex items-center gap-1">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary-500 dark:bg-primary-600 text-secondary-900 dark:text-secondary-900 font-semibold'
                  : 'text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-1 text-xs text-secondary-400 dark:text-neutral-500">{filtered.length} requests</span>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="text-xs text-secondary-300 dark:text-neutral-600">No medicine requests yet.</p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
          {filtered.map((req, idx) => (
            <div key={idx} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">

              {/* Row 1: medicine name + status */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-secondary-800 dark:text-white leading-snug">{req.medicine}</p>
                <StatusBadge status={req.status} />
              </div>

              {/* Row 2: qty + id + date */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-secondary-500 dark:text-neutral-400">
                  Qty: <span className="font-medium text-secondary-700 dark:text-neutral-200">{req.quantity}</span>
                </span>
                {req.id && <span className="text-[11px] font-mono text-secondary-400 dark:text-neutral-500">{req.id}</span>}
                {req.date && <span className="text-xs text-secondary-400 dark:text-neutral-500 ml-auto">{req.date}</span>}
              </div>

              {/* Row 3: meta details */}
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                {req.reason && (
                  <p className="text-xs text-secondary-600 dark:text-neutral-300">
                    <span className="text-secondary-400 dark:text-neutral-500">Reason: </span>{req.reason}
                  </p>
                )}
                {req.prescribedBy && (
                  <p className="text-xs text-secondary-400 dark:text-neutral-500">
                    Prescribed by <span className="text-secondary-600 dark:text-neutral-300 font-medium">{req.prescribedBy}</span>
                  </p>
                )}
                {req.dispensedDate && (
                  <p className="text-xs text-success-600 dark:text-success-400 mt-0.5">
                    Dispensed {req.dispensedDate}
                  </p>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </PatientSectionCard>
  );
}