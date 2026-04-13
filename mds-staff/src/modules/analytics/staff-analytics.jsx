import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePermissions } from '../../context/permissions-context';
import AnalyticsFilterBar from './components/analytics-filter-bar';
import AnalyticsChartCard from './components/analytics-chart-card';
import AnalyticsSummaryCards from './components/analytics-summary-cards';
import AnalyticsExportModal from './components/analytics-export-modal';
import {
  fetchMultipleQueries,
  fetchFilterOptions,
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

// ── Default tab (lightest load for RPi) ──────────────────────────────────────

const DEFAULT_CATEGORY = 'consultations';

/**
 * Returns the query keys that need to be fetched for a given category + dimension.
 */
function getQueriesForCategory(category, demoDimension = 'all') {
  if (category === 'all') return ALL_QUERY_KEYS;
  if (category === 'demographics') {
    return DEMOGRAPHIC_DIMENSION_QUERIES[demoDimension] || QUERY_CATEGORIES.demographics?.queries || [];
  }
  return QUERY_CATEGORIES[category]?.queries || [];
}

/**
 * Staff Analytics View
 * Lazy-loads analytics data per category tab to reduce server load.
 * Results are cached — switching tabs does not re-fetch unless filters change.
 */
const StaffAnalytics = () => {
  const defaults = getDateRangeForPeriod('monthly');
  const { branch: permBranch, allowedBranches, isAdmin } = usePermissions();
  const [branch, setBranch] = useState(() => permBranch || 'Both');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [groupBy, setGroupBy] = useState('monthly');
  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [demographicDimension, setDemographicDimension] = useState('all');

  // Department / sex filter (demographics tab)
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSex, setSelectedSex] = useState('');
  const [filterOptions, setFilterOptions] = useState({ departments: [], sexes: [] });

  // Cache: Map<queryKey, result> — persists across tab switches, cleared on filter change
  const [cache, setCache] = useState(new Map());
  // Track which categories have been fetched for the current filter combo
  const [fetchedCategories, setFetchedCategories] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const abortRef = useRef(0);

  // Sync branch when permissions finish loading
  useEffect(() => {
    if (permBranch && !isAdmin && branch === 'Both' && permBranch !== 'Both') {
      setBranch(permBranch);
    }
  }, [permBranch]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load filter options on initial mount (not just demographics tab)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const options = await fetchFilterOptions();
        setFilterOptions({
          departments: options.departments || [],
          sexes: options.sexes || []
        });
      } catch (error) {
        console.error('Failed to load filter options:', error);
        // Set empty arrays as fallback so dropdowns don't show "Loading..."
        setFilterOptions({
          departments: [],
          sexes: []
        });
      }
    };

    // Load immediately on component mount
    if (filterOptions.departments.length === 0 && filterOptions.sexes.length === 0) {
      loadFilters();
    }
  }, []); // Run once on mount

  // Build filters object for demographic queries
  const demoFilters = useMemo(() => {
    if (activeCategory !== 'demographics') return {};
    const f = {};
    if (selectedDepartment) f.department = selectedDepartment;
    if (selectedSex) f.sex = selectedSex;
    return f;
  }, [activeCategory, selectedDepartment, selectedSex]);

  // Current visible queries based on active tab + dimension
  const visibleQueries = useMemo(() =>
    getQueriesForCategory(activeCategory, demographicDimension),
    [activeCategory, demographicDimension]
  );

  /**
   * Fetch only the missing queries for a given list of query keys.
   * Merges results into the cache. Skips already-cached keys.
   */
  const fetchQueries = useCallback(async (queryKeys, opts = {}) => {
    const reqId = ++abortRef.current;
    const missing = opts.force
      ? queryKeys
      : queryKeys.filter(k => !cache.has(k));

    if (missing.length === 0) return; // all cached

    setLoading(true);
    try {
      const data = await fetchMultipleQueries(missing, branch, startDate, endDate, groupBy, opts.filters);
      if (reqId !== abortRef.current) return; // stale

      setCache(prev => {
        const next = new Map(prev);
        for (const [key, value] of data.entries()) {
          next.set(key, value);
        }
        return next;
      });
      setInitialLoad(false);
    } catch {
      // Individual errors handled in fetchMultipleQueries
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, [branch, startDate, endDate, groupBy, cache]);

  /**
   * Fetch the active category's queries (lazy load on tab switch).
   * Uses a category-level flag so we don't re-fetch when switching back.
   */
  const loadActiveCategory = useCallback(async (force = false) => {
    const deptSex = activeCategory === 'demographics'
      ? `:dept=${selectedDepartment}:sex=${selectedSex}` : '';
    const catKey = activeCategory === 'demographics'
      ? `demographics:${demographicDimension}${deptSex}`
      : activeCategory;

    if (!force && fetchedCategories.has(catKey)) return;

    const queries = getQueriesForCategory(activeCategory, demographicDimension);
    const filters = activeCategory === 'demographics' ? demoFilters : {};
    await fetchQueries(queries, { force, filters });

    setFetchedCategories(prev => new Set(prev).add(catKey));
  }, [activeCategory, demographicDimension, selectedDepartment, selectedSex, demoFilters, fetchedCategories, fetchQueries]);

  // Fetch on tab switch or initial mount
  useEffect(() => {
    loadActiveCategory();
  }, [activeCategory, demographicDimension]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch demographics when dept/sex filter changes
  useEffect(() => {
    if (activeCategory === 'demographics') {
      // Clear demographic cache entries and re-fetch
      setCache(prev => {
        const next = new Map(prev);
        const demoKeys = QUERY_CATEGORIES.demographics?.queries || [];
        demoKeys.forEach(k => next.delete(k));
        return next;
      });
      // Remove all demographics fetched keys so they re-load
      setFetchedCategories(prev => {
        const next = new Set();
        for (const k of prev) { if (!k.startsWith('demographics:')) next.add(k); }
        return next;
      });
      loadActiveCategory(true);
    }
  }, [selectedDepartment, selectedSex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cache + re-fetch when filters change (branch, dates, groupBy)
  const prevFiltersRef = useRef({ branch, startDate, endDate, groupBy });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.branch === branch && prev.startDate === startDate && prev.endDate === endDate && prev.groupBy === groupBy) return;
    prevFiltersRef.current = { branch, startDate, endDate, groupBy };

    // Filters changed — clear everything and re-fetch active tab
    setCache(new Map());
    setFetchedCategories(new Set());
    // loadActiveCategory with force will be triggered by the dependency change
  }, [branch, startDate, endDate, groupBy]);

  // After cache/fetchedCategories are cleared by filter change, re-load active tab
  useEffect(() => {
    if (cache.size === 0 && !initialLoad) {
      loadActiveCategory(true);
    }
  }, [cache.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh — force re-fetch active tab
  const handleRefresh = useCallback(() => {
    const queries = getQueriesForCategory(activeCategory, demographicDimension);
    const filters = activeCategory === 'demographics' ? demoFilters : {};
    fetchQueries(queries, { force: true, filters });
  }, [activeCategory, demographicDimension, demoFilters, fetchQueries]);

  return (
    <div className="space-y-1.5">
      {/* Page Header — title left, category tabs + export right */}
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
        sex={selectedSex}
        department={selectedDepartment}
        sexOptions={filterOptions.sexes}
        departmentOptions={filterOptions.departments}
        allowedBranches={allowedBranches()}
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
        onSexChange={setSelectedSex}
        onDepartmentChange={setSelectedDepartment}
        onRefresh={handleRefresh}
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

          {/* Department filter dropdown */}
          {filterOptions.departments.length > 0 && (
            <>
              <span className="text-[10px] text-neutral-300 dark:text-neutral-600 mx-1">|</span>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-[11px] px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Departments</option>
                {filterOptions.departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}

          {/* Sex filter dropdown */}
          {filterOptions.sexes.length > 0 && (
            <select
              value={selectedSex}
              onChange={(e) => setSelectedSex(e.target.value)}
              className="text-[11px] px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Sex</option>
              {filterOptions.sexes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Summary KPI Cards (only when 'all' category and has data) */}
      {activeCategory === 'all' && cache.size > 0 && (
        <AnalyticsSummaryCards results={cache} />
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
              data={cache.get(queryKey)}
              loading={loading && !cache.has(queryKey)}
              error={cache.get(queryKey)?.error}
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
        department={selectedDepartment}
        sex={selectedSex}
      />
    </div>
  );
};

export default StaffAnalytics;
