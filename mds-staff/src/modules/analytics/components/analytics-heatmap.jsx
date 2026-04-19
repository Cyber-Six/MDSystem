/**
 * AnalyticsHeatmap
 *
 * Renders multi-series analytics data (e.g. sex × age group, diagnosis × age group)
 * as a color-intensity heatmap table and supports `grouped-bar` fallback for
 * smaller series counts.
 *
 * Props:
 *   data     – { labels: string[], series: [{name, values}], total }
 *   title    – optional chart title
 *   variant  – 'heatmap' | 'grouped-bar' (default from data.chartVariant)
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Tailwind-safe color palette (green intensity scale)
const HEAT_COLORS = [
  'bg-emerald-50 text-emerald-900',
  'bg-emerald-100 text-emerald-900',
  'bg-emerald-200 text-emerald-900',
  'bg-emerald-300 text-emerald-900',
  'bg-emerald-400 text-white',
  'bg-emerald-500 text-white',
  'bg-emerald-600 text-white',
  'bg-emerald-700 text-white',
  'bg-emerald-800 text-white',
];

// Colour palette for grouped-bar series (one colour per series)
const BAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b',
  '#f43f5e', '#8b5cf6', '#06b6d4',
  '#f97316', '#14b8a6',
];

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// Truncate text to max words with ellipsis
function truncateText(text, maxWords = 2, maxChars = 20) {
  const str = String(text);
  const words = str.split(' ');
  let result = words.length > maxWords ? words.slice(0, maxWords).join(' ') : str;
  if (result.length > maxChars) {
    result = result.substring(0, maxChars);
  }
  return result.length < str.length ? result.trim() + '...' : result;
}

// ──────────────────────────────────────────────────────────────
// Heatmap
// ──────────────────────────────────────────────────────────────
function HeatmapTable({ labels, series }) {
  const allValues = series.flatMap(s => s.values).filter(v => v > 0);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;

  function heatClass(value) {
    if (!value || value === 0) return 'bg-gray-50 text-gray-300';
    const idx = clamp(Math.floor((value / maxVal) * (HEAT_COLORS.length - 1)), 0, HEAT_COLORS.length - 1);
    return HEAT_COLORS[idx];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {/* Empty corner cell */}
            <th className="sticky left-0 bg-white px-2 py-1 text-left text-gray-500 font-medium border border-gray-200 min-w-[110px]">
              Series \ Label
            </th>
            {labels.map((label) => (
              <th
                key={label}
                className="px-2 py-1 text-center text-gray-600 font-medium border border-gray-200 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.name}>
              <td className="sticky left-0 bg-white px-2 py-1 font-medium text-gray-700 border border-gray-200 whitespace-nowrap">
                {s.name}
              </td>
              {s.values.map((val, i) => (
                <td
                  key={i}
                  className={`px-2 py-2 text-center border border-white font-medium transition-colors ${heatClass(val)}`}
                  title={`${s.name} / ${labels[i]}: ${val}`}
                >
                  {val > 0 ? val.toLocaleString() : '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 px-1">
        <span className="text-xs text-gray-400 mr-1">Low</span>
        {HEAT_COLORS.map((cls, i) => (
          <div key={i} className={`w-4 h-3 rounded-sm ${cls.split(' ')[0]}`} />
        ))}
        <span className="text-xs text-gray-400 ml-1">High</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Grouped Bar chart (recharts)
// ──────────────────────────────────────────────────────────────
function GroupedBarChart({ labels, series, dark = false }) {
  const chartData = useMemo(
    () => labels.map((label, index) => {
      const row = { name: label };
      series.forEach((entry) => {
        row[entry.name] = Number(entry.values?.[index] || 0);
      });
      return row;
    }),
    [labels, series]
  );

  const hasDecimals = useMemo(
    () => series.some((entry) => (entry.values || []).some((value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && !Number.isInteger(numericValue);
    })),
    [series]
  );

  const gridColor = dark ? '#404040' : '#e5e7eb';
  const tickColor = dark ? '#a3a3a3' : '#6b7280';
  const tooltipStyle = {
    backgroundColor: dark ? '#171717' : '#ffffff',
    border: `1px solid ${dark ? '#404040' : '#e5e7eb'}`,
    borderRadius: '8px',
    fontSize: '12px',
    padding: '8px 10px',
  };
  const minChartWidth = Math.max(520, labels.length * 95);

  return (
    <div className="overflow-x-auto">
      <div style={{ width: `${minChartWidth}px`, height: '300px' }} className="min-w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, left: -6, bottom: 34 }}
            barGap={4}
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: tickColor }}
              tickFormatter={(value) => truncateText(value, 2, 20)}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={66}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              allowDecimals={hasDecimals}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }),
                name,
              ]}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(value) => <span style={{ color: tickColor }}>{value}</span>}
            />
            {series.map((entry, index) => (
              <Bar
                key={entry.name}
                dataKey={entry.name}
                fill={BAR_COLORS[index % BAR_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────
export default function AnalyticsHeatmap({ data, title, dark = false }) {
  if (!data || !data.labels || !data.series || data.series.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  const variant = data.chartVariant || 'heatmap';

  return (
    <div className="w-full">
      {title && (
        <p className="text-xs font-medium text-gray-500 mb-2">{title}</p>
      )}
      {variant === 'grouped-bar' ? (
        <GroupedBarChart labels={data.labels} series={data.series} dark={dark} />
      ) : (
        <HeatmapTable labels={data.labels} series={data.series} />
      )}
      <p className="text-right text-xs text-gray-400 mt-1">
        Total: {(data.total || 0).toLocaleString()}
      </p>
    </div>
  );
}
