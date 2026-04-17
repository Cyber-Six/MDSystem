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
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-purple-500', 'bg-cyan-500',
  'bg-orange-500', 'bg-teal-500',
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
// Grouped Bar chart (pure CSS, no recharts)
// ──────────────────────────────────────────────────────────────
function GroupedBarChart({ labels, series }) {
  const maxVal = useMemo(() => {
    const all = series.flatMap(s => s.values);
    return all.length > 0 ? Math.max(...all) : 1;
  }, [series]);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2">
        {series.map((s, i) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${BAR_COLORS[i % BAR_COLORS.length]}`} />
            <span className="text-xs text-gray-600">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Grouped bars */}
      <div className="overflow-x-auto">
        <div className="flex items-end gap-4 min-w-max px-1 pb-1">
          {labels.map((label, li) => (
            <div key={label} className="flex flex-col items-center gap-2 min-w-[80px]">
              {/* Value labels row */}
              <div className="flex justify-center gap-1 w-full">
                {series.map((s, si) => {
                  const val = s.values[li];
                  return (
                    <div key={s.name} className="text-[10px] font-medium text-gray-400 w-5 text-center">
                      {val > 0 ? val.toLocaleString() : ''}
                    </div>
                  );
                })}
              </div>
              {/* Group of bars */}
              <div className="flex items-end gap-1 h-48">
                {series.map((s, si) => {
                  const pct = maxVal > 0 ? (s.values[li] / maxVal) * 100 : 0;
                  const val = s.values[li];
                  return (
                    <div
                      key={s.name}
                      className={`w-5 rounded-t-sm flex-shrink-0 ${BAR_COLORS[si % BAR_COLORS.length]} transition-all`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={`${s.name}: ${val?.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              {/* X-axis label */}
              <span
                className="text-[10px] text-gray-500 text-center leading-tight mt-0.5 max-w-[72px]"
                style={{ wordBreak: 'break-word' }}
                title={label}
              >
                {truncateText(label, 2, 18)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────
export default function AnalyticsHeatmap({ data, title }) {
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
        <GroupedBarChart labels={data.labels} series={data.series} />
      ) : (
        <HeatmapTable labels={data.labels} series={data.series} />
      )}
      <p className="text-right text-xs text-gray-400 mt-1">
        Total: {(data.total || 0).toLocaleString()}
      </p>
    </div>
  );
}
