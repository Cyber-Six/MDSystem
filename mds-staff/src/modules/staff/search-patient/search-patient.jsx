import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { searchPatients } from '../../../services/patient-search-service';
import { usePatientTabs } from '../../../context/patient-tabs-context';
import SearchBar from './components/search-bar';
import SearchResultsList from './components/search-results-list';
import PatientDetailPanel from './components/patient-detail-panel';

const PatientRecord = lazy(() => import('../../../pages/PatientRecord.jsx'));

// ── Change this value to adjust the search debounce delay ───────────────────
const SEARCH_DEBOUNCE_MS = 1000;

const TabLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

const SearchPatient = () => {
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, switchToSearch } = usePatientTabs();

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]           = useState('');
  const [results, setResults]                 = useState([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState(null);
  const [hasFired, setHasFired]               = useState(false);
  const [focusedIdx, setFocusedIdx]           = useState(-1);
  const [searchType, setSearchType]           = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // ── Debounced search (shows loader immediately, waits before API call) ────
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasFired(false);
      setFocusedIdx(-1);
      setIsLoading(false);
      return;
    }

    // Show loader immediately while waiting for debounce
    setIsLoading(true);
    setHasFired(true);
    setError(null);
    setFocusedIdx(-1);

    const timer = setTimeout(async () => {
      try {
        const data = await searchPatients(trimmed);
        setResults(data);
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Filter by type locally ────────────────────────────────────────────────
  const filtered = results.filter((p) => {
    if (searchType === 'student') return p.profile_type === 'Student';
    if (searchType === 'employee') return p.profile_type === 'Employee';
    return true;
  });

  // Clear selected patient when filtered out
  useEffect(() => {
    if (selectedPatient && !filtered.find((p) => p.id === selectedPatient.id)) {
      setSelectedPatient(null);
    }
  }, [filtered, selectedPatient]);

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!filtered.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault();
        setSelectedPatient(filtered[focusedIdx]);
      } else if (e.key === 'Escape') {
        setSearchTerm('');
        setSelectedPatient(null);
      }
    },
    [filtered, focusedIdx]
  );

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
    const row = listRef.current.children[focusedIdx];
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  // Check if we're showing search view (no active patient tab)
  const isSearchActive = activeTabId === null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">
      {/* ── Chrome-like Tab Bar ─────────────────────────────────────────────── */}
      <div className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex items-end overflow-x-auto">
        {/* Search tab (always first, not closable) */}
        <button
          onClick={switchToSearch}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-r border-neutral-200 dark:border-neutral-700 transition-colors rounded-t-lg ${
            isSearchActive
              ? 'bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white border-t-2 border-t-primary-500'
              : 'text-secondary-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>

        {/* Patient tabs */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 pl-3 pr-1 py-2.5 text-sm whitespace-nowrap border-r border-neutral-200 dark:border-neutral-700 transition-colors rounded-t-lg group max-w-[220px] ${
              activeTabId === tab.id
                ? 'bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white border-t-2 border-t-primary-500'
                : 'text-secondary-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
            }`}
          >
            <button
              onClick={() => setActiveTabId(tab.id)}
              className="flex items-center gap-1.5 min-w-0 flex-1"
              title={`${tab.patientName} - ${tab.label}`}
            >
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {tab.patientName.charAt(0)}
              </span>
              <span className="truncate font-medium text-xs">
                {tab.patientName}
              </span>
              <span className="text-[10px] text-secondary-400 dark:text-neutral-500 flex-shrink-0">
                {tab.label}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-secondary-400 hover:text-secondary-700 dark:text-neutral-500 dark:hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              title="Close tab"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="pt-3">
        {/* Search view */}
        {isSearchActive && (
          <div className="flex gap-4">
            {/* Left: search + results */}
            <div className={`space-y-3 transition-all ${selectedPatient ? 'flex-1 min-w-0' : 'w-full'}`}>
              <SearchBar
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                searchType={searchType}
                onSearchTypeChange={setSearchType}
                isLoading={isLoading}
                resultCount={filtered.length}
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
              />

              {/* Error message */}
              {error && (
                <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 text-sm text-error-700 dark:text-error-400">
                  {error}
                </div>
              )}

              {/* Results or empty states */}
              <SearchResultsList
                patients={filtered}
                hasFired={hasFired}
                isLoading={isLoading}
                error={null}
                searchTerm={searchTerm}
                focusedIdx={focusedIdx}
                selectedPatientId={selectedPatient?.id}
                onSelectPatient={setSelectedPatient}
                listRef={listRef}
              />

              {/* Empty state before any search */}
              {!hasFired && !isLoading && (
                <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-12 text-center">
                  <svg className="w-12 h-12 mx-auto text-secondary-200 dark:text-neutral-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm font-medium text-secondary-500 dark:text-neutral-400">Search for a patient</p>
                  <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Enter a name, student/employee ID, or email</p>
                </div>
              )}
            </div>

            {/* Right: detail panel */}
            {selectedPatient && (
              <div className="w-80 lg:w-96 flex-shrink-0">
                <PatientDetailPanel
                  patient={selectedPatient}
                  onClose={() => setSelectedPatient(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Patient record tabs (render all, show only active for state retention) */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={activeTabId === tab.id ? '' : 'hidden'}
          >
            <Suspense fallback={<TabLoader />}>
              <PatientRecord
                patientId={tab.patientId}
                initialTab={tab.section}
                embedded
              />
            </Suspense>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPatient;
