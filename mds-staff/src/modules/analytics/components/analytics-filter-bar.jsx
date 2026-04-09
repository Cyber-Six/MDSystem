import React, { memo } from 'react';
import { BRANCHES, PERIOD_PRESETS } from '../analytics-service';

/**
 * Analytics Filter Bar
 * Controls for branch, period, and date range filters.
 */
const AnalyticsFilterBar = memo(({
  branch,
  startDate,
  endDate,
  groupBy,
  allowedBranches,
  onBranchChange,
  onStartDateChange,
  onEndDateChange,
  onGroupByChange,
  onRefresh,
  loading,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
        {/* Branch Selector */}
        {(() => {
          const branchOptions = allowedBranches && allowedBranches.length > 0
            ? BRANCHES.filter((b) => allowedBranches.includes(b.value))
            : BRANCHES;
          const isRestricted = branchOptions.length === 1;
          return (
            <select
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
              disabled={isRestricted}
              className="px-2 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {branchOptions.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          );
        })()}

        {/* Period Selector */}
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {PERIOD_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Date Range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <span className="text-[10px] text-secondary-400 dark:text-neutral-500">–</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
        >
          {loading ? (
            <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>
  );
});

AnalyticsFilterBar.displayName = 'AnalyticsFilterBar';

export default AnalyticsFilterBar;
