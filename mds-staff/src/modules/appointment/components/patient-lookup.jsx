import React, { useState, useCallback } from 'react';
import { resolvePatientByIdentifier, getPatientStatus, getPatientRecords, respondToAppointment, recordAttendance, STATUS } from '../staff-appointment-service';
import AppointmentDetailModal from './appointment-detail-modal';

const PAGE_SIZE = 10;

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

const PatientLookup = () => {
  const [inputId, setInputId] = useState('');
  const [searchedIdentifier, setSearchedIdentifier] = useState(null); // student/employee ID shown in UI
  const [resolvedUserId, setResolvedUserId] = useState(null);           // internal DB userId
  const [currentStatus, setCurrentStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchRecords = useCallback(async (internalId, pageOffset, append = false) => {
    const data = await getPatientRecords(internalId, pageOffset, PAGE_SIZE);
    if (append) {
      setRecords((prev) => [...prev, ...(data || [])]);
    } else {
      setRecords(data || []);
    }
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    return data;
  }, []);

  const handleSearch = async () => {
    const raw = inputId.trim();
    if (!raw) return;
    const identifierNum = Number(raw);
    if (!Number.isInteger(identifierNum) || identifierNum <= 0) {
      setError('Please enter a valid student or employee ID number.');
      return;
    }
    setError('');
    setLoading(true);
    setSearchedIdentifier(null);
    setResolvedUserId(null);
    setCurrentStatus(null);
    setRecords([]);
    setOffset(0);
    setHasMore(false);
    try {
      const internalId = await resolvePatientByIdentifier(identifierNum);
      if (!internalId) {
        setError('No patient found with that student / employee ID.');
        return;
      }
      const [status] = await Promise.all([
        getPatientStatus(internalId),
        fetchRecords(internalId, 0),
      ]);
      setCurrentStatus(status);
      setSearchedIdentifier(identifierNum);
      setResolvedUserId(internalId);
    } catch (err) {
      setError(err.message || 'Lookup failed. Check the ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshRecords = useCallback(async () => {
    if (!resolvedUserId) return;
    const data = await getPatientRecords(resolvedUserId, 0, PAGE_SIZE);
    setRecords(data || []);
    setOffset(0);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
  }, [resolvedUserId]);

  const handleModalConfirm = async (patientId) => {
    await respondToAppointment(patientId, STATUS.SCHEDULED);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalCancel = async (patientId, reason, cancelStatus) => {
    await respondToAppointment(patientId, cancelStatus || STATUS.REJECTED, reason);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkDone = async (id) => {
    await recordAttendance(id, new Date().toISOString());
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkComplete = async (patientId) => {
    await respondToAppointment(patientId, STATUS.COMPLETED);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkNoShow = async (patientId) => {
    await respondToAppointment(patientId, STATUS.NO_SHOW);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      await fetchRecords(resolvedUserId, nextOffset, true);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Patient Appointment Lookup by Student / Employee ID</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Enter student / employee ID..."
            className="flex-1 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={handleSearch}
            disabled={!inputId.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-error-600 dark:text-error-400">{error}</p>
        )}
      </div>

      {/* Results */}
      {searchedIdentifier && !loading && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Patient summary header */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">Student / Employee ID</p>
              <p className="text-sm font-semibold text-secondary-800 dark:text-white">{searchedIdentifier}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wide mb-0.5">Latest Status</p>
              {currentStatus ? (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${STATUS_COLORS[currentStatus] || 'bg-neutral-100 text-neutral-600'}`}>
                  {currentStatus}
                </span>
              ) : (
                <span className="text-xs text-secondary-400 dark:text-neutral-500">No appointments</span>
              )}
            </div>
          </div>

          {/* Records list */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
            {records.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-400 dark:text-neutral-500">
                No appointment records found for this patient.
              </div>
            ) : (
              records.map((rec, idx) => (
                <button
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors group"
                >
                  {/* Index dot */}
                  <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 text-[10px] font-bold text-secondary-500 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-secondary-800 dark:text-white">Appointment #{rec.id}</span>
                      <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{rec.session} session</span>
                      {rec.created_at && (
                        <span className="text-[10px] text-secondary-400 dark:text-neutral-500">
                          {new Date(rec.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {rec.notes && (
                      <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5 truncate">{rec.notes}</p>
                    )}
                    {rec.requirements?.length > 0 && (
                      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-0.5">
                        {rec.requirements.length} requirement{rec.requirements.length !== 1 ? 's' : ''} submitted
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${STATUS_COLORS[rec.status] || 'bg-neutral-100 text-neutral-600'}`}>
                      {rec.status}
                    </span>
                    <svg className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Load more */}
          {hasMore && resolvedUserId && (
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail modal for a clicked record */}
      {selectedRecord && (
        <AppointmentDetailModal
          appointment={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          onMarkDone={handleModalMarkDone}
          onMarkComplete={handleModalMarkComplete}
          onMarkNoShow={handleModalMarkNoShow}
        />
      )}
    </div>
  );
};

export default PatientLookup;
