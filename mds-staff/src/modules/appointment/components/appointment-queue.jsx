import React, { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { searchByStatus, getStatusCounts, listAllSchedulers } from '../staff-appointment-service';

/* ── constants ─────────────────────────────────────── */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_STYLES = {
  Pending:             'bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-300',
  Scheduled:           'bg-accent-100  dark:bg-accent-900/40  text-accent-800  dark:text-accent-300',
  InProgress:          'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300',
  Completed:           'bg-success-100 dark:bg-success-900/40 text-success-800 dark:text-success-300',
  Rejected:            'bg-error-100   dark:bg-error-900/40   text-error-800   dark:text-error-300',
  Expired:             'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300',
  NoShow:              'bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-300',
  CancelledByPatient:  'bg-error-100   dark:bg-error-900/40   text-error-800   dark:text-error-300',
  CancelledByMedical:  'bg-error-100   dark:bg-error-900/40   text-error-800   dark:text-error-300',
};

const SESSION_STYLES = {
  Morning:   'bg-accent-100 dark:bg-accent-900/40 text-accent-800 dark:text-accent-300',
  Afternoon: 'bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-300',
};

/* Each tab maps to a backend SCHEDULING_STATUS for searchAppointmentStatuses */
const TABS = [
  { key: 'Pending',            label: 'Pending',     icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'Scheduled',          label: 'Scheduled',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'InProgress',         label: 'In Progress', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { key: 'Completed',          label: 'Completed',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'NoShow',             label: 'No Show',     icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  { key: 'CancelledByPatient', label: 'Patient Cancel', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'CancelledByMedical', label: 'Staff Cancel',  icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'Rejected',           label: 'Rejected',    icon: 'M6 18L18 6M6 6l12 12' },
];

/** Format count for badge display: 99+ if >= 100 */
const formatCount = (count) => {
  if (count >= 100) return '99+';
  return count;
};

/* ── component ─────────────────────────────────────── */
const AppointmentQueue = forwardRef(({ onViewDetails }, ref) => {
  const [activeTab,   setActiveTab]   = useState('Pending');
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [tabCounts,    setTabCounts]    = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Filter state
  const [filterDate,        setFilterDate]        = useState('');
  const [filterSchedulerId, setFilterSchedulerId] = useState('');
  const [schedulers,        setSchedulers]        = useState([]);

  // Pagination state
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  /** Fetch fresh status counts from server */
  const refreshCounts = useCallback(async () => {
    try {
      const counts = await getStatusCounts();
      const updated = {};
      for (const tab of TABS) {
        updated[tab.key] = counts[tab.key] || 0;
      }
      setTabCounts(updated);
    } catch (err) {
      console.error('Failed to load appointment counts:', err);
    }
  }, []);

  /* Fetch appointments (first page or fresh load) */
  const fetchAppointments = useCallback(async (status, date, schedulerId) => {
    setLoading(true);
    setOffset(0);
    try {
      const data = await searchByStatus(status, 0, PAGE_SIZE, { date: date || null, schedulerId: schedulerId || null });
      setAppointments(data || []);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      setAppointments([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  
  /* Expose removeAppointment so the parent can optimistically move an item
     out of the current tab after a status-changing action, and update counts.
     Expose refresh so the parent can trigger a full queue reload (e.g., via socket). */
  useImperativeHandle(ref, () => ({
    removeAppointment: (id, newStatus) => {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      setTabCounts((prev) => {
        const updated = { ...prev };
        // Decrement old status count (current active tab)
        if (updated[activeTab] !== undefined && updated[activeTab] > 0) {
          updated[activeTab] = updated[activeTab] - 1;
        }
        // Increment new status count (always increment, even if was 0/undefined)
        if (newStatus) {
          updated[newStatus] = (updated[newStatus] || 0) + 1;
        }
        return updated;
      });
      // Also re-fetch actual counts from server to stay in sync
      refreshCounts();
    },
    refresh: () => {
      fetchAppointments(activeTab, filterDate, filterSchedulerId);
      refreshCounts();
    },
  }), [activeTab, fetchAppointments, refreshCounts, filterDate, filterSchedulerId]);

  /* Load schedulers once on mount for the filter dropdown */
  useEffect(() => {
    listAllSchedulers().then(setSchedulers).catch(() => {});
  }, []);

  /* Load status counts once on mount */
  useEffect(() => {
    const loadCounts = async () => {
      try {
        setLoadingCounts(true);
        await refreshCounts();
      } finally {
        setLoadingCounts(false);
      }
    };
    loadCounts();
  }, [refreshCounts]);

  /* Fetch appointments whenever the active tab or active filters change */
  useEffect(() => {
    fetchAppointments(activeTab, filterDate, filterSchedulerId);
  }, [activeTab, filterDate, filterSchedulerId, fetchAppointments]);

  /* Load more (pagination) */
  const handleLoadMore = useCallback(async () => {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const data = await searchByStatus(activeTab, nextOffset, PAGE_SIZE, { date: filterDate || null, schedulerId: filterSchedulerId || null });
      setAppointments((prev) => [...prev, ...(data || [])]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      setOffset(nextOffset);
    } catch (err) {
      console.error('Failed to load more appointments:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, offset, filterDate, filterSchedulerId]);

  /* Client-side search filter on patientIdentifier / name / email */
  const rows = useMemo(() => {
    if (!debouncedSearch.trim()) return appointments;
    const q = debouncedSearch.toLowerCase();
    return appointments.filter((a) =>
      String(a.patientIdentifier ?? '').includes(q) ||
      String(a.patientId ?? '').includes(q) ||
      (a.patientName ?? '').toLowerCase().includes(q) ||
      (a.patientEmail ?? '').toLowerCase().includes(q) ||
      (a.id ?? '').toLowerCase().includes(q)
    );
  }, [appointments, debouncedSearch]);

  /* Allow clicking the active tab to refresh data */
  const handleTabChange = (key) => {
    if (key === activeTab) {
      // Same tab clicked — force refresh
      fetchAppointments(key, filterDate, filterSchedulerId);
      refreshCounts();
    } else {
      setActiveTab(key);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
            {loadingCounts ? (
              <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold animate-pulse ${
                activeTab === tab.key
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
              }`}>
                —
              </span>
            ) : (
              tabCounts[tab.key] !== undefined && (
                <span
                  title={filterDate || filterSchedulerId ? 'Global count — filters are active' : undefined}
                  className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold transition-opacity ${filterDate || filterSchedulerId ? 'opacity-40' : ''} ${
                    activeTab === tab.key
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
                  }`}>
                  {formatCount(tabCounts[tab.key])}{filterDate || filterSchedulerId ? '*' : ''}
                </span>
              )
            )}
          </button>
        ))}
      </div>

      {/* ─── Inline Filters ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700/60">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ID, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              title="Clear date filter"
              className="p-1 rounded text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Scheduler filter */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <select
            value={filterSchedulerId}
            onChange={(e) => setFilterSchedulerId(e.target.value)}
            className="pl-8 pr-6 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 appearance-none max-w-[180px]"
          >
            <option value="">All Schedulers</option>
            {schedulers.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Clear filters button — only when any filter active */}
        {(filterDate || filterSchedulerId) && (
          <button
            onClick={() => { setFilterDate(''); setFilterSchedulerId(''); }}
            className="px-2.5 py-1.5 text-xs bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-md text-error-600 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/40 transition-colors whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}

        {/* Result count + refresh */}
        <button
          onClick={() => { fetchAppointments(activeTab, filterDate, filterSchedulerId); refreshCounts(); }}
          className="px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
        >
          Refresh
        </button>
        <span className="text-[11px] text-secondary-400 dark:text-neutral-500 whitespace-nowrap">
          {rows.length} result{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ─── Table ─── */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="px-4 py-12 text-center">
            <div className="animate-spin mx-auto w-6 h-6 rounded-full border-2 border-current/20 border-t-current text-primary-500 mb-2" />
            <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading appointments...</p>
          </div>
        ) : (
          <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-neutral-50/60 dark:bg-neutral-700/30">
                {['Patient', 'Scheduled', 'Session', 'Status', 'Purpose'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-secondary-700 dark:text-neutral-200 uppercase tracking-wider whitespace-nowrap" style={{ width: '20%' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/40">
              {rows.length > 0 ? rows.map((apt) => (
                <tr
                  key={apt.id}
                  onClick={() => onViewDetails?.(apt)}
                  className="hover:bg-primary-50/40 dark:hover:bg-neutral-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5" style={{ width: '20%' }}>
                    <p className="text-sm font-semibold text-secondary-900 dark:text-neutral-100">
                      {apt.patientIdentifier ?? apt.patientId}
                    </p>
                    {apt.patientName && (
                      <p className="text-xs text-secondary-700 dark:text-neutral-300 mt-0.5">{apt.patientName}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ width: '20%' }}>
                    {apt.scheduledDate ? (
                      <div>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-neutral-100">
                          {new Date(apt.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                        </p>
                        {apt.schedulerLabel && (
                          <p className="text-xs text-secondary-700 dark:text-neutral-300 mt-0.5 truncate max-w-[160px]">{apt.schedulerLabel}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-secondary-600 dark:text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ width: '20%' }}>
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded ${SESSION_STYLES[apt.session] || 'bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200'}`}>
                      {apt.session}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ width: '20%' }}>
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded ${STATUS_STYLES[apt.status] || 'bg-neutral-100 text-neutral-700'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-secondary-800 dark:text-neutral-200 truncate" style={{ width: '20%' }}>
                    {apt.purpose ? (
                      <span title={apt.purpose}>{apt.purpose.length > 40 ? apt.purpose.slice(0, 40) + '…' : apt.purpose}</span>
                    ) : '—'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm font-medium text-secondary-500 dark:text-neutral-400">No appointments found</p>
                    <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">
                      {filterDate || filterSchedulerId
                        ? 'Try adjusting or clearing the active filters'
                        : `No ${activeTab} appointments at the moment`}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ─── Load More (Pagination) ─── */}
          {hasMore && (
            <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-700/60 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
});

export default AppointmentQueue;
