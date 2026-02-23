import React, { useState, useEffect, useCallback } from 'react';
import {
  searchByStatus,
  getPatientRecords,
  listAllSchedulers,
  listAllRequirements,
  respondToAppointment,
  recordAttendance,
  createScheduler,
  updateScheduler,
  deleteScheduler,
  updateRequirement,
  deleteRequirement,
  setCustomDates,
  unsetCustomDates,
  addWhitelist,
  removeWhitelist,
  STATUS,
  ALL_STATUSES,
  ALL_LOCATIONS,
} from './staff-appointment-service';

// ── UI Helpers ────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const statusColor = (status) => {
  const map = {
    [STATUS.PENDING]: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    [STATUS.SCHEDULED]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    [STATUS.COMPLETED]: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    [STATUS.REJECTED]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.CANCELLED_PATIENT]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.CANCELLED_MEDICAL]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.NO_SHOW]: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    [STATUS.EXPIRED]: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300',
  };
  return map[status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Main Component ────────────────────────────────────────────────────────────

const StaffAppointment = () => {
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'config'
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Appointment Management</h1>
        <p className="text-neutral-600 dark:text-neutral-400">View, approve, and manage student appointment requests</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700 font-bold ml-4">&times;</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex space-x-1 mb-6 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'appointments' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
        >
          Appointments
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
        >
          Scheduler Config
        </button>
      </div>

      {activeTab === 'appointments' && <AppointmentsTab setError={setError} setSuccessMsg={setSuccessMsg} />}
      {activeTab === 'config' && <SchedulerConfigTab setError={setError} setSuccessMsg={setSuccessMsg} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  APPOINTMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

const AppointmentsTab = ({ setError, setSuccessMsg }) => {
  const [selectedStatus, setSelectedStatus] = useState(STATUS.PENDING);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null); // { userId }
  const [rejectNotes, setRejectNotes] = useState('');

  // History drawer
  const [historyDrawer, setHistoryDrawer] = useState(null); // { userId, records }
  const [historyLoading, setHistoryLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(null); // appointment id being acted on

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchByStatus(selectedStatus, page * PAGE_SIZE, PAGE_SIZE);
      setAppointments(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, page, setError]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // ── Actions ──

  const handleApprove = async (appt) => {
    setActionLoading(appt.id);
    try {
      await respondToAppointment(appt.patientId, STATUS.SCHEDULED);
      setSuccessMsg('Appointment approved.');
      fetchAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.userId);
    try {
      await respondToAppointment(rejectModal.userId, STATUS.REJECTED, rejectNotes || undefined);
      setSuccessMsg('Appointment rejected.');
      setRejectModal(null);
      setRejectNotes('');
      fetchAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkArrived = async (appt) => {
    setActionLoading(appt.id);
    try {
      await recordAttendance(appt.id, new Date().toISOString());
      setSuccessMsg('Attendance recorded.');
      fetchAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewHistory = async (appt) => {
    setHistoryLoading(true);
    try {
      const records = await getPatientRecords(appt.patientId);
      setHistoryDrawer({ userId: appt.patientId, records });
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setSelectedStatus(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${selectedStatus === s ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Appointments table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ml-3 text-neutral-500">Loading appointments...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">No appointments with status "{selectedStatus}"</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Patient ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Session</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Notes</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Created</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white font-mono">{appt.patientId?.slice(0, 8)}...</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{appt.session}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(appt.status)}`}>{appt.status}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-500 dark:text-neutral-400 max-w-[200px] truncate">{appt.notes || '—'}</td>
                    <td className="py-3 px-4 text-sm text-neutral-500 dark:text-neutral-400">{appt.created_at ? new Date(appt.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {appt.status === STATUS.PENDING && (
                          <>
                            <button
                              disabled={actionLoading === appt.id}
                              onClick={() => handleApprove(appt)}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 text-xs font-medium disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                            <button
                              onClick={() => setRejectModal({ userId: appt.patientId })}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 text-xs font-medium"
                            >
                              Reject
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                          </>
                        )}
                        {appt.status === STATUS.SCHEDULED && (
                          <>
                            <button
                              disabled={actionLoading === appt.id}
                              onClick={() => handleMarkArrived(appt)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                            >
                              Mark Arrived
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                          </>
                        )}
                        <button
                          onClick={() => handleViewHistory(appt)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 text-xs font-medium"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {appointments.length > 0 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="text-sm text-primary-600 disabled:text-neutral-400 disabled:cursor-not-allowed">
              &larr; Previous
            </button>
            <span className="text-xs text-neutral-500">Page {page + 1}</span>
            <button disabled={appointments.length < PAGE_SIZE} onClick={() => setPage(page + 1)} className="text-sm text-primary-600 disabled:text-neutral-400 disabled:cursor-not-allowed">
              Next &rarr;
            </button>
          </div>
        )}
      </div>

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Reject Appointment</h3>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Add a reason for rejection (optional)"
              rows={3}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => { setRejectModal(null); setRejectNotes(''); }} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900">
                Cancel
              </button>
              <button onClick={handleRejectSubmit} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Drawer ────────────────────────────────────────────────── */}
      {historyDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setHistoryDrawer(null)}>
          <div
            className="bg-white dark:bg-neutral-900 w-full max-w-lg h-full overflow-y-auto shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Patient History
              </h3>
              <button onClick={() => setHistoryDrawer(null)} className="text-neutral-400 hover:text-neutral-600 text-xl">&times;</button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 font-mono">Patient: {historyDrawer.userId}</p>

            {historyDrawer.records.length === 0 ? (
              <p className="text-neutral-500">No records found.</p>
            ) : (
              <div className="space-y-4">
                {historyDrawer.records.map((rec) => (
                  <div key={rec.id} className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(rec.status)}`}>{rec.status}</span>
                      <span className="text-xs text-neutral-400">{rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">Session: {rec.session}</p>
                    {rec.notes && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Notes: {rec.notes}</p>}
                    {rec.arrived_at && <p className="text-xs text-neutral-400 mt-1">Arrived: {new Date(rec.arrived_at).toLocaleString()}</p>}
                    {rec.requirements?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-neutral-500 mb-1">Requirements:</p>
                        <ul className="space-y-1">
                          {rec.requirements.map((r) => (
                            <li key={r.id} className="text-xs text-neutral-600 dark:text-neutral-400">
                              {r.filename || 'N/A'} <span className="text-neutral-400">({r.scheduleRequirementId?.slice(0, 8)}...)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULER CONFIG TAB
// ══════════════════════════════════════════════════════════════════════════════

const SchedulerConfigTab = ({ setError, setSuccessMsg }) => {
  const [subTab, setSubTab] = useState('schedulers'); // 'schedulers' | 'requirements' | 'dates' | 'whitelist'

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex space-x-1 mb-6">
        {[
          { key: 'schedulers', label: 'Schedulers' },
          { key: 'requirements', label: 'Requirements' },
          { key: 'dates', label: 'Custom Dates' },
          { key: 'whitelist', label: 'Whitelist' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${subTab === t.key ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'schedulers' && <SchedulersPanel setError={setError} setSuccessMsg={setSuccessMsg} />}
      {subTab === 'requirements' && <RequirementsPanel setError={setError} setSuccessMsg={setSuccessMsg} />}
      {subTab === 'dates' && <CustomDatesPanel setError={setError} setSuccessMsg={setSuccessMsg} />}
      {subTab === 'whitelist' && <WhitelistPanel setError={setError} setSuccessMsg={setSuccessMsg} />}
    </>
  );
};

// ── Schedulers Panel ──────────────────────────────────────────────────────────

const SchedulersPanel = ({ setError, setSuccessMsg }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    label: '', location: ALL_LOCATIONS[0], schedulePerWeek: [], morningAllowed: 60, afternoonAllowed: 60, notes: '', slotCustomDates: [], whiteLists: [], whiteListOnly: false,
  });

  const fetchSchedulers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllSchedulers();
      setSchedulers(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => { fetchSchedulers(); }, [fetchSchedulers]);

  const handleCreate = async () => {
    try {
      await createScheduler({
        ...form,
        slotCustomDates: form.slotCustomDates || [],
        whiteLists: form.whiteLists || [],
      });
      setSuccessMsg('Scheduler created.');
      setShowCreate(false);
      setForm({ label: '', location: ALL_LOCATIONS[0], schedulePerWeek: [], morningAllowed: 60, afternoonAllowed: 60, notes: '', slotCustomDates: [], whiteLists: [], whiteListOnly: false });
      fetchSchedulers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduler? This cannot be undone.')) return;
    try {
      await deleteScheduler(id);
      setSuccessMsg('Scheduler deleted.');
      fetchSchedulers();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      schedulePerWeek: prev.schedulePerWeek.includes(day) ? prev.schedulePerWeek.filter((d) => d !== day) : [...prev.schedulePerWeek, day],
    }));
  };

  if (loading) return <div className="flex items-center space-x-2 py-8"><Spinner /><span className="text-neutral-500">Loading schedulers...</span></div>;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Schedulers</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
          {showCreate ? 'Cancel' : '+ New Scheduler'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 border border-primary-200 dark:border-primary-800 rounded-lg bg-primary-50/50 dark:bg-primary-900/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Label *</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Location *</label>
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm">
                {ALL_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Morning Slots</label>
              <input type="number" min={0} value={form.morningAllowed} onChange={(e) => setForm({ ...form, morningAllowed: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Afternoon Slots</label>
              <input type="number" min={0} value={form.afternoonAllowed} onChange={(e) => setForm({ ...form, afternoonAllowed: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Schedule Days *</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.schedulePerWeek.includes(day) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-600'}`}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <input type="checkbox" id="whiteListOnly" checked={form.whiteListOnly} onChange={(e) => setForm({ ...form, whiteListOnly: e.target.checked })} className="rounded" />
            <label htmlFor="whiteListOnly" className="text-sm text-neutral-700 dark:text-neutral-300">Whitelist Only</label>
          </div>
          <button onClick={handleCreate} disabled={!form.label || form.schedulePerWeek.length === 0} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            Create Scheduler
          </button>
        </div>
      )}

      {/* Schedulers table */}
      {schedulers.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400">No schedulers configured yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Label</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Location</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Days</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">AM / PM Slots</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Active</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedulers.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-3 px-3 text-sm text-neutral-900 dark:text-white font-medium">{s.label}</td>
                  <td className="py-3 px-3 text-sm text-neutral-600 dark:text-neutral-400">{s.location}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {s.schedulePerWeek?.map((d) => (
                        <span key={d} className="px-1.5 py-0.5 text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded">{d.slice(0, 3)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-neutral-600 dark:text-neutral-400">{s.morningAllowed} / {s.afternoonAllowed}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>
                      {s.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 text-xs font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Requirements Panel ────────────────────────────────────────────────────────

const RequirementsPanel = ({ setError, setSuccessMsg }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ label: '', notes: '', isDigital: false, isActive: true });

  useEffect(() => {
    (async () => {
      try {
        const list = await listAllSchedulers();
        setSchedulers(list);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [setError]);

  const fetchReqs = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const reqs = await listAllRequirements(selectedId);
      setRequirements(reqs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId, setError]);

  useEffect(() => { fetchReqs(); }, [fetchReqs]);

  const handleAdd = async () => {
    if (!form.label) return;
    try {
      await updateRequirement(selectedId, form);
      setSuccessMsg('Requirement saved.');
      setForm({ label: '', notes: '', isDigital: false, isActive: true });
      fetchReqs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteReq = async (label) => {
    if (!window.confirm(`Delete requirement "${label}"?`)) return;
    try {
      await deleteRequirement(selectedId, label);
      setSuccessMsg('Requirement deleted.');
      fetchReqs();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Requirements</h3>

      {/* Scheduler selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Select Scheduler</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full max-w-sm px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm">
          <option value="">-- Select --</option>
          {schedulers.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.location})</option>)}
        </select>
      </div>

      {selectedId && (
        <>
          {/* Add form */}
          <div className="mb-6 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Add / Update Requirement</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Label *" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
              <input type="text" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
            </div>
            <div className="flex items-center space-x-4 mb-3">
              <label className="flex items-center space-x-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={form.isDigital} onChange={(e) => setForm({ ...form, isDigital: e.target.checked })} className="rounded" />
                <span>Digital</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <span>Active</span>
              </label>
            </div>
            <button onClick={handleAdd} disabled={!form.label} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              Save Requirement
            </button>
          </div>

          {/* Requirements list */}
          {loading ? (
            <div className="flex items-center space-x-2"><Spinner /><span className="text-neutral-500 text-sm">Loading...</span></div>
          ) : requirements.length === 0 ? (
            <p className="text-neutral-500 text-sm">No requirements for this scheduler.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 uppercase">Label</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 uppercase">Notes</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 uppercase">Digital</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 uppercase">Active</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 px-3 text-sm text-neutral-900 dark:text-white">{r.label}</td>
                      <td className="py-2 px-3 text-sm text-neutral-500 dark:text-neutral-400">{r.notes || '—'}</td>
                      <td className="py-2 px-3 text-sm">{r.isDigital ? 'Yes' : 'No'}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>{r.isActive ? 'Yes' : 'No'}</span>
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => handleDeleteReq(r.label)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Custom Dates Panel ────────────────────────────────────────────────────────

const CustomDatesPanel = ({ setError, setSuccessMsg }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await listAllSchedulers();
        setSchedulers(list);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [setError]);

  const handleAdd = async () => {
    if (!newDate || !selectedId) return;
    try {
      await setCustomDates(selectedId, [newDate]);
      setSuccessMsg(`Custom date ${newDate} added.`);
      setNewDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async () => {
    if (!newDate || !selectedId) return;
    try {
      await unsetCustomDates(selectedId, [newDate]);
      setSuccessMsg(`Custom date ${newDate} removed.`);
      setNewDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Custom Dates</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Select Scheduler</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full max-w-sm px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm">
          <option value="">-- Select --</option>
          {schedulers.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.location})</option>)}
        </select>
      </div>

      {selectedId && (
        <div className="flex items-end space-x-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Date</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm" />
          </div>
          <button onClick={handleAdd} disabled={!newDate} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Add Date
          </button>
          <button onClick={handleRemove} disabled={!newDate} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Remove Date
          </button>
        </div>
      )}
    </div>
  );
};

// ── Whitelist Panel ───────────────────────────────────────────────────────────

const WhitelistPanel = ({ setError, setSuccessMsg }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [patientIdInput, setPatientIdInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await listAllSchedulers();
        // Only show whitelist-only schedulers
        setSchedulers(list.filter((s) => s.whiteListOnly));
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [setError]);

  const handleAdd = async () => {
    if (!patientIdInput || !selectedId) return;
    const ids = patientIdInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await addWhitelist(selectedId, ids);
      setSuccessMsg(`${ids.length} patient(s) added to whitelist.`);
      setPatientIdInput('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async () => {
    if (!patientIdInput || !selectedId) return;
    const ids = patientIdInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await removeWhitelist(selectedId, ids);
      setSuccessMsg(`${ids.length} patient(s) removed from whitelist.`);
      setPatientIdInput('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Whitelist Management</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Select Scheduler (Whitelist-Only)</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full max-w-sm px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm">
          <option value="">-- Select --</option>
          {schedulers.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.location})</option>)}
        </select>
        {schedulers.length === 0 && <p className="text-xs text-neutral-400 mt-1">No whitelist-only schedulers found.</p>}
      </div>

      {selectedId && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Patient IDs (comma-separated)</label>
          <input type="text" value={patientIdInput} onChange={(e) => setPatientIdInput(e.target.value)} placeholder="uuid1, uuid2, ..." className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm mb-3" />
          <div className="flex space-x-3">
            <button onClick={handleAdd} disabled={!patientIdInput} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              Add to Whitelist
            </button>
            <button onClick={handleRemove} disabled={!patientIdInput} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              Remove from Whitelist
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAppointment;
