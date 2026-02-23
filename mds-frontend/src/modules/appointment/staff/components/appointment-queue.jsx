import React, { useState, useMemo } from 'react';

/* ── data ──────────────────────────────────────────────────── */
// TODO: Replace with real API call via staff-appointment-service.js → searchByStatus()
const TODAY = new Date().toISOString().slice(0, 10);

const MOCK_APPOINTMENTS = []; // No records yet — wire to API

const SERVICE_TYPES = ['All Services', 'Medical Clearance', 'OJT', 'NSTP', 'Screening', 'Oral Exam', 'Dental'];

const STATUS_STYLES = {
  Pending:             'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Scheduled:           'bg-accent-100  dark:bg-accent-900/30  text-accent-700  dark:text-accent-400',
  Confirmed:           'bg-accent-100  dark:bg-accent-900/30  text-accent-700  dark:text-accent-400',
  'Auto-Confirmed':    'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Completed:           'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Cancelled:           'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  NoShow:              'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  CancelledByPatient:  'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
};

const ACTIVE_STATUSES = ['Pending', 'Scheduled', 'Confirmed', 'Auto-Confirmed'];
const DONE_STATUSES   = ['Completed'];
const CANCEL_STATUSES = ['Cancelled', 'CancelledByPatient'];

/* ── tab definitions ───────────────────────────────────────── */
const TABS = [
  { key: 'scheduled',  label: 'Scheduled',  icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'today',      label: 'Today',      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'upcoming',   label: 'Upcoming',   icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { key: 'completed',  label: 'Completed',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'noshow',     label: 'No Show',    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  { key: 'cancelled',  label: 'Cancelled',  icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

/* ── component ─────────────────────────────────────────────── */
const AppointmentQueue = ({ onViewDetails }) => {
  const [activeTab,   setActiveTab]   = useState('scheduled');
  const [search,      setSearch]      = useState('');
  const [serviceType, setServiceType] = useState('All Services');

  /* count per tab (unfiltered) */
  const tabCounts = useMemo(() => ({
    scheduled: MOCK_APPOINTMENTS.filter((a) => a.status === 'Scheduled').length,
    today:     MOCK_APPOINTMENTS.filter((a) => a.scheduledDate === TODAY && ACTIVE_STATUSES.includes(a.status)).length,
    upcoming:  MOCK_APPOINTMENTS.filter((a) => a.scheduledDate > TODAY && ACTIVE_STATUSES.includes(a.status)).length,
    completed: MOCK_APPOINTMENTS.filter((a) => DONE_STATUSES.includes(a.status)).length,
    noshow:    MOCK_APPOINTMENTS.filter((a) => a.status === 'NoShow').length,
    cancelled: MOCK_APPOINTMENTS.filter((a) => CANCEL_STATUSES.includes(a.status)).length,
  }), []);

  /* filtered rows — auto-applied (no button needed) */
  const rows = useMemo(() => {
    return MOCK_APPOINTMENTS.filter((a) => {
      /* tab filter */
      if (activeTab === 'scheduled'  && a.status !== 'Scheduled') return false;
      if (activeTab === 'today'      && (a.scheduledDate !== TODAY || !ACTIVE_STATUSES.includes(a.status))) return false;
      if (activeTab === 'upcoming'   && (a.scheduledDate <= TODAY  || !ACTIVE_STATUSES.includes(a.status))) return false;
      if (activeTab === 'completed'  && !DONE_STATUSES.includes(a.status)) return false;
      if (activeTab === 'noshow'     && a.status !== 'NoShow') return false;
      if (activeTab === 'cancelled'  && !CANCEL_STATUSES.includes(a.status)) return false;
      /* service filter */
      if (serviceType !== 'All Services' && a.appointmentType !== serviceType) return false;
      /* search */
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!a.patientName.toLowerCase().includes(q) && !a.patientId.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeTab, search, serviceType]);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
            <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${
              activeTab === tab.key
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
            }`}>
              {tabCounts[tab.key]}
            </span>
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
            placeholder="Search by name or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        {/* Service Type */}
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-44"
        >
          {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {/* Result count */}
        <span className="text-[11px] text-secondary-400 dark:text-neutral-500 whitespace-nowrap">
          {rows.length} result{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ─── Table ─── */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr className="bg-neutral-50/60 dark:bg-neutral-700/30">
              {['Name', 'Student ID', 'Date', 'Time', 'Service', 'Status'].map((h) => (
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
                <td className="px-4 py-2.5 text-sm font-medium text-secondary-800 dark:text-white whitespace-nowrap">
                  {apt.patientName}
                </td>
                <td className="px-4 py-2.5 text-xs text-secondary-500 dark:text-neutral-400 font-mono">
                  {apt.patientId}
                </td>
                <td className="px-4 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                  {new Date(apt.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                  {apt.timeSlot}
                </td>
                <td className="px-4 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                  {apt.appointmentType}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded ${STATUS_STYLES[apt.status] || 'bg-neutral-100 text-neutral-600'}`}>
                    {apt.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium text-secondary-500 dark:text-neutral-400">No appointments found</p>
                  <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">Try adjusting your filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AppointmentQueue;
