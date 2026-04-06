import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AnalyticsFilterBar from './components/analytics-filter-bar';
import AnalyticsChartCard from './components/analytics-chart-card';
import AnalyticsSummaryCards from './components/analytics-summary-cards';
import AnalyticsExportModal from './components/analytics-export-modal';
import {
  fetchMultipleQueries,
  fetchAvailableQueries,
  QUERY_CATEGORIES,
  CHART_TYPE_MAP,
  getDateRangeForPeriod,
} from './analytics-service';

// ── Friendly display names ───────────────────────────────────────────────────

const QUERY_LABELS = {
  'consultations-by-type': 'Consultations by Type',
  'consultations-by-mode': 'Consultations by Mode',
  'consultation-trends': 'Consultation Trends',
  'top-diagnoses': 'Top 10 Diagnoses',
  'diagnoses-by-type': 'Diagnoses by Type',
  'bmi-trends': 'BMI Trends',
  'blood-pressure-trends': 'Blood Pressure Trends',
  'immunization-coverage': 'Immunization Coverage',
  'dental-procedures': 'Top Dental Procedures',
  'lifestyle-risks': 'Lifestyle Risk Factors',
  'allergy-by-type': 'Allergies by Type',
  'allergy-by-severity': 'Allergies by Severity',
  'appointments-by-category': 'Appointments by Category',
  'appointments-by-status': 'Appointments by Status',
  'appointments-by-session': 'Appointments by Session',
};

// ── All query keys ───────────────────────────────────────────────────────────

const ALL_QUERY_KEYS = Object.keys(CHART_TYPE_MAP);

/**
 * Staff Analytics View
 * Main analytics page matching the staff portal design system.
 */
const StaffAnalytics = () => {
  const defaults = getDateRangeForPeriod('monthly');
  const [branch, setBranch] = useState('Both');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [groupBy, setGroupBy] = useState('monthly');
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const abortRef = useRef(0);

  // Detect dark mode via class on <html>
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(el.classList.contains('dark'));
    });
    setDark(el.classList.contains('dark'));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Get filtered query keys based on active category
  const visibleQueries = useMemo(() => {
    if (activeCategory === 'all') return ALL_QUERY_KEYS;
    return QUERY_CATEGORIES[activeCategory]?.queries || ALL_QUERY_KEYS;
  }, [activeCategory]);

  // Fetch data
  const loadData = useCallback(async () => {
    const reqId = ++abortRef.current;
    setLoading(true);

    try {
      const data = await fetchMultipleQueries(ALL_QUERY_KEYS, branch, startDate, endDate, groupBy);
      if (reqId === abortRef.current) {
        setResults(data);
        setInitialLoad(false);
      }
    } catch {
      // Individual query errors are handled inside fetchMultipleQueries
    } finally {
      if (reqId === abortRef.current) {
        setLoading(false);
      }
    }
  }, [branch, startDate, endDate, groupBy]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Analytics</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">
            View clinic performance metrics and health data insights
          </p>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-700 hover:bg-secondary-800 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-white text-xs font-medium rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Filters */}
      <AnalyticsFilterBar
        branch={branch}
        startDate={startDate}
        endDate={endDate}
        groupBy={groupBy}
        activeCategory={activeCategory}
        onBranchChange={setBranch}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onGroupByChange={(g) => {
          setGroupBy(g);
          if (g !== 'custom') {
            const range = getDateRangeForPeriod(g);
            setStartDate(range.startDate);
            setEndDate(range.endDate);
          }
        }}
        onCategoryChange={setActiveCategory}
        onRefresh={loadData}
        loading={loading}
      />

      {/* Summary KPI Cards (only when 'all' category or initial view) */}
      {activeCategory === 'all' && (
        <AnalyticsSummaryCards results={results} />
      )}

      {/* Charts Grid */}
      {initialLoad && loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3"></div>
            <p className="text-xs text-secondary-500 dark:text-neutral-400">Loading analytics data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visibleQueries.map((queryKey) => (
            <AnalyticsChartCard
              key={queryKey}
              dataType={queryKey}
              title={QUERY_LABELS[queryKey] || queryKey}
              data={results.get(queryKey)}
              loading={loading && !results.has(queryKey)}
              error={results.get(queryKey)?.error}
              dark={dark}
              branch={branch}
              startDate={startDate}
              endDate={endDate}
              groupBy={groupBy}
            />
          ))}
        </div>
      )}

      {/* Empty state if no queries match */}
      {!loading && visibleQueries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No analytics queries available for this category.</p>
        </div>
      )}

      {/* Export Modal */}
      <AnalyticsExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        branch={branch}
        startDate={startDate}
        endDate={endDate}
        groupBy={groupBy}
      />
    </div>
  );
};

export default StaffAnalytics;
