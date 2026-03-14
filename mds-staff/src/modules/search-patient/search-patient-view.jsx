import React, { useCallback, useEffect, useRef, useState } from 'react';
import SearchToolbar from './components/search-toolbar';
import SearchResultsPanel from './components/search-results-panel';
import { getMockPatients } from './mock-patients';
import { searchPatients } from './search-patient-service';

export default function SearchPatientView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchNotice, setSearchNotice] = useState(null);
  const [hasFired, setHasFired] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [searchType, setSearchType] = useState('all');
  const listRef = useRef(null);

  const openPatientInNewTab = useCallback((id) => {
    if (!id) return;
    const url = `/patient/${id}?tab=personal`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

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
      setSearchNotice(null);
      setHasFired(true);
      setFocusedIdx(-1);

      try {
        const data = await searchPatients(trimmed);
        setResults(data);
      } catch (err) {
        const fallback = getMockPatients(trimmed);
        setResults(fallback);

        if (fallback.length > 0) {
          setError(null);
          setSearchNotice('Live search is temporarily unavailable. Showing mock data only.');
        } else {
          setError(err.message || 'Search failed');
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filtered = results.filter((patient) => {
    if (searchType === 'student') return patient.profile_type === 'Student';
    if (searchType === 'employee') return patient.profile_type === 'Employee';
    return true;
  });

  const handleKeyDown = useCallback((e) => {
    if (!filtered.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((idx) => Math.min(idx + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((idx) => Math.max(idx - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      openPatientInNewTab(filtered[focusedIdx].id);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
  }, [filtered, focusedIdx, openPatientInNewTab]);

  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
    const row = listRef.current.children[focusedIdx];
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  return (
    <div className="space-y-3">
      <SearchToolbar
        isLoading={isLoading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleKeyDown={handleKeyDown}
        searchType={searchType}
        setSearchType={setSearchType}
        filteredCount={filtered.length}
      />

      {error && filtered.length === 0 && (
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      {searchNotice && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
          {searchNotice}
        </div>
      )}

      <SearchResultsPanel
        hasFired={hasFired}
        isLoading={isLoading}
        filtered={filtered}
        searchTerm={searchTerm}
        focusedIdx={focusedIdx}
        listRef={listRef}
        onOpenPatientInNewTab={openPatientInNewTab}
      />

      {!hasFired && !isLoading && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-secondary-200 dark:text-neutral-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-medium text-secondary-500 dark:text-neutral-400">Search for a patient</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Enter a name or student/employee ID number</p>
        </div>
      )}
    </div>
  );
}
