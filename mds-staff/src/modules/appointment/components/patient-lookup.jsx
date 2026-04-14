import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getPatientStatus, getPatientRecords, respondToAppointment, recordAttendance, STATUS } from '../staff-appointment-service';
import { searchPatients, formatPatientName, getProfileLabel } from '../../../services/patient-search-service';
import { useStaffProfile } from '../../../hooks/use-staff-profile';
import AppointmentDetailModal from './appointment-detail-modal';

// ── Change this value to adjust the search debounce delay ───────────────────
const LOOKUP_DEBOUNCE_MS = 500;

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
  // ── Search state ─────────────────────────────────────────────
  const { profile } = useStaffProfile();
  const [searchInput, setSearchInput]       = useState('');
  const [searchResults, setSearchResults]   = useState([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [searchFired, setSearchFired]       = useState(false);
  const [searchError, setSearchError]       = useState('');
  const inputRef = useRef(null);

  // ── Selected patient & appointment records state ───────────────────────────
  const [selectedPatient, setSelectedPatient] = useState(null);   // full patient object
  const [resolvedUserId,  setResolvedUserId]  = useState(null);
  const [resolvedPatientIdentifier, setResolvedPatientIdentifier] = useState(null);
  const [currentStatus,   setCurrentStatus]   = useState(null);
  const [records,         setRecords]         = useState([]);
  const [offset,          setOffset]          = useState(0);
  const [hasMore,         setHasMore]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [recordsError,    setRecordsError]    = useState('');
  const [selectedRecord,  setSelectedRecord]  = useState(null);

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchFired(false);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    setIsSearching(true);
    setSearchFired(true);
    setSearchError('');

    const timer = setTimeout(async () => {
      try {
        const data = await searchPatients(trimmed, 15, profile?.branch || null);
        setSearchResults(data);
      } catch (err) {
        setSearchError(err.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, LOOKUP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch appointment records for a resolved userId ────────────────────────
  const fetchRecords = useCallback(async (internalId, pageOffset, append = false, patientIdentifier = null) => {
    const data = await getPatientRecords(internalId, pageOffset, PAGE_SIZE, patientIdentifier);
    if (append) {
      setRecords((prev) => [...prev, ...(data || [])]);
    } else {
      setRecords(data || []);
    }
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    return data;
  }, []);

  // ── Select a patient from search results ──────────────────────────────────
  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setResolvedUserId(null);
    setResolvedPatientIdentifier(null);
    setCurrentStatus(null);
    setRecords([]);
    setOffset(0);
    setHasMore(false);
    setRecordsError('');
    setLoading(true);
    // Clear the picker once a patient is selected
    setSearchResults([]);
    setSearchInput('');
    setSearchFired(false);

    try {
      const internalId = patient?.id !== undefined && patient?.id !== null ? String(patient.id) : null;
      const lookupIdentifier = patient?.identifier ? String(patient.identifier) : null;
      const lookupUserId = internalId;

      if (!lookupUserId && !lookupIdentifier) {
        throw new Error('Unable to identify selected patient.');
      }

      const [status] = await Promise.all([
        getPatientStatus(lookupUserId, lookupIdentifier),
        fetchRecords(lookupUserId, 0, false, lookupIdentifier),
      ]);
      setCurrentStatus(status);
      setResolvedUserId(internalId);
      setResolvedPatientIdentifier(lookupIdentifier);
    } catch (err) {
      setRecordsError(err.message || 'Failed to load appointment records.');
    } finally {
      setLoading(false);
    }
  };

  // ── Clear selected patient, go back to search ─────────────────────────────
  const handleClearPatient = () => {
    setSelectedPatient(null);
    setResolvedUserId(null);
    setResolvedPatientIdentifier(null);
    setCurrentStatus(null);
    setRecords([]);
    setOffset(0);
    setHasMore(false);
    setRecordsError('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const refreshRecords = useCallback(async () => {
    if (!resolvedUserId && !resolvedPatientIdentifier) return;
    const lookupUserId = resolvedUserId || null;
    const data = await getPatientRecords(lookupUserId, 0, PAGE_SIZE, resolvedPatientIdentifier);
    setRecords(data || []);
    setOffset(0);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
  }, [resolvedUserId, resolvedPatientIdentifier]);

  const handleModalConfirm = async (patientId, slotId) => {
    await respondToAppointment(patientId, STATUS.SCHEDULED, undefined, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalCancel = async (patientId, reason, cancelStatus, slotId) => {
    await respondToAppointment(patientId, cancelStatus || STATUS.REJECTED, reason, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkDone = async (id) => {
    await recordAttendance(id, new Date().toISOString());
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleModalMarkComplete = async (patientId, slotId) => {
    await respondToAppointment(patientId, STATUS.COMPLETED, undefined, slotId);
    setSelectedRecord(null);
    await refreshRecords();
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const lookupUserId = resolvedUserId || null;
      await fetchRecords(lookupUserId, nextOffset, true, resolvedPatientIdentifier);
      setOffset(nextOffset);
    } catch (err) {
      setRecordsError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="text-base font-semibold text-secondary-800 dark:text-white mb-3">
          Patient Appointment Lookup
        </h3>

        {selectedPatient ? (
          /* Selected patient chip */
          <div className="flex items-center gap-3 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selectedPatient.first_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-secondary-900 dark:text-white truncate">
                {formatPatientName(selectedPatient)}
              </p>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">
                {selectedPatient.identifier ? `ID: ${selectedPatient.identifier}` : ''}
                {selectedPatient.identifier && selectedPatient.profile_type ? ' · ' : ''}
                {selectedPatient.profile_type || ''}
              </p>
            </div>
            <button
              onClick={handleClearPatient}
              className="p-1 rounded text-secondary-400 hover:text-secondary-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
              title="Search again"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          /* Search input */
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-neutral-200 dark:border-neutral-600 rounded-md bg-neutral-50 dark:bg-neutral-700 focus-within:ring-1 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all">
              {isSearching ? (
                <span className="w-4 h-4 rounded-full border-2 border-neutral-200 dark:border-neutral-600 border-t-primary-500 animate-spin flex-shrink-0 inline-block" />
              ) : (
                <svg className="w-4 h-4 text-secondary-400 dark:text-neutral-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, student/employee ID, or email…"
                autoComplete="off"
                className="flex-1 bg-transparent text-base text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setSearchResults([]); setSearchFired(false); }}
                  className="text-secondary-300 hover:text-secondary-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Hint */}
            {searchInput.trim().length > 0 && searchInput.trim().length < 2 && (
              <p className="mt-1.5 text-sm text-secondary-400 dark:text-neutral-500">
                Type at least 2 characters to search…
              </p>
            )}

            {/* Search error */}
            {searchError && (
              <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">{searchError}</p>
            )}

            {/* Results picker */}
            {searchFired && !isSearching && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-left border-b border-neutral-100 dark:border-neutral-700/60 last:border-b-0"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {patient.first_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-secondary-800 dark:text-white truncate">
                        {formatPatientName(patient)}
                      </p>
                      <p className="text-sm text-secondary-400 dark:text-neutral-500 truncate">
                        {patient.identifier ? `ID: ${patient.identifier}` : 'No ID'}
                        {' · '}
                        {getProfileLabel(patient)}
                      </p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      patient.profile_type === 'Student'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    }`}>
                      {patient.profile_type}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchFired && !isSearching && searchResults.length === 0 && !searchError && searchInput.trim().length >= 2 && (
              <p className="mt-1.5 text-sm text-secondary-400 dark:text-neutral-500">
                No patients found for "{searchInput.trim()}"
              </p>
            )}
          </div>
        )}

        {recordsError && (
          <p className="mt-2 text-sm text-error-600 dark:text-error-400">{recordsError}</p>
        )}
      </div>

      {/* ── Appointment records ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="animate-spin w-8 h-8 rounded-full border-2 border-neutral-200 dark:border-neutral-700 border-t-primary-500 inline-block" />
        </div>
      )}

      {selectedPatient && !loading && (resolvedUserId || resolvedPatientIdentifier) && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Patient summary header */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">Patient</p>
              <p className="text-base font-semibold text-secondary-800 dark:text-white">
                {formatPatientName(selectedPatient)}
                {selectedPatient.identifier ? (
                  <span className="ml-2 font-normal text-secondary-500 dark:text-neutral-400 font-mono">
                    #{selectedPatient.identifier}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-secondary-500 dark:text-neutral-400 uppercase tracking-wide mb-0.5">Latest Status</p>
              {currentStatus ? (
                <span className={`px-2.5 py-1 text-sm font-medium rounded-md ${STATUS_COLORS[currentStatus] || 'bg-neutral-100 text-neutral-600'}`}>
                  {currentStatus}
                </span>
              ) : (
                <span className="text-sm text-secondary-400 dark:text-neutral-500">No appointments</span>
              )}
            </div>
          </div>

          {/* Records list */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
            {records.length === 0 ? (
              <div className="px-4 py-6 text-center text-base text-secondary-400 dark:text-neutral-500">
                No appointment records found for this patient.
              </div>
            ) : (
              records.map((rec, idx) => (
                <button
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors group"
                >
                  <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 text-xs font-bold text-secondary-500 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-medium text-secondary-800 dark:text-white">Appointment #{rec.id}</span>
                      <span className="text-xs text-secondary-400 dark:text-neutral-500">{rec.session} session</span>
                      {rec.created_at && (
                        <span className="text-xs text-secondary-400 dark:text-neutral-500">
                          {new Date(rec.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {rec.notes && (
                      <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-0.5 truncate">{rec.notes}</p>
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
              ))
            )}
          </div>

          {/* Load more */}
          {hasMore && (resolvedUserId || resolvedPatientIdentifier) && (
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

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
};

export default PatientLookup;
