import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnnouncementCarousel } from '../anouncement';
import { sendGraphQLRequest } from '../../utils/graphql-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (raw) => {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
};

const fmtDay = (raw) => {
  if (!raw) return '—';
  try { return new Date(raw).getDate(); } catch { return '—'; }
};

const fmtMonth = (raw) => {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  } catch { return ''; }
};

// Status pill helpers
const STATUS_META = {
  // Appointment
  Pending:            { label: 'Pending',             cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  Scheduled:          { label: 'Scheduled',           cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  InProgress:         { label: 'In Progress',         cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  Rejected:           { label: 'Rejected',            cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  Completed:          { label: 'Completed',           cls: 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30' },
  CancelledByPatient: { label: 'Cancelled',           cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  CancelledByMedical: { label: 'Cancelled',           cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  Expired:            { label: 'Expired',             cls: 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30' },
  // Medicine / Record
  Approved:           { label: 'Approved',            cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  Revision:           { label: 'Revision',            cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
  RevisionSubmitted:  { label: 'Rev. Submitted',      cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  PendingVerification:{ label: 'Pending Verif.',      cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  Cancelled:          { label: 'Cancelled',           cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  // Health chat
  Open:               { label: 'Open',                cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  Ongoing:            { label: 'Ongoing',             cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  Closed:             { label: 'Closed',              cls: 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30' },
};

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] ?? { label: status, cls: 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

// Type dot colors
const TYPE_DOT = {
  Appointment:     'bg-primary-500',
  'Medicine Req.': 'bg-emerald-500',
  'Record Update': 'bg-orange-400',
  'Health Chat':   'bg-violet-500',
};

// ─── Data fetching ────────────────────────────────────────────────────────────

const fetchDashboardData = async () => {
  const [appointmentRes, medicineRes, recordRes, chatRes] = await Promise.allSettled([
    sendGraphQLRequest(
      `query { getAppointmentStatus { id status session purpose schedulerLabel scheduledDate created_at } }`,
      {},
      { endpoint: '/appointment/patient' }
    ),
    sendGraphQLRequest(
      `query { getMedicineStatus { id status purpose created_at } }`,
      {},
      { endpoint: '/medical-inventory/medicine-request/patient' }
    ),
    sendGraphQLRequest(
      `query GetCurrentUpdateTicket { getUpdateTicket { id status scope notes created_at } }`,
      {}
    ),
    sendGraphQLRequest(
      `query GetMyTickets($offset: Int, $limit: Int) { getMyTickets(offset: $offset, limit: $limit) { chats { id status purpose session_start } total } }`,
      { offset: 0, limit: 50 },
      { endpoint: '/healthchat/patient' }
    ),
  ]);

  return {
    appointment:     appointmentRes.status  === 'fulfilled' ? (appointmentRes.value?.getAppointmentStatus ?? null)      : null,
    medicineReqs:    medicineRes.status     === 'fulfilled' ? (medicineRes.value?.getMedicineStatus ?? [])              : [],
    updateTicket:    recordRes.status       === 'fulfilled' ? (recordRes.value?.getUpdateTicket ?? null)               : null,
    chatData:        chatRes.status         === 'fulfilled' ? (chatRes.value?.getMyTickets ?? { chats: [], total: 0 }) : { chats: [], total: 0 },
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonLine = ({ w = 'w-full', h = 'h-4' }) => (
  <div className={`${w} ${h} rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse`} />
);

const STAT_META = {
  Pending:       { color: 'text-amber-500'   },
  Appointments:  { color: 'text-blue-500'    },
  'Med Requests':{ color: 'text-emerald-500' },
  'Health Chats':{ color: 'text-violet-500'  },
};

const StatItem = ({ label, value, loading }) => {
  const meta = STAT_META[label] ?? { color: 'text-neutral-500' };
  return (
    <div className="flex flex-col items-center justify-center px-3 py-4 min-w-0">
      {loading
        ? <SkeletonLine w="w-8" h="h-6" />
        : <span className={`block text-2xl font-extrabold tabular-nums leading-none ${meta.color}`}>{value}</span>
      }
      <span className="block mt-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{label}</span>
    </div>
  );
};

const RequestRow = ({ type, title, date, status, onView, onCancel, canCancel }) => (
  <div className="flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group">
    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${TYPE_DOT[type] ?? 'bg-neutral-400'}`} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">{type}</span>
        <StatusPill status={status} />
      </div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mt-0.5 truncate">{title}</p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{date}</p>
    </div>
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={onView}
        className="px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 hover:bg-primary-500/10 rounded-md transition-colors"
      >
        View
      </button>
      {canCancel && (
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  </div>
);

const AppointmentEntry = ({ appointment }) => {
  const dateRaw = appointment.scheduledDate || appointment.created_at;
  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
      {/* date block */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary-500/15 border border-primary-500/30">
        <span className="text-lg font-bold text-primary-600 dark:text-primary-400 leading-none">{fmtDay(dateRaw)}</span>
        <span className="text-[9px] font-bold text-primary-600/70 dark:text-primary-500/70 uppercase tracking-wider leading-none mt-0.5">{fmtMonth(dateRaw)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {appointment.schedulerLabel || appointment.purpose || 'Medical Appointment'}
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 capitalize">
          {appointment.session ? `${appointment.session} session` : '—'} · <StatusPill status={appointment.status} />
        </p>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const REQUEST_TABS = [
  { key: 'all',        label: 'All'            },
  { key: 'Appointment',  label: 'Appointments'   },
  { key: 'Medicine Req.', label: 'Med Requests'  },
  { key: 'Record Update', label: 'Record Update' },
];

const DashboardHome = ({ firstName }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestTab, setRequestTab] = useState('all');

  useEffect(() => {
    let mounted = true;
    fetchDashboardData()
      .then((result) => { if (mounted) { setData(result); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const appointment   = data?.appointment ?? null;
  const medicineReqs  = data?.medicineReqs ?? [];
  const updateTicket  = data?.updateTicket ?? null;
  const chatTotal     = data?.chatData?.total ?? 0;
  const chatChats     = data?.chatData?.chats ?? [];

  const ACTIVE_APPT_STATUSES   = new Set(['Pending', 'Scheduled', 'InProgress']);
  const ACTIVE_MED_STATUSES    = new Set(['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']);
  const ACTIVE_RECORD_STATUSES = new Set(['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']);

  const isActiveAppt = appointment && ACTIVE_APPT_STATUSES.has(appointment.status);

  // counts for stats bar
  const pendingCount = (isActiveAppt ? 1 : 0)
    + medicineReqs.filter(r => ACTIVE_MED_STATUSES.has(r.status)).length
    + (updateTicket && ACTIVE_RECORD_STATUSES.has(updateTicket.status) ? 1 : 0);

  const upcomingCount = appointment && appointment.status === 'Scheduled' ? 1 : 0;
  const medCount      = medicineReqs.length;
  const chatCount     = chatTotal;

  // pending requests list
  const pendingList = [];
  if (appointment) {
    pendingList.push({
      key: 'appt',
      type: 'Appointment',
      title: appointment.schedulerLabel || appointment.purpose || 'Medical Appointment',
      date: fmtDate(appointment.scheduledDate || appointment.created_at),
      status: appointment.status,
      canCancel: ['Pending'].includes(appointment.status),
      onView: () => navigate('/appointments'),
      onCancel: () => navigate('/appointments'),
    });
  }
  medicineReqs.slice(0, 3).forEach((r) => {
    pendingList.push({
      key: `med-${r.id}`,
      type: 'Medicine Req.',
      title: r.purpose || 'Medicine Request',
      date: fmtDate(r.created_at),
      status: r.status,
      canCancel: false,
      onView: () => navigate('/medicine-request'),
      onCancel: null,
    });
  });
  if (updateTicket) {
    pendingList.push({
      key: 'record',
      type: 'Record Update',
      title: `Record Update (${updateTicket.scope ?? 'Both'})`,
      date: fmtDate(updateTicket.created_at),
      status: updateTicket.status === 'Pending' ? 'PendingVerification' : updateTicket.status,
      canCancel: false,
      onView: () => navigate('/record-update'),
      onCancel: null,
    });
  }

  // upcoming appointments (only scheduled)
  const upcomingAppts = appointment && appointment.status === 'Scheduled' ? [appointment] : [];

  // active health chats (open/ongoing)
  const activeChats = chatChats.filter(c => c.status === 'Open' || c.status === 'Ongoing').slice(0, 3);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-5">

      {/* ── Header banner ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* greeting row */}
        <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-1">{today}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white leading-tight">
              {firstName ? <>Hey, <span className="text-primary-500 dark:text-primary-400">{firstName}</span>!</> : 'Welcome back.'}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Here's a snapshot of your health activity.</p>
          </div>
        </div>

        {/* stats strip */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-neutral-200 dark:divide-neutral-800">
          <StatItem label="Pending"       value={loading ? '—' : pendingCount}  loading={loading} />
          <StatItem label="Appointments"  value={loading ? '—' : upcomingCount} loading={loading} />
          <StatItem label="Med Requests"  value={loading ? '—' : medCount}      loading={loading} />
          <StatItem label="Health Chats"  value={loading ? '—' : chatCount}     loading={loading} />
        </div>
      </div>

      {/* ── Main two-column grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column (span 2) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Announcements */}
          <AnnouncementCarousel />

          {/* Activity — pending requests */}
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            {/* header */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Recent Requests</h2>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {loading ? '…' : (() => {
                  const filtered = requestTab === 'all' ? pendingList : pendingList.filter(r => r.type === requestTab);
                  return `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
                })()}
              </span>
            </div>

            {/* subtabs — 2-col on small screens, 4-col on larger ones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-neutral-200 dark:border-neutral-800">
              {REQUEST_TABS.map(tab => {
                const count = tab.key === 'all'
                  ? pendingList.length
                  : pendingList.filter(r => r.type === tab.key).length;
                const active = requestTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setRequestTab(tab.key)}
                    className={`relative flex items-center justify-center gap-1 py-2.5 px-1 w-full text-xs font-semibold truncate transition-colors ${
                      active
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                    {!loading && count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                        active
                          ? 'bg-primary-500 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}>{count}</span>
                    )}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* list */}
            <div className="px-2 py-2">
              {loading ? (
                <div className="space-y-3 px-3 py-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <SkeletonLine w="w-24" h="h-3" />
                        <SkeletonLine w="w-48" h="h-4" />
                        <SkeletonLine w="w-20" h="h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                const filtered = requestTab === 'all' ? pendingList : pendingList.filter(r => r.type === requestTab);
                return filtered.length === 0 ? (
                  <p className="text-center text-neutral-400 dark:text-neutral-500 text-sm py-8">
                    {requestTab === 'all' ? 'No recent requests' : `No ${REQUEST_TABS.find(t => t.key === requestTab)?.label ?? requestTab}`}
                  </p>
                ) : (
                  filtered.map(({ key, ...item }) => <RequestRow key={key} {...item} />)
                );
              })()}
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Upcoming Appointments</h2>
              <Link to="/appointments" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="px-2 py-2">
              {loading ? (
                <div className="flex items-center gap-4 px-3 py-3">
                  <div className="w-12 h-12 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine w="w-40" h="h-4" />
                    <SkeletonLine w="w-24" h="h-3" />
                  </div>
                </div>
              ) : upcomingAppts.length === 0 ? (
                <p className="text-center text-neutral-400 dark:text-neutral-500 text-sm py-8">No scheduled appointments</p>
              ) : (
                upcomingAppts.map(appt => (
                  <AppointmentEntry key={appt.id} appointment={appt} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column (span 1) */}
        <div className="space-y-5">

          {/* Quick actions */}
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Quick Actions</h2>
            </div>
            <nav className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {[
                { to: '/record-update',    label: 'Update My Records',    sub: 'Medical & dental info',  dot: 'bg-primary-500' },
                { to: '/appointments',     label: 'Book Appointment',      sub: 'Schedule a visit',       dot: 'bg-emerald-500' },
                { to: '/medicine-request', label: 'Request Medicine',      sub: 'Submit a new request',   dot: 'bg-amber-400' },
                { to: '/health-chat',      label: 'Health Chat',           sub: 'Talk to medical staff',  dot: 'bg-violet-500' },
                { to: '/my-documents',     label: 'My Documents',          sub: 'View uploaded files',    dot: 'bg-sky-500' },
              ].map(({ to, label, sub, dot }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dot} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{label}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{sub}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-500 dark:group-hover:text-neutral-400 transition-colors ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </nav>
          </div>

          {/* Active health chats */}
          {(loading || activeChats.length > 0) && (
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Active Chats</h2>
                <Link to="/health-chat" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors">
                  Open →
                </Link>
              </div>
              <div className="px-2 py-2">
                {loading ? (
                  <div className="space-y-3 px-3 py-2">
                    {[1, 2].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                          <SkeletonLine w="w-32" h="h-3.5" />
                          <SkeletonLine w="w-20" h="h-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  activeChats.map(chat => (
                    <div key={chat.id} className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-violet-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{chat.purpose || 'Health Chat'}</p>
                        <div className="mt-0.5"><StatusPill status={chat.status} /></div>
                      </div>
                      <Link to="/health-chat" className="flex-shrink-0 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-semibold">
                        Open
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
