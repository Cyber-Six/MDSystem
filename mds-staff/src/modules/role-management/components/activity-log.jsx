import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSystemAuditLog } from '../staff-service';

/**
 * Activity Log Component
 * Displays SystemAuditLog entries for a selected medical staff account.
 */

function formatAuditTimestamp(value) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionStyle(action) {
  const normalizedAction = String(action || '').toUpperCase();

  if (normalizedAction.includes('DELETE')) {
    return 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400';
  }
  if (normalizedAction.includes('TRANSFER') || normalizedAction.includes('UPDATE')) {
    return 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400';
  }
  if (normalizedAction.includes('CREATE') || normalizedAction.includes('INITIATE')) {
    return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
  }

  return 'bg-neutral-100 dark:bg-neutral-800 text-secondary-600 dark:text-neutral-400';
}

function parsePayload(payload) {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload !== 'string') {
    return payload;
  }

  const normalized = payload.trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
}

function detailsRebuilder(record) {
  const rebuiltPayload = parsePayload(record?.payload);

  return {
    title: `${record?.action || 'UNKNOWN_ACTION'} · ${record?.event_type || 'UNKNOWN_EVENT'}`,
    metadata: [
      { label: 'Timestamp', value: formatAuditTimestamp(record?.timestamp) },
      { label: 'Action', value: record?.action || 'UNKNOWN_ACTION' },
      { label: 'Event Type', value: record?.event_type || 'UNKNOWN_EVENT' },
      { label: 'Target Initials', value: record?.target_initials || '----' },
      { label: 'Target ID', value: record?.target_id || '----' },
      { label: 'Actor ID', value: record?.actorId || '----' },
      { label: 'Changed By', value: record?.changedBy || '----' },
    ],
    payloadText:
      rebuiltPayload === null
        ? 'No payload available.'
        : typeof rebuiltPayload === 'string'
          ? rebuiltPayload
          : JSON.stringify(rebuiltPayload, null, 2),
  };
}

const ActivityLog = ({ staffId }) => {
  const latestRequestRef = useRef(0);

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [actionKeyword, setActionKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState(null);

  const eventTypeOptions = useMemo(() => {
    const values = new Set();
    for (const entry of logs) {
      if (entry?.event_type) {
        values.add(String(entry.event_type));
      }
    }

    if (eventTypeFilter !== 'all') {
      values.add(eventTypeFilter);
    }

    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [logs, eventTypeFilter]);

  const totalPages = useMemo(() => {
    const computed = Math.ceil(totalCount / pageSize);
    return computed > 0 ? computed : 1;
  }, [totalCount, pageSize]);

  const loadLogs = useCallback(async () => {
    if (!staffId) {
      setLogs([]);
      setTotalCount(0);
      return;
    }

    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchSystemAuditLog(staffId, {
        page,
        pageSize,
        sortDirection,
        eventType: eventTypeFilter === 'all' ? null : eventTypeFilter,
        actionKeyword,
        dateFrom,
        dateTo,
      });

      if (requestId !== latestRequestRef.current) {
        return;
      }

      setLogs(Array.isArray(result?.entries) ? result.entries : []);
      setTotalCount(Number(result?.totalCount) || 0);
    } catch (error) {
      if (requestId !== latestRequestRef.current) {
        return;
      }

      setLoadError(error.message || 'Failed to load activity log.');
      setLogs([]);
      setTotalCount(0);
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [staffId, page, pageSize, sortDirection, eventTypeFilter, actionKeyword, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
    setSelectedRecord(null);
  }, [staffId, eventTypeFilter, actionKeyword, dateFrom, dateTo, sortDirection, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedDetails = useMemo(() => {
    if (!selectedRecord) return null;
    return detailsRebuilder(selectedRecord);
  }, [selectedRecord]);

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Action Keyword</label>
          <input
            type="text"
            value={actionKeyword}
            onChange={(event) => setActionKeyword(event.target.value)}
            placeholder="Search action..."
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Event Type</label>
          <select
            value={eventTypeFilter}
            onChange={(event) => setEventTypeFilter(event.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            {eventTypeOptions.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType === 'all' ? 'All Events' : eventType}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Sort</label>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="desc">Timestamp DESC</option>
            <option value="asc">Timestamp ASC</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-secondary-500 dark:text-neutral-400 mb-1">Page Size</label>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value) || 10)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white outline-none"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading activity log...</p>
        </div>
      ) : loadError ? (
        <div className="py-10 text-center">
          <p className="text-xs text-error-600 dark:text-error-400 mb-2">{loadError}</p>
          <button
            type="button"
            onClick={loadLogs}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No activity records match the selected filters</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Try adjusting event type, date range, or keyword filters</p>
        </div>
      ) : (
        <>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                  <th className="w-[32%] text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Timestamp</th>
                  <th className="w-[22%] text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                  <th className="w-[28%] text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Event Type</th>
                  <th className="w-[18%] text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Target Initials</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={`${log.timestamp || 'row'}-${log.action || 'action'}-${idx}`}
                    onClick={() => setSelectedRecord(log)}
                    className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                    title="View log details"
                  >
                    <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400 break-words align-top">
                      {formatAuditTimestamp(log.timestamp)}
                    </td>
                    <td className="py-2 px-3 align-top">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded block w-full max-w-full whitespace-normal leading-tight break-all ${actionStyle(log.action)}`}>
                        {log.action || 'UNKNOWN_ACTION'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-secondary-600 dark:text-neutral-300 whitespace-normal leading-tight break-all align-top">
                      {log.event_type || 'UNKNOWN_EVENT'}
                    </td>
                    <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400 whitespace-normal leading-tight break-all align-top">
                      {log.target_initials || '----'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-secondary-500 dark:text-neutral-400">
              Showing {startRecord}-{endRecord} of {totalCount}
            </p>

            <p className="text-xs text-secondary-500 dark:text-neutral-400">
              Page {page} of {totalPages}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-700 dark:text-neutral-300 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-700 dark:text-neutral-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedDetails && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRecord(null)} />

          <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">{selectedDetails.title}</h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/70 border-b border-neutral-200 dark:border-neutral-700">
                  <p className="text-[10px] uppercase tracking-wider text-secondary-500 dark:text-neutral-400">Metadata</p>
                </div>

                <dl className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {selectedDetails.metadata.map((item) => (
                    <div key={item.label} className="grid grid-cols-[130px_1fr] gap-2 px-3 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-secondary-500 dark:text-neutral-400">{item.label}</dt>
                      <dd className="text-xs text-secondary-800 dark:text-neutral-100 break-words">{item.value || '----'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/70 border-b border-neutral-200 dark:border-neutral-700">
                  <p className="text-[10px] uppercase tracking-wider text-secondary-500 dark:text-neutral-400">Payload</p>
                </div>

                <pre className="text-xs p-3 whitespace-pre-wrap break-words text-secondary-800 dark:text-neutral-100">
                  {selectedDetails.payloadText}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
