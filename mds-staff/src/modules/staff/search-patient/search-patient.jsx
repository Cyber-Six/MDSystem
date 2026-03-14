import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchPatients } from '../../../services/patient-search-service';
import SearchBar from './components/search-bar';
import SearchResultsList from './components/search-results-list';
import PatientDetailPanel from './components/patient-detail-panel';

const SearchPatient = () => {
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

  // ── Debounced search ──────────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasFired(false);
      setFocusedIdx(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setHasFired(true);
      setFocusedIdx(-1);
      try {
        const data = await searchPatients(trimmed);
        setResults(data);
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Filter by type locally ────────────────────────────────────────────────────
  const filtered = results.filter((p) => {
    if (searchType === 'student') return p.profile_type === 'Student';
    if (searchType === 'employee') return p.profile_type === 'Employee';
    return true;
  });

  // Clear selected patient when results change and it's no longer in the list
  useEffect(() => {
    if (selectedPatient && !filtered.find((p) => p.id === selectedPatient.id)) {
      setSelectedPatient(null);
    }
  }, [filtered, selectedPatient]);

  // ── Keyboard nav ──────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
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
  );
};

export default SearchPatient;
