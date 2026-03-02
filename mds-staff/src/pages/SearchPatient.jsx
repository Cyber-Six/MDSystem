import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosRequest } from '../packages-core-adapter';

// ── GraphQL query ────────────────────────────────────────────────────────────
const SEARCH_PATIENTS = `
  query SearchPatients($searchTerm: String!, $limit: Int) {
    searchPatients(searchTerm: $searchTerm, limit: $limit) {
      id
      identifier
      branch
      sex
      first_name
      last_name
      middle_name
      suffix
      profile_type
      program
      year
      department
      role
      latest_ticket_id
      latest_status
      latest_scope
      latest_updated_at
    }
  }
`;

async function searchPatients(searchTerm) {
  const response = await axiosRequest.post('/emr/medical', {
    query: SEARCH_PATIENTS,
    variables: { searchTerm, limit: 15 },
  });
  if (response.data.errors) throw new Error(response.data.errors[0]?.message || 'Search failed');
  return response.data.data.searchPatients || [];
}

// ── Status badge helper ───────────────────────────────────────────────────────
const STATUS_STYLES = {
  InProgress:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Pending:            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Revision:           'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  RevisionSubmitted:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Approved:           'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Expired:            'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
  Cancelled:          'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
};

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.Expired}`}>
      {status}
    </span>
  );
}

function ScopeBadge({ scope }) {
  if (!scope) return null;
  const colors = {
    Medical: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
    Dental:  'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    Both:    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[scope] || ''}`}>
      {scope}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const SearchPatient = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm]       = useState('');
  const [results, setResults]             = useState([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState(null);
  const [hasFired, setHasFired]           = useState(false);
  const [focusedIdx, setFocusedIdx]       = useState(-1);
  const [searchType, setSearchType]       = useState('all');
  const inputRef    = useRef(null);
  const listRef     = useRef(null);

  // ── Debounced search ──────────────────────────────────────────────────────
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

  // ── Filter by type locally ────────────────────────────────────────────────
  const filtered = results.filter(p => {
    if (searchType === 'student')  return p.profile_type === 'Student';
    if (searchType === 'employee') return p.profile_type === 'Employee';
    return true;
  });

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      navigate(`/patient/${filtered[focusedIdx].id}`);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
  }, [filtered, focusedIdx, navigate]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
    const row = listRef.current.children[focusedIdx];
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  // ── Helper: display name ──────────────────────────────────────────────────
  const fullName = (p) => {
    const parts = [p.last_name, p.first_name, p.middle_name].filter(Boolean);
    if (!parts.length) return 'Unknown';
    return p.last_name
      ? `${p.last_name}, ${p.first_name}${p.middle_name ? ' ' + p.middle_name[0] + '.' : ''}${p.suffix ? ' ' + p.suffix : ''}`
      : p.first_name || 'Unknown';
  };

  const initials = (p) => {
    const f = p.first_name?.[0] || '';
    const l = p.last_name?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const profileLabel = (p) => {
    if (p.profile_type === 'Student') return p.program ? `${p.program} · ${p.year || ''}` : 'Student';
    if (p.profile_type === 'Employee') return p.department ? `${p.department} · ${p.role || ''}` : 'Employee';
    return p.profile_type || '—';
  };

  const dateLabel = (iso) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return null; }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Search controls */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Input */}
          <div className="flex-1 relative">
            {isLoading ? (
              <svg className="animate-spin absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name or student/employee ID…"
              autoComplete="off"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Type filter */}
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="student">Students</option>
            <option value="employee">Employees</option>
          </select>
        </div>

        {/* Hint */}
        <div className="mt-1.5 flex items-center gap-2">
          {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
            <p className="text-xs text-secondary-400 dark:text-neutral-500">Type at least 2 characters to search…</p>
          )}
          {filtered.length > 0 && !isLoading && (
            <p className="text-xs text-secondary-400 dark:text-neutral-500">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} · ↑↓ to navigate · Enter to open
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      {/* Results */}
      {hasFired && !isLoading && !error && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">No patients found for "{searchTerm}"</p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Try a different name or ID number</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                <span className="w-9"/>
                <span>Patient</span>
                <span className="text-right">Branch</span>
                <span className="text-right">Scope</span>
                <span className="text-right">Record Status</span>
              </div>

              <ul ref={listRef} className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {filtered.map((p, idx) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/patient/${p.id}`)}
                      className={`w-full grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 text-left transition-colors
                        ${focusedIdx === idx
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}`}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials(p)}
                      </div>

                      {/* Name + meta */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white truncate">{fullName(p)}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {p.identifier && (
                            <span className="text-xs font-mono text-secondary-500 dark:text-neutral-400">{p.identifier}</span>
                          )}
                          {p.profile_type && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              p.profile_type === 'Student'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>{p.profile_type}</span>
                          )}
                          <span className="text-xs text-secondary-400 dark:text-neutral-500 truncate">{profileLabel(p)}</span>
                        </div>
                      </div>

                      {/* Branch */}
                      <div className="text-xs text-secondary-500 dark:text-neutral-400 text-right whitespace-nowrap">
                        {p.branch || '—'}
                      </div>

                      {/* Scope */}
                      <div className="text-right">
                        <ScopeBadge scope={p.latest_scope} />
                      </div>

                      {/* Status */}
                      <div className="text-right">
                        {p.latest_status ? (
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={p.latest_status} />
                            {p.latest_updated_at && (
                              <span className="text-xs text-secondary-400 dark:text-neutral-500">{dateLabel(p.latest_updated_at)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-secondary-400 dark:text-neutral-500">No record</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Empty state before any search */}
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
};

export default SearchPatient;
