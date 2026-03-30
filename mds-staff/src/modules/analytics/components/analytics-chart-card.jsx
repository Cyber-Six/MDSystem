import React, { memo } from 'react';
import { AnalyticsBarChart, AnalyticsLineChart, AnalyticsPieChart } from './analytics-charts';
import { CHART_TYPE_MAP } from '../analytics-service';

/**
 * Analytics Chart Card
 * Consistent card wrapper for each analytics chart with title, total, and loading states.
 */
const AnalyticsChartCard = memo(({ dataType, title, data, loading, error, dark }) => {
  const chartType = CHART_TYPE_MAP[dataType] || 'bar';

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
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white leading-tight">{title}</h3>
          {!loading && !error && (
            <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">
              Total: {total.toLocaleString()}
            </p>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wide ${
          chartType === 'bar' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
          chartType === 'line' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
          'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
        }`}>
          {chartType === 'doughnut' ? 'pie' : chartType}
        </span>
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
