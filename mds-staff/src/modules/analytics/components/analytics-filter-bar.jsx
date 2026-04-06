import React, { memo } from 'react';
import { BRANCHES, QUERY_CATEGORIES, PERIOD_PRESETS } from '../analytics-service';

/**
 * Analytics Filter Bar
 * Controls for branch, period, date range, and category filters.
 */
const AnalyticsFilterBar = memo(({
  branch,
  startDate,
  endDate,
  groupBy,
  activeCategory,
  onBranchChange,
  onStartDateChange,
  onEndDateChange,
  onGroupByChange,
  onCategoryChange,
  onRefresh,
  loading,
}) => {
  return (
    <div className="space-y-2">
      {/* Top Row: Branch + Period + Date Range + Refresh */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Branch Selector */}
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-secondary-500 dark:text-neutral-400 mb-1 font-medium">Branch</label>
          <select
            value={branch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        {/* Period Selector */}
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-secondary-500 dark:text-neutral-400 mb-1 font-medium">Period</label>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-secondary-500 dark:text-neutral-400 mb-1 font-medium">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* End Date */}
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-secondary-500 dark:text-neutral-400 mb-1 font-medium">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
        >
          {loading ? (
            <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 flex-wrap bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => onCategoryChange('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeCategory === 'all'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
          }`}
        >
          All
        </button>
        {Object.entries(QUERY_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeCategory === key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
});

AnalyticsFilterBar.displayName = 'AnalyticsFilterBar';

export default AnalyticsFilterBar;
