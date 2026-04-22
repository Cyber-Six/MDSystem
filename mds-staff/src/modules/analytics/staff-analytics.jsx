import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePermissions } from '../../context/permissions-context';
import { useSettings } from '../../context/settings-context';
import AnalyticsFilterBar from './components/analytics-filter-bar';
import AnalyticsChartCard from './components/analytics-chart-card';
import AnalyticsSummaryCards from './components/analytics-summary-cards';
import AnalyticsExportModal from './components/analytics-export-modal';
import { readPersistedViewState, writePersistedViewState } from '../../utils/persistent-view-state';
import {
  fetchAvailableQueries,
  fetchMultipleQueries,
  fetchFilterOptions,
  QUERY_CATEGORIES,
  CHART_TYPE_MAP,
  getDateRangeForPeriod,
} from './analytics-service';       

// ── All query keys ───────────────────────────────────────────────────────────

const ALL_QUERY_KEYS = Object.keys(CHART_TYPE_MAP);

// ── Demographics dimension sub-filter ────────────────────────────────────────

const DEMOGRAPHIC_DIMENSIONS = [
  { key: 'all',        label: 'All' },
  { key: 'sex',        label: 'Sex' },
  { key: 'age',        label: 'Age Groups' },
  { key: 'studentType', label: 'Student Type' },
  { key: 'department', label: 'Department' },
  { key: 'program',    label: 'Program' },
  { key: 'matrix',     label: 'Cross-dimensional' },
];

const DEMOGRAPHIC_DIMENSION_QUERIES = {
  all:        QUERY_CATEGORIES.demographics?.queries || [],
  sex:        ['patients-by-sex', 'consultations-by-sex', 'top-diagnoses-by-sex'],
  age:        ['patients-by-age-group', 'consultations-by-age-group', 'bmi-by-age-group', 'diagnoses-by-age-group'],
  studentType: ['students-by-type'],
  department: ['consultations-by-department', 'lifestyle-risks-by-department'],
  program:    ['consultations-by-program'],
  matrix:     ['sex-age-group-matrix', 'diagnoses-sex-age'],
};

const ANALYTICS_CATEGORY_STORAGE_KEY = 'mds_staff_analytics_active_category';
const ANALYTICS_DIMENSION_STORAGE_KEY = 'mds_staff_analytics_demographic_dimension';
const ANALYTICS_CATEGORY_KEYS = ['all', ...Object.keys(QUERY_CATEGORIES)];
const ANALYTICS_DIMENSION_KEYS = DEMOGRAPHIC_DIMENSIONS.map((dimension) => dimension.key);
const isAnalyticsCategory = (value) => ANALYTICS_CATEGORY_KEYS.includes(value);
const isAnalyticsDimension = (value) => ANALYTICS_DIMENSION_KEYS.includes(value);

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

function resolveMetadataChartTitle(metricResult) {
  const metadataTitle = metricResult?.data?.chartContext?.title;
  if (typeof metadataTitle === 'string' && metadataTitle.trim()) {
    return metadataTitle.trim();
  }
  return 'No Data Available';
}

/**
 * Staff Analytics View
 * Lazy-loads analytics data per category tab to reduce server load.
 * Results are cached — switching tabs does not re-fetch unless filters change.
 */
