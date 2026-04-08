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
  'consultations-by-type': 'By Type',
  'consultations-by-mode': 'By Mode',
  'consultation-trends': 'Trends',
  'top-diagnoses': 'Top Diagnoses',
  'diagnoses-by-type': 'By Type',
  'bmi-trends': 'BMI Trends',
  'blood-pressure-trends': 'BP Trends',
  'immunization-coverage': 'Immunization',
  'dental-procedures': 'Dental Procedures',
  'lifestyle-risks': 'Lifestyle Risks',
  'allergy-by-type': 'By Type',
  'allergy-by-severity': 'By Severity',
  'appointments-by-category': 'By Category',
  'appointments-by-status': 'By Status',
  'appointments-by-session': 'By Session',
  // Demographics
  'patients-by-sex': 'Patients by Sex',
  'consultations-by-sex': 'Consultations by Sex',
  'top-diagnoses-by-sex': 'Top Diagnoses by Sex',
  'patients-by-age-group': 'Patients by Age Group',
  'consultations-by-age-group': 'Consultations by Age Group',
  'bmi-by-age-group': 'BMI by Age Group',
  'diagnoses-by-age-group': 'Diagnoses by Age Group',
  'consultations-by-department': 'Consultations by Department',
  'consultations-by-program': 'Consultations by Program',
  'lifestyle-risks-by-department': 'Lifestyle Risks by Department',
  'sex-age-group-matrix': 'Sex × Age Group Matrix',
  'diagnoses-sex-age': 'Diagnoses by Sex & Age',
};

// ── All query keys ───────────────────────────────────────────────────────────

const ALL_QUERY_KEYS = Object.keys(CHART_TYPE_MAP);

// ── Demographics dimension sub-filter ────────────────────────────────────────

const DEMOGRAPHIC_DIMENSIONS = [
  { key: 'all',        label: 'All' },
  { key: 'sex',        label: 'Sex' },
  { key: 'age',        label: 'Age Groups' },
  { key: 'department', label: 'Department' },
  { key: 'program',    label: 'Program' },
  { key: 'matrix',     label: 'Cross-dimensional' },
];

const DEMOGRAPHIC_DIMENSION_QUERIES = {
  all:        QUERY_CATEGORIES.demographics?.queries || [],
  sex:        ['patients-by-sex', 'consultations-by-sex', 'top-diagnoses-by-sex'],
  age:        ['patients-by-age-group', 'consultations-by-age-group', 'bmi-by-age-group', 'diagnoses-by-age-group'],
  department: ['consultations-by-department', 'lifestyle-risks-by-department'],
  program:    ['consultations-by-program'],
  matrix:     ['sex-age-group-matrix', 'diagnoses-sex-age'],
};

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
  const [demographicDimension, setDemographicDimension] = useState('all');
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

  // Get filtered query keys based on active category (+ demographic sub-filter)
  const visibleQueries = useMemo(() => {
    if (activeCategory === 'all') return ALL_QUERY_KEYS;
    if (activeCategory === 'demographics') {
      return DEMOGRAPHIC_DIMENSION_QUERIES[demographicDimension] || QUERY_CATEGORIES.demographics?.queries || [];
    }
    return QUERY_CATEGORIES[activeCategory]?.queries || ALL_QUERY_KEYS;
  }, [activeCategory, demographicDimension]);

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
    <div className="space-y-1.5">
      {/* Page Header — title left, category tabs + export right (matches Appointments/Inventory) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-secondary-800 dark:text-white leading-none m-0">Analytics</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">
            View clinic performance metrics and health data insights
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Category Tabs */}
          <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
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
                onClick={() => setActiveCategory(key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  activeCategory === key
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Export */}
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
      </div>

      {/* Filters */}
      <AnalyticsFilterBar
        branch={branch}
        startDate={startDate}
        endDate={endDate}
        groupBy={groupBy}
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
        onRefresh={loadData}
        loading={loading}
      />

      {/* Demographics dimension sub-filter — only shown on Demographics tab */}
      {activeCategory === 'demographics' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 mr-0.5">Dimension:</span>
          {DEMOGRAPHIC_DIMENSIONS.map((dim) => (
            <button
              key={dim.key}
              onClick={() => setDemographicDimension(dim.key)}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
                demographicDimension === dim.key
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-secondary-500 dark:text-neutral-400 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>
      )}

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
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
