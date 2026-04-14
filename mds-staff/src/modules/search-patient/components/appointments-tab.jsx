import React, { useState, useEffect, useCallback } from 'react';
import {
  getPatientStatus,
  getPatientRecords,
  respondToAppointment,
  recordAttendance,
  STATUS,
} from '../../appointment/staff-appointment-service';
import AppointmentDetailModal from '../../appointment/components/appointment-detail-modal';
import PatientSectionCard from './section-card';

const PAGE_SIZE = 20;

const STATUS_COLORS = {
  Pending:            'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Scheduled:          'bg-accent-100  dark:bg-accent-900/30  text-accent-700  dark:text-accent-400',
  InProgress:         'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Completed:          'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Rejected:           'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  CancelledByPatient: 'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  CancelledByMedical: 'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  NoShow:             'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Expired:            'bg-neutral-100 dark:bg-neutral-700     text-neutral-500 dark:text-neutral-400',
};

const ONGOING_STATUSES  = new Set(['InProgress']);
const UPCOMING_STATUSES = new Set(['Pending', 'Scheduled']);

function RecordRow({ rec, index, onClick }) {
  return (
    <button
      onClick={() => onClick(rec)}
      className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors group"
    >
      <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 text-xs font-bold text-secondary-500 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-secondary-800 dark:text-white">
            Appointment #{rec.id}
          </span>
          {rec.session && (
            <span className="text-xs text-secondary-400 dark:text-neutral-500">{rec.session} session</span>
          )}
          {rec.created_at && (
            <span className="text-xs text-secondary-400 dark:text-neutral-500">
              {new Date(rec.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {rec.notes && (
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 truncate">{rec.notes}</p>
        )}
        {rec.requirements?.length > 0 && (
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">
            {rec.requirements.length} requirement{rec.requirements.length !== 1 ? 's' : ''} submitted
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${STATUS_COLORS[rec.status] || 'bg-neutral-100 text-neutral-600'}`}>
          {rec.status}
        </span>
        <svg className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function RecordList({ records, startIndex, onSelect, emptyMessage }) {
  if (records.length === 0) {
    return <p className="text-xs text-secondary-300 dark:text-neutral-600">{emptyMessage}</p>;
  }
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
      {records.map((rec, i) => (
        <RecordRow key={rec.id} rec={rec} index={startIndex + i} onClick={onSelect} />
      ))}
    </div>
  );
}

export default function PatientAppointmentsTab({ patient }) {
  const patientId = patient?.id;
  const patientIdentifier = patient?.identifier ? String(patient.identifier) : null;

  const [records,        setRecords]        = useState([]);
  const [currentStatus,  setCurrentStatus]  = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [error,          setError]          = useState('');
  const [hasMore,        setHasMore]        = useState(false);
  const [offset,         setOffset]         = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchRecords = useCallback(async (id, pageOffset, append = false, identifier = null) => {
    const data = await getPatientRecords(id, pageOffset, PAGE_SIZE, identifier);
    if (append) {
      setRecords((prev) => [...prev, ...(data || [])]);
    } else {
      setRecords(data || []);
    }
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    return data;
  }, []);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setRecords([]);
    setOffset(0);
    Promise.all([
      getPatientStatus(patientIdentifier ? null : patientId, patientIdentifier),
      fetchRecords(patientIdentifier ? null : patientId, 0, false, patientIdentifier),
    ]).then(([status]) => {
      if (!cancelled) setCurrentStatus(status);
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Failed to load appointments.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [patientId, patientIdentifier, fetchRecords]);

  const refreshRecords = useCallback(async () => {
    if (!patientId) return;
    const data = await getPatientRecords(patientIdentifier ? null : patientId, 0, PAGE_SIZE, patientIdentifier);
    setRecords(data || []);
    setOffset(0);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    const status = await getPatientStatus(patientIdentifier ? null : patientId, patientIdentifier);
    setCurrentStatus(status);
  }, [patientId, patientIdentifier]);

  const handleModalConfirm = async (pid, slotId) => {
    await respondToAppointment(pid, STATUS.SCHEDULED, undefined, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalCancel = async (pid, reason, cancelStatus, slotId) => {
    await respondToAppointment(pid, cancelStatus || STATUS.REJECTED, reason, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkDone = async (id) => {
    await recordAttendance(id, new Date().toISOString());
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkComplete = async (pid, slotId) => {
    await respondToAppointment(pid, STATUS.COMPLETED, undefined, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      await fetchRecords(patientIdentifier ? null : patientId, nextOffset, true, patientIdentifier);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const ongoing  = records.filter((r) => ONGOING_STATUSES.has(r.status));
  const upcoming = records.filter((r) => UPCOMING_STATUSES.has(r.status));
  const past     = records.filter((r) => !ONGOING_STATUSES.has(r.status) && !UPCOMING_STATUSES.has(r.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="animate-spin w-7 h-7 rounded-full border-2 border-neutral-200 dark:border-neutral-700 border-t-primary-500 inline-block" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 text-sm text-error-700 dark:text-error-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Latest status strip */}
      {currentStatus && (
        <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <span className="text-xs text-secondary-500 dark:text-neutral-400 uppercase tracking-wide font-medium">Latest Status</span>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${STATUS_COLORS[currentStatus] || 'bg-neutral-100 text-neutral-600'}`}>
            {currentStatus}
          </span>
        </div>
      )}

      {/* Ongoing */}
      <PatientSectionCard
        title="Ongoing"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{ongoing.length} in progress</span>}
      >
        <RecordList
          records={ongoing}
          startIndex={0}
          onSelect={setSelectedRecord}
          emptyMessage="No ongoing appointments."
        />
      </PatientSectionCard>

      {/* Upcoming */}
      <PatientSectionCard
        title="Upcoming Appointments"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{upcoming.length} pending</span>}
      >
        <RecordList
          records={upcoming}
          startIndex={ongoing.length}
          onSelect={setSelectedRecord}
          emptyMessage="No upcoming appointments."
        />
      </PatientSectionCard>

      {/* Past */}
      <PatientSectionCard
        title="Past Appointments"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{past.length} record{past.length !== 1 ? 's' : ''}</span>}
      >
        <RecordList
          records={past}
          startIndex={ongoing.length + upcoming.length}
          onSelect={setSelectedRecord}
          emptyMessage="No past appointments yet."
        />

        {hasMore && (
          <div className="mt-3 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </PatientSectionCard>

      {/* Detail modal */}
      {selectedRecord && (
        <AppointmentDetailModal
          appointment={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          onMarkDone={handleModalMarkDone}
          onMarkComplete={handleModalMarkComplete}
          hideHistory
        />
      )}
    </div>
  );
}