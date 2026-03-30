import React, { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';

// ── Theme Colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#F1C526', '#2563eb', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6',
];

const DARK_GRID = '#404040';
const LIGHT_GRID = '#e5e7eb';

// ── Shared tooltip style ─────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: 'var(--tooltip-bg, #fff)',
  border: '1px solid var(--tooltip-border, #e5e7eb)',
  borderRadius: '8px',
  fontSize: '12px',
  padding: '8px 12px',
};

// ── Bar Chart ────────────────────────────────────────────────────────────────

const AnalyticsBarChart = memo(({ data, dark = false }) => {
  if (!data?.length) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_GRID : LIGHT_GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={data.length > 6 ? -35 : 0}
          textAnchor={data.length > 6 ? 'end' : 'middle'}
          height={data.length > 6 ? 60 : 30}
        />
        <YAxis
          tick={{ fontSize: 11, fill: dark ? '#a3a3a3' : '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
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
AnalyticsPieChart.displayName = 'AnalyticsPieChart';

export { AnalyticsBarChart, AnalyticsLineChart, AnalyticsPieChart, CHART_COLORS };
