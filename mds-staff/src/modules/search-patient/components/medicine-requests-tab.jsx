import React, { useMemo, useState } from 'react';
import PatientSectionCard from './section-card';

const REQ_STATUS_STYLES = {
  Dispensed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Pending:   'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Cancelled: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  Rejected:  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
};

const REQ_STATUS_DOT = {
  Dispensed: 'bg-success-500',
  Pending:   'bg-warning-500',
  Cancelled: 'bg-neutral-400',
  Rejected:  'bg-error-500',
};

const normalizeRequestStatus = (status) => {
  if (status === 'Completed' || status === 'Dispensed') return 'Dispensed';
  if (status === 'Rejected') return 'Rejected';
  if (status === 'Cancelled' || status === 'Expired') return 'Cancelled';
  return 'Pending';
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

export default function PatientMedicineRequestsTab({ patient, requests = [], isLoading = false, error = '', onRefresh }) {
  const fallbackRequests = patient?.history?.medicineRequests || [];
  const sourceRequests = requests.length > 0 ? requests : fallbackRequests;
  const [filter, setFilter] = useState('All');

  const statuses = ['All', 'Pending', 'Dispensed', 'Cancelled', 'Rejected'];
  const normalizedRequests = useMemo(() => {
    return sourceRequests.map((request) => {
      const normalizedStatus = normalizeRequestStatus(request?.status || request?.backendStatus);
      return {
        ...request,
        normalizedStatus,
      };
    });
  }, [sourceRequests]);

  const filtered = useMemo(() => {
    if (filter === 'All') return normalizedRequests;
    return normalizedRequests.filter((request) => request.normalizedStatus === filter);
  }, [filter, normalizedRequests]);

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
                  ? 'bg-primary-500 dark:bg-primary-600 text-white dark:text-white font-semibold'
                  : 'text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-1 text-xs text-secondary-400 dark:text-neutral-500">{filtered.length} requests</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="ml-1 px-2 py-1 rounded text-xs font-medium text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
              title="Refresh medicine requests"
            >
              Refresh
            </button>
          )}
        </div>
      }
    >
      {isLoading && (
        <div className="py-3 flex items-center gap-2 text-xs text-secondary-500 dark:text-neutral-400">
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading medicine requests...
        </div>
      )}

      {!isLoading && error && (
        <div className="py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-error-600 dark:text-error-400">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2.5 py-1 rounded text-xs font-medium bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 hover:bg-error-200 dark:hover:bg-error-900/50"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 ? (
        <p className="text-xs text-secondary-300 dark:text-neutral-600">No medicine requests yet.</p>
      ) : !isLoading && !error ? (
        <div className="space-y-2">
          {filtered.map((req, idx) => {
            const shownStatus = req.normalizedStatus || normalizeRequestStatus(req.status || req.backendStatus);
            return (
              <div
                key={req.requestId || req.id || idx}
                className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 overflow-hidden hover:shadow-sm dark:hover:shadow-2xl/10 transition-shadow"
              >
                {/* Header: Medicine name + Status + Date */}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-700/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-secondary-800 dark:text-white truncate" style={{ margin: 0, lineHeight: 1.2 }}>
                      {req.medicine}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.date && <span className="text-xs text-secondary-400 dark:text-neutral-500 whitespace-nowrap">{req.date}</span>}
                    <StatusBadge status={shownStatus} />
                  </div>
                </div>

                {/* Content: Qty, Code, and metadata grid */}
                <div className="px-3.5 py-2.5 space-y-2">
                  {/* Qty & Code inline */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-start">
                      <span className="text-xs uppercase tracking-wider text-secondary-400 dark:text-neutral-500">Qty</span>
                      <p className="text-2xl font-bold text-secondary-800 dark:text-white" style={{ margin: 0, lineHeight: 1 }}>
                        {req.quantity ?? 0}
                      </p>
                    </div>
                    {req.id && (
                      <p className="text-sm font-mono font-semibold text-secondary-700 dark:text-neutral-200 tracking-wider -mt-5" style={{ margin: 0, lineHeight: 1 }}>
                        {req.id}
                      </p>
                    )}
                  </div>

                  {/* Metadata in compact rows */}
                  <div className="space-y-1">
                    {req.reason && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-secondary-400 dark:text-neutral-500 whitespace-nowrap">Reason:</span>
                        <span className="text-sm text-secondary-700 dark:text-neutral-300 truncate">{req.reason}</span>
                      </div>
                    )}
                    {req.notes && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-secondary-400 dark:text-neutral-500 whitespace-nowrap">Notes:</span>
                        <span className="text-sm text-secondary-700 dark:text-neutral-300 truncate">{req.notes}</span>
                      </div>
                    )}
                    {req.location && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-secondary-400 dark:text-neutral-500 whitespace-nowrap">Location:</span>
                        <span className="text-sm font-medium text-secondary-700 dark:text-neutral-200">
                          {req.location === 'QuezonCity' ? 'Quezon City' : req.location}
                        </span>
                      </div>
                    )}
                    {req.prescribedBy && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-secondary-400 dark:text-neutral-500 whitespace-nowrap">By:</span>
                        <span className="text-sm font-medium text-secondary-700 dark:text-neutral-200">{req.prescribedBy}</span>
                      </div>
                    )}
                    {req.dispensedDate && (
                      <div className="pt-1 border-t border-neutral-100 dark:border-neutral-700/60">
                        <p className="text-xs text-success-600 dark:text-success-400 font-medium" style={{ margin: 0 }}>
                          ✓ Dispensed {req.dispensedDate}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </PatientSectionCard>
  );
}
