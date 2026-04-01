import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AnalyticsFilterBar from './components/analytics-filter-bar';
import AnalyticsChartCard from './components/analytics-chart-card';
import AnalyticsSummaryCards from './components/analytics-summary-cards';
import {
  fetchMultipleQueries,
  fetchAvailableQueries,
  QUERY_CATEGORIES,
  CHART_TYPE_MAP,
} from './analytics-service';

// ── Friendly display names ───────────────────────────────────────────────────

const QUERY_LABELS = {
  'consultations-by-type': 'Consultations by Type',
  'consultations-by-status': 'Consultations by Status',
  'consultation-trends': 'Monthly Consultation Trends',
  'top-diagnoses': 'Top 10 Diagnoses',
  'diagnoses-by-type': 'Diagnoses by Type',
  'bmi-trends': 'BMI Trends (Monthly)',
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

// ── Date helpers ─────────────────────────────────────────────────────────────

function getDefaultDates() {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setMonth(start.getMonth() - 6);
  const startDate = start.toISOString().slice(0, 10);
  return { startDate, endDate };
}

// ── All query keys ───────────────────────────────────────────────────────────

const ALL_QUERY_KEYS = Object.keys(CHART_TYPE_MAP);

/**
 * Staff Analytics View
 * Main analytics page matching the staff portal design system.
 */
const StaffAnalytics = () => {
  const defaults = getDefaultDates();
  const [branch, setBranch] = useState('Both');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
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
      const data = await fetchMultipleQueries(ALL_QUERY_KEYS, branch, startDate, endDate);
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
  }, [branch, startDate, endDate]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Analytics</h1>
        <p className="text-[11px] text-secondary-500 dark:text-neutral-400">
          View clinic performance metrics and health data insights
        </p>
      </div>

      {/* Filters */}
      <AnalyticsFilterBar
        branch={branch}
        startDate={startDate}
        endDate={endDate}
        activeCategory={activeCategory}
        onBranchChange={setBranch}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
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
    </div>
  );
};

export default StaffAnalytics;
