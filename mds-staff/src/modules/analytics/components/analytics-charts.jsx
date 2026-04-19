import React, { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area,
} from 'recharts';

// ── Theme Colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#F1C526', '#2563eb', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6',
];

const DARK_GRID = '#404040';
const LIGHT_GRID = '#e5e7eb';

// ── Truncate text to max words with ellipsis ─────────────────────────────────

const truncateText = (text, maxWords = 2, maxChars = 20) => {
  const str = String(text);
  const words = str.split(' ');
  let result = words.length > maxWords ? words.slice(0, maxWords).join(' ') : str;
  if (result.length > maxChars) {
    result = result.substring(0, maxChars);
  }
  return result.length < str.length ? result.trim() + '...' : result;
};

// ── Shared tooltip style ─────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: 'var(--tooltip-bg, #fff)',
  border: '1px solid var(--tooltip-border, #e5e7eb)',
  borderRadius: '8px',
  fontSize: '12px',
  padding: '8px 12px',
};

// ── Bar Chart ────────────────────────────────────────────────────────────────

const AnalyticsBarChart = memo(({
  data,
  dark = false,
  tooltipFormatter,
  tooltipLabelFormatter,
  allowDecimals = false,
  isPercentage = false,
}) => {
  if (!data?.length) return <EmptyState />;

  const defaultTooltipFormatter = (value, seriesName) => {
    if (!isPercentage) return [value, seriesName];
    const numericValue = Number(value);
    const percentage = Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00';
    return [`${percentage}%`, seriesName || 'Percentage'];
  };

  const percentageTickFormatter = (value) => {
    if (!isPercentage) return value;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0%';
    return `${numericValue}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_GRID : LIGHT_GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          tickFormatter={(value) => truncateText(value, 2, 18)}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={64}
        />
        <YAxis
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={allowDecimals}
          tickFormatter={percentageTickFormatter}
          domain={isPercentage ? [0, 100] : undefined}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
          formatter={tooltipFormatter || defaultTooltipFormatter}
          labelFormatter={tooltipLabelFormatter}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// ── Line Chart ───────────────────────────────────────────────────────────────

const AnalyticsLineChart = memo(({ data, dark = false }) => {
  if (!data?.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_GRID : LIGHT_GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#F1C526"
          strokeWidth={2}
          dot={{ fill: '#F1C526', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

// ── Stacked Area Chart ──────────────────────────────────────────────────────

const AnalyticsStackedAreaChart = memo(({ data, series = [], dark = false }) => {
  if (!data?.length || !series?.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_GRID : LIGHT_GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {series.map((entry, index) => (
          <Area
            key={entry.name}
            type="monotone"
            dataKey={entry.name}
            stackId="stack"
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            fillOpacity={0.35}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
});

// ── Box Plot (custom renderer) ──────────────────────────────────────────────

const AnalyticsBoxPlotChart = memo(({ data }) => {
  if (!data?.length) return <EmptyState />;

  const allMins = data.map((item) => Number(item.min)).filter(Number.isFinite);
  const allMaxs = data.map((item) => Number(item.max)).filter(Number.isFinite);

  if (allMins.length === 0 || allMaxs.length === 0) return <EmptyState />;

  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const range = globalMax - globalMin || 1;

  const toPercent = (value) => ((Number(value) - globalMin) / range) * 100;
  const formatValue = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="h-[280px] overflow-y-auto pr-1">
      <div className="flex justify-between text-[10px] text-secondary-400 dark:text-neutral-500 mb-2">
        <span>{formatValue(globalMin)}</span>
        <span>{formatValue(globalMax)}</span>
      </div>

      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-secondary-500 dark:text-neutral-400">
              <span className="font-medium truncate pr-2">{item.name}</span>
              <span className="text-[10px]">n={item.count || 0}</span>
            </div>

            <div className="relative h-8">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-neutral-200 dark:bg-neutral-700" />

              {/* whisker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-px bg-neutral-500 dark:bg-neutral-300"
                style={{
                  left: `${toPercent(item.min)}%`,
                  width: `${Math.max(toPercent(item.max) - toPercent(item.min), 0.8)}%`,
                }}
              />

              {/* box (Q1-Q3) */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm border border-primary-600/70 bg-primary-500/25"
                style={{
                  left: `${toPercent(item.q1)}%`,
                  width: `${Math.max(toPercent(item.q3) - toPercent(item.q1), 1)}%`,
                }}
              />

              {/* median */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-px h-6 bg-primary-700 dark:bg-primary-300"
                style={{ left: `${toPercent(item.median)}%` }}
              />

              {/* min/max dots */}
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-neutral-500 dark:bg-neutral-300"
                style={{ left: `${toPercent(item.min)}%` }}
              />
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-neutral-500 dark:bg-neutral-300"
                style={{ left: `${toPercent(item.max)}%` }}
              />
            </div>

            <div className="grid grid-cols-5 gap-1 text-[10px] text-secondary-400 dark:text-neutral-500">
              <span>Min {formatValue(item.min)}</span>
              <span>Q1 {formatValue(item.q1)}</span>
              <span>Med {formatValue(item.median)}</span>
              <span>Q3 {formatValue(item.q3)}</span>
              <span>Max {formatValue(item.max)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Pie / Doughnut Chart ─────────────────────────────────────────────────────

const AnalyticsPieChart = memo(({ data, isDoughnut = false, dark = false }) => {
  if (!data?.length) return <EmptyState />;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={isDoughnut ? 55 : 0}
          outerRadius={95}
          paddingAngle={isDoughnut ? 3 : 1}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={{ strokeWidth: 1 }}
          style={{ fontSize: 11 }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`, 'Count']}
        />
        <Legend
          iconSize={10}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[280px] text-secondary-400 dark:text-neutral-500">
      <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-xs">No data available for this period</p>
    </div>
  );
}

// ── Exports ──────────────────────────────────────────────────────────────────

AnalyticsBarChart.displayName = 'AnalyticsBarChart';
AnalyticsLineChart.displayName = 'AnalyticsLineChart';
AnalyticsStackedAreaChart.displayName = 'AnalyticsStackedAreaChart';
AnalyticsBoxPlotChart.displayName = 'AnalyticsBoxPlotChart';
AnalyticsPieChart.displayName = 'AnalyticsPieChart';

export {
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsStackedAreaChart,
  AnalyticsBoxPlotChart,
  AnalyticsPieChart,
  CHART_COLORS,
};
