import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { searchByStatus } from '../staff-appointment-service';

/* ── constants ─────────────────────────────────────────────── */

const STATUS_STYLES = {
  Pending:             'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Scheduled:           'bg-accent-100  dark:bg-accent-900/30  text-accent-700  dark:text-accent-400',
  InProgress:          'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Completed:           'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Rejected:            'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  Expired:             'bg-neutral-100 dark:bg-neutral-700     text-neutral-500 dark:text-neutral-400',
  NoShow:              'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  CancelledByPatient:  'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  CancelledByMedical:  'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
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

/* ── component ─────────────────────────────────────────────── */
const AppointmentQueue = ({ onViewDetails }) => {
  const [activeTab,   setActiveTab]   = useState('Pending');
  const [search,      setSearch]      = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [tabCounts,    setTabCounts]    = useState({});

  /* Fetch appointments whenever the active tab changes */
  const fetchAppointments = useCallback(async (status) => {
    setLoading(true);
    try {
      const data = await searchByStatus(status, 0, 50);
      setAppointments(data || []);
      setTabCounts((prev) => ({ ...prev, [status]: (data || []).length }));
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(activeTab);
  }, [activeTab, fetchAppointments]);

  /* Client-side search filter on patientId */
  const rows = useMemo(() => {
    if (!search.trim()) return appointments;
    const q = search.toLowerCase();
    return appointments.filter((a) =>
      a.patientId?.toLowerCase().includes(q) || a.id?.toLowerCase().includes(q)
    );
  }, [appointments, search]);

  const handleTabChange = (key) => {
    setActiveTab(key);
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
            {tabCounts[tab.key] !== undefined && (
              <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${
                activeTab === tab.key
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
              }`}>
                {tabCounts[tab.key]}
              </span>
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
            placeholder="Search by patient ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        {/* Result count + refresh */}
        <button
          onClick={() => fetchAppointments(activeTab)}
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
            <svg className="animate-spin mx-auto w-6 h-6 text-primary-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading appointments...</p>
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: 480 }}>
            <thead>
              <tr className="bg-neutral-50/60 dark:bg-neutral-700/30">
                {['Patient ID', 'Session', 'Status', 'Notes', 'Created'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">
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
                  <td className="px-4 py-2.5 text-xs text-secondary-500 dark:text-neutral-400 font-mono">
                    {apt.patientId}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                    {apt.session}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded ${STATUS_STYLES[apt.status] || 'bg-neutral-100 text-neutral-600'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-secondary-500 dark:text-neutral-400 max-w-[200px] truncate">
                    {apt.notes || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                    {apt.created_at ? new Date(apt.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm font-medium text-secondary-500 dark:text-neutral-400">No appointments found</p>
                    <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">No {activeTab} appointments at the moment</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AppointmentQueue;
