import React, { useCallback, useEffect, useState } from 'react';
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

const ActivityLog = ({ staffId }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadLogs = useCallback(async () => {
    if (!staffId) {
      setLogs([]);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const entries = await fetchSystemAuditLog(staffId);
      setLogs(Array.isArray(entries) ? entries : []);
    } catch (error) {
      setLoadError(error.message || 'Failed to load activity log.');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading activity log...</p>
      </div>
    );
  }

  if (loadError) {
    return (
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
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400">No activity recorded yet</p>
        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Audit events will appear here when available</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-2">{logs.length} audit entr{logs.length !== 1 ? 'ies' : 'y'}</p>
      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Timestamp</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Actor ID</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Changed By</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr
                key={`${log.timestamp || 'row'}-${log.action || 'action'}-${idx}`}
                className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400 whitespace-nowrap">
                  {formatAuditTimestamp(log.timestamp)}
                </td>
                <td className="py-2 px-3">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${actionStyle(log.action)}`}>
                    {log.action || 'UNKNOWN_ACTION'}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                  {String(log.actorId || '--')}
                </td>
                <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400 whitespace-nowrap">
                  {String(log.changedBy || '--')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLog;