const StaffAnalytics = () => {
  const defaults = getDateRangeForPeriod('monthly');
  const { branch: permBranch, allowedBranches, isAdmin } = usePermissions();
  const { isDarkMode } = useSettings();
  const [branch, setBranch] = useState(() => permBranch || 'Both');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [groupBy, setGroupBy] = useState('monthly');
  const [activeCategory, setActiveCategory] = useState(() => (
    readPersistedViewState(ANALYTICS_CATEGORY_STORAGE_KEY, DEFAULT_CATEGORY, isAnalyticsCategory)
  ));
  const [demographicDimension, setDemographicDimension] = useState(() => (
    readPersistedViewState(ANALYTICS_DIMENSION_STORAGE_KEY, 'all', isAnalyticsDimension)
  ));

  // Department / sex filter (global across analytics categories)
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSex, setSelectedSex] = useState('');
  const [filterOptions, setFilterOptions] = useState({ departments: [], sexes: [] });
  const [supportedQueryKeys, setSupportedQueryKeys] = useState(() => new Set(ALL_QUERY_KEYS));
  const [queryCatalogReady, setQueryCatalogReady] = useState(false);

  // Cache: Map<queryKey, result> — persists across tab switches, cleared on filter change
  const [cache, setCache] = useState(new Map());
  // Track which categories have been fetched for the current filter combo
  const [fetchedCategories, setFetchedCategories] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!isAnalyticsCategory(activeCategory)) return;
    writePersistedViewState(ANALYTICS_CATEGORY_STORAGE_KEY, activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!isAnalyticsDimension(demographicDimension)) return;
    writePersistedViewState(ANALYTICS_DIMENSION_STORAGE_KEY, demographicDimension);
  }, [demographicDimension]);

  // Sync branch when permissions finish loading
  useEffect(() => {
    if (permBranch && !isAdmin && branch === 'Both' && permBranch !== 'Both') {
      setBranch(permBranch);
    }
  }, [permBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load backend-supported analytics query keys so the UI does not request unknown metrics.
  useEffect(() => {
    const loadSupportedQueries = async () => {
      try {
        const queries = await fetchAvailableQueries();
        const supported = new Set(
          (Array.isArray(queries) ? queries : [])
            .map((entry) => {
              if (typeof entry === 'string') return entry;
              if (entry && typeof entry === 'object') return entry.name;
              return '';
            })
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        );

        if (supported.size > 0) {
          setSupportedQueryKeys(supported);
        }
      } catch (error) {
        console.error('Failed to load available analytics queries:', error);
      } finally {
        setQueryCatalogReady(true);
      }
    };

    loadSupportedQueries();
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

    // Load immediately on component mount.
    loadFilters();
  }, []); // Run once on mount

  // Build filters object used by all analytics queries
  const activeFilters = useMemo(() => {
    const f = {};
    if (selectedDepartment) f.department = selectedDepartment;
    if (selectedSex) f.sex = selectedSex;
    return f;
  }, [selectedDepartment, selectedSex]);

  const getSupportedQueriesForCategory = useCallback((category, demoDimension = 'all') => {
    const categoryQueries = getQueriesForCategory(category, demoDimension);
    if (!supportedQueryKeys || supportedQueryKeys.size === 0) return categoryQueries;
    return categoryQueries.filter((queryKey) => supportedQueryKeys.has(queryKey));
  }, [supportedQueryKeys]);

  // Current visible queries based on active tab + dimension
  const visibleQueries = useMemo(() => {
    if (!queryCatalogReady) return [];
    return getSupportedQueriesForCategory(activeCategory, demographicDimension);
  }, [activeCategory, demographicDimension, getSupportedQueriesForCategory, queryCatalogReady]);

  const supportedDemographicDimensions = useMemo(() => {
    if (!queryCatalogReady) return DEMOGRAPHIC_DIMENSIONS;
    return DEMOGRAPHIC_DIMENSIONS.filter(
      (dimension) => getSupportedQueriesForCategory('demographics', dimension.key).length > 0
    );
  }, [getSupportedQueriesForCategory, queryCatalogReady]);

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
    if (!queryCatalogReady) return;

    const deptSex = `:dept=${selectedDepartment || 'all'}:sex=${selectedSex || 'all'}`;
    const catKey = activeCategory === 'demographics'
      ? `demographics:${demographicDimension}${deptSex}`
      : `${activeCategory}${deptSex}`;

    if (!force && fetchedCategories.has(catKey)) return;

    const queries = getSupportedQueriesForCategory(activeCategory, demographicDimension);
    if (queries.length === 0) {
      setInitialLoad(false);
      setFetchedCategories(prev => new Set(prev).add(catKey));
      return;
    }
    const filters = activeFilters;
    await fetchQueries(queries, { force, filters });

    setFetchedCategories(prev => new Set(prev).add(catKey));
  }, [queryCatalogReady, activeCategory, demographicDimension, selectedDepartment, selectedSex, getSupportedQueriesForCategory, activeFilters, fetchedCategories, fetchQueries]);

  // If a persisted demographics dimension is no longer supported by the backend, switch to the first available.
  useEffect(() => {
    if (!queryCatalogReady || activeCategory !== 'demographics') return;
    if (getSupportedQueriesForCategory('demographics', demographicDimension).length > 0) return;

    const fallbackDimension = supportedDemographicDimensions[0]?.key || 'all';
    if (fallbackDimension !== demographicDimension) {
      setDemographicDimension(fallbackDimension);
    }
  }, [queryCatalogReady, activeCategory, demographicDimension, getSupportedQueriesForCategory, supportedDemographicDimensions]);

  // Fetch on tab switch or initial mount
  useEffect(() => {
    loadActiveCategory();
  }, [activeCategory, demographicDimension]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cache + re-fetch when filters change
  const prevFiltersRef = useRef({ branch, startDate, endDate, groupBy, selectedDepartment, selectedSex });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.branch === branch &&
      prev.startDate === startDate &&
      prev.endDate === endDate &&
      prev.groupBy === groupBy &&
      prev.selectedDepartment === selectedDepartment &&
      prev.selectedSex === selectedSex
    ) return;
    prevFiltersRef.current = { branch, startDate, endDate, groupBy, selectedDepartment, selectedSex };

    // Filters changed — clear everything and re-fetch active tab
    setCache(new Map());
    setFetchedCategories(new Set());
    // loadActiveCategory with force will be triggered by the dependency change
  }, [branch, startDate, endDate, groupBy, selectedDepartment, selectedSex]);

  // After cache/fetchedCategories are cleared by filter change, re-load active tab
  useEffect(() => {
    if (cache.size === 0 && !initialLoad) {
      loadActiveCategory(true);
    }
  }, [cache.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh — force re-fetch active tab
  const handleRefresh = useCallback(() => {
    const queries = getSupportedQueriesForCategory(activeCategory, demographicDimension);
    if (queries.length === 0) return;
    const filters = activeFilters;
    fetchQueries(queries, { force: true, filters });
  }, [activeCategory, demographicDimension, getSupportedQueriesForCategory, activeFilters, fetchQueries]);

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
          {DEMOGRAPHIC_DIMENSIONS.map((dim) => {
            const isSupported = !queryCatalogReady || getSupportedQueriesForCategory('demographics', dim.key).length > 0;

            return (
            <button
              key={dim.key}
              onClick={() => setDemographicDimension(dim.key)}
              disabled={!isSupported}
              title={isSupported ? undefined : 'Unavailable on the current backend'}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
                demographicDimension === dim.key
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : isSupported
                    ? 'bg-white dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-secondary-500 dark:text-neutral-400 hover:border-emerald-400 hover:text-emerald-600'
                    : 'bg-neutral-100 dark:bg-neutral-700/40 border-neutral-200 dark:border-neutral-700 text-secondary-300 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              {dim.label}
            </button>
            );
          })}

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
              title={resolveMetadataChartTitle(cache.get(queryKey))}
              data={cache.get(queryKey)}
              loading={loading && !cache.has(queryKey)}
              error={cache.get(queryKey)?.error}
              dark={isDarkMode}
              branch={branch}
              startDate={startDate}
              endDate={endDate}
              groupBy={groupBy}
              department={selectedDepartment}
              sex={selectedSex}
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
