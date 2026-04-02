import React, { useState, useCallback, memo } from 'react';
import { exportAnalytics, EXPORT_PRESETS, QUERY_CATEGORIES } from '../analytics-service';

const FORMAT_OPTIONS = [
  {
    value: 'pdf',
    label: 'PDF Report',
    description: 'Tables, charts, and summary — presentation-ready',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'excel',
    label: 'Excel (.xlsx)',
    description: 'Formatted tables with summary sheet',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'csv',
    label: 'CSV',
    description: 'Plain data — import anywhere',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const SCOPE_OPTIONS = [
  { value: 'full-report', label: 'Full Report', description: 'All 15 metrics' },
  ...Object.entries(QUERY_CATEGORIES).map(([key, cat]) => ({
    value: key,
    label: cat.label,
    description: `${cat.queries.length} metrics`,
  })),
];

/**
 * Analytics Export Modal
 * Allows the user to pick format, scope (preset), and trigger download.
 */
const AnalyticsExportModal = memo(({ open, onClose, branch, startDate, endDate }) => {
  const [format, setFormat] = useState('pdf');
  const [scope, setScope] = useState('full-report');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await exportAnalytics(format, {
        branch,
        startDate,
        endDate,
        preset: scope,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [format, scope, branch, startDate, endDate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Export Analytics</h3>
          <button
            onClick={onClose}
            className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-[11px] font-medium text-secondary-500 dark:text-neutral-400 mb-1.5">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const active = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors ${
                      active
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500 text-secondary-600 dark:text-neutral-300'
                    }`}
                  >
                    {opt.icon}
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-tight">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-[11px] font-medium text-secondary-500 dark:text-neutral-400 mb-1.5">Report Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg px-3 py-2.5 text-[11px] text-secondary-500 dark:text-neutral-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Branch</span>
              <span className="font-medium text-secondary-700 dark:text-neutral-200">
                {branch === 'Both' ? 'All Branches' : branch === 'QuezonCity' ? 'Quezon City' : branch}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Period</span>
              <span className="font-medium text-secondary-700 dark:text-neutral-200">{startDate} to {endDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Format</span>
              <span className="font-medium text-secondary-700 dark:text-neutral-200">
                {FORMAT_OPTIONS.find(f => f.value === format)?.label}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
          >
            {loading ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                Exporting…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

AnalyticsExportModal.displayName = 'AnalyticsExportModal';

export default AnalyticsExportModal;
