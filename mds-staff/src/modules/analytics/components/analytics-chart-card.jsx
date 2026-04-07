import React, { memo, useState, useCallback } from 'react';
import { AnalyticsBarChart, AnalyticsLineChart, AnalyticsPieChart } from './analytics-charts';
import { CHART_TYPE_MAP, exportSingleMetric } from '../analytics-service';

/**
 * Analytics Chart Card
 * Consistent card wrapper for each analytics chart with title, total, and loading states.
 */
const AnalyticsChartCard = memo(({ dataType, title, data, loading, error, dark, branch, startDate, endDate, groupBy }) => {
  const chartType = CHART_TYPE_MAP[dataType] || 'bar';
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!branch || !startDate || !endDate) return;
    setExporting(true);
    try {
      await exportSingleMetric(dataType, { branch, startDate, endDate, groupBy });
    } catch {
      // silent — user will see no file downloaded
    } finally {
      setExporting(false);
    }
  }, [dataType, branch, startDate, endDate, groupBy]);

  // Transform {labels, values} -> [{name, value}]
  const chartData = data?.data
    ? data.data.labels.map((label, i) => ({
        name: label,
        value: data.data.values[i] || 0,
      }))
    : [];

  const total = data?.data?.total ?? 0;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Card Header */}
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs font-semibold text-secondary-800 dark:text-white leading-none truncate">{title}</h3>
            {!loading && !error && (
              <span className="text-[10px] text-secondary-400 dark:text-neutral-500 flex-shrink-0">
                {total.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {/* Per-card export (single metric PDF) */}
        {!loading && !error && data?.data && (
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Export as PDF"
            className="ml-2 p-0.5 text-secondary-400 hover:text-primary-500 dark:text-neutral-500 dark:hover:text-primary-400 rounded transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {exporting ? (
              <span className="animate-spin block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-error-500 dark:text-error-400">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs">Failed to load data</p>
          </div>
        ) : chartType === 'bar' ? (
          <AnalyticsBarChart data={chartData} dark={dark} />
        ) : chartType === 'line' ? (
          <AnalyticsLineChart data={chartData} dark={dark} />
        ) : (
          <AnalyticsPieChart data={chartData} isDoughnut={chartType === 'doughnut'} dark={dark} />
        )}
      </div>
    </div>
  );
});

AnalyticsChartCard.displayName = 'AnalyticsChartCard';

export default AnalyticsChartCard;
