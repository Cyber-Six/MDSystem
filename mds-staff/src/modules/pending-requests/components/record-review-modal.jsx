import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TICKET_STATUS, staffUpdateTicket, approveInitialRecord } from '../initial-record-service';
import { fetchPatientRecordForReview, submitStaffEdits } from '../patient-record-service';
import {
  PersonalInfoSection,
  EmergencyContactSection,
  MedicalHistorySection,
  MedicalBackgroundSection,
  DentalHistorySection,
  ObGyneSection,
  SectionSkeleton,
} from './review-sections';

/**
 * RecordReviewModal  (Step 2)
 *
 * Full-screen modal displaying all patient-submitted data organised by
 * sections.  Sections rendered depend on the ticket scope (Medical / Dental / Both).
 *
 * Features:
 *  - Inline editing per section with mandatory DPA reason
 *  - Role-based locking (medical-only / dental-only staff)
 *  - Approve / Request Revision actions
 *
 * Props:
 *  ticket        — { id, patientId, status, scope, first_name, last_name, branch, created_at }
 *  onClose       — () => void
 *  onAction      — (ticket, newStatus) => void  — called after a successful mutation
 *  staffRole     — 'medical' | 'dental' | 'both'  (defaults to 'both')
 */
const RecordReviewModal = ({ ticket, onClose, onAction, staffRole = 'both' }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [recordData, setRecordData] = useState(null);
  const [catalogs, setCatalogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Revision form
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  // Edit state per section
  const [editingSections, setEditingSections] = useState({});
  const [editedFields, setEditedFields] = useState({});

  // DPA confirmation
  const [showDPAConfirm, setShowDPAConfirm] = useState(false);

  // Prevent infinite re-fetch for OB-GYNE lazy-load
  const obgynFetchedRef = useRef(false);

  // Derived values (safe to compute before hooks since they come from props/state)
  const scope = ticket?.scope ?? 'Both';
  const includeMedical = scope === 'Medical' || scope === 'Both';
  const includeDental  = scope === 'Dental'  || scope === 'Both';

  // ── Fetch patient record data ──────────────────────────────────────────────

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    obgynFetchedRef.current = false; // reset on new ticket

    const fetchData = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const sex = ticket.sex ?? null; // may not be available from ticket list
        const data = await fetchPatientRecordForReview(ticket.patientId, scope, sex);
        if (!cancelled) {
          const { catalogs: cats, ...recordFields } = data;
          setRecordData(recordFields);
          setCatalogs(cats ?? {});
        }
      } catch (err) {
        if (!cancelled) setFetchError(err.message || 'Failed to load patient record.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [ticket?.patientId, scope]);

  // OB-GYNE is now included in the initial batched fetch for all medical-scope
  // records, so a lazy-load is only needed if recordData was set before the
  // batch approach existed (i.e. obgynHistory key is completely absent).
  useEffect(() => {
    const sex = recordData?.basicInfo?.sex;
    if (!sex || !includeMedical || obgynFetchedRef.current) return;
    if (sex.toLowerCase() !== 'female') return;
    // Skip if already populated by the batched fetch.
    if ('obgynHistory' in (recordData ?? {})) return;

    obgynFetchedRef.current = true; // mark attempted — prevents infinite loop
    import('../patient-record-service').then(({ getUserObgynHistory }) => {
      getUserObgynHistory(ticket.patientId).then((data) => {
        setRecordData((prev) => ({
          ...prev,
          obgynHistory: Array.isArray(data) ? (data[0] ?? null) : data,
        }));
      }).catch(() => {});
    });
  }, [recordData?.basicInfo?.sex, includeMedical, ticket?.patientId]);

  // ── Edit helpers ───────────────────────────────────────────────────────────

  const toggleEdit = useCallback((section) => {
    setEditingSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const setFieldValue = useCallback((section, field, value) => {
    setEditedFields((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] ?? {}),
        [field]: value,
      },
    }));
  }, []);

  const hasAnyEdits = Object.keys(editedFields).some(
    (k) => Object.keys(editedFields[k] ?? {}).length > 0,
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    // If there are edits, show DPA confirmation first
    if (hasAnyEdits && !showDPAConfirm) {
      setShowDPAConfirm(true);
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      // Submit staff edits before approving (if any fields were modified)
      if (hasAnyEdits) {
        const editResult = await submitStaffEdits(ticket.patientId, editedFields, recordData);
        if (!editResult.success) {
          setActionError(`Failed to save edits: ${editResult.errors.join('; ')}`);
          setActionLoading(false);
          setShowDPAConfirm(false);
          return;
        }
      }

      // Step 1: approve personal record — if this fails the EMR ticket is NOT touched
      // Step 2: approve EMR ticket (medical + dental) — only runs if step 1 succeeded
      const newStatus = await approveInitialRecord(ticket.patientId);
      onAction?.({ ...ticket, status: newStatus }, newStatus);
      onClose();
    } catch (err) {
      setActionError(err.message || 'Failed to approve record. Please try again.');
    } finally {
      setActionLoading(false);
      setShowDPAConfirm(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      setActionError('Please provide a reason for the revision request.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      const newStatus = await staffUpdateTicket(ticket.patientId, TICKET_STATUS.REVISION, revisionNote.trim());
      onAction?.({ ...ticket, status: newStatus }, newStatus);
      onClose();
    } catch (err) {
      setActionError(err.message || 'Failed to request revision.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived render values ───────────────────────────────────────────────────

  const isFemale = recordData?.basicInfo?.sex?.toLowerCase() === 'female';
  const canAccessMedical = staffRole === 'medical' || staffRole === 'both';
  const canAccessDental  = staffRole === 'dental'  || staffRole === 'both';
  const isPending =
    ticket?.status === TICKET_STATUS.PENDING ||
    ticket?.status === TICKET_STATUS.REVISION_SUBMITTED;

  // ── Status badge ───────────────────────────────────────────────────────────

  const statusClasses = {
    [TICKET_STATUS.PENDING]:            'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    [TICKET_STATUS.REVISION_SUBMITTED]: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    [TICKET_STATUS.APPROVED]:           'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    [TICKET_STATUS.REVISION]:           'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  };

  const badgeClass = statusClasses[ticket.status] ?? 'bg-neutral-100 text-neutral-600';

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-800 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between rounded-t-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <h2 style={{ lineHeight: 1.2, margin: 0 }} className="text-xl font-bold text-secondary-900 dark:text-white truncate">
                Record Review
              </h2>
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded whitespace-nowrap ${badgeClass}`}>
                {ticket.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary-600 dark:text-neutral-400">
              <span className="font-semibold text-secondary-800 dark:text-neutral-200">
                {ticket.first_name || ticket.last_name
                  ? `${ticket.first_name ?? ''} ${ticket.last_name ?? ''}`.trim()
                  : `Patient #${ticket.patientId}`}
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">&middot;</span>
              <span>Scope: {scope}</span>
              <span className="text-neutral-400 dark:text-neutral-500">&middot;</span>
              <span>{ticket.branch === 'QuezonCity' ? 'Quezon City' : ticket.branch}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={actionLoading}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Fetch error */}
          {fetchError && (
            <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <svg className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-error-700 dark:text-error-400 mb-0">{fetchError}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              <SectionSkeleton />
              <SectionSkeleton />
              <SectionSkeleton />
            </div>
          )}

          {/* ── Sections ── */}
          {!loading && recordData && (
            <>
              {/* Personal Information — always shown */}
              <PersonalInfoSection
                basicInfo={recordData.basicInfo}
                profile={recordData.profile}
                isEditing={editingSections.personalInfo ?? false}
                editedFields={editedFields.personalInfo ?? {}}
                onFieldChange={(f, v) => setFieldValue('personalInfo', f, v)}
                onToggleEdit={() => toggleEdit('personalInfo')}
                isPending={isPending}
              />

              {/* Emergency Contacts */}
              {includeMedical && (
                <EmergencyContactSection
                  emergencyContact={recordData.emergencyContact}
                  isEditing={editingSections.emergencyContact ?? false}
                  editedFields={editedFields.emergencyContact ?? {}}
                  onFieldChange={(f, v) => setFieldValue('emergencyContact', f, v)}
                  onToggleEdit={canAccessMedical ? () => toggleEdit('emergencyContact') : undefined}
                  isPending={isPending && canAccessMedical}
                  isLocked={!canAccessMedical}
                />
              )}

              {/* Medical History */}
              {includeMedical && (
                <MedicalHistorySection
                  medicalHistory={recordData.medicalHistory}
                  catalogs={catalogs}
                  isEditing={editingSections.medicalHistory ?? false}
                  editedFields={editedFields.medicalHistory ?? {}}
                  onFieldChange={(f, v) => setFieldValue('medicalHistory', f, v)}
                  onToggleEdit={canAccessMedical ? () => toggleEdit('medicalHistory') : undefined}
                  isPending={isPending && canAccessMedical}
                  isLocked={!canAccessMedical}
                />
              )}

              {/* Medical Background (allergies, immunizations, etc.) */}
              {includeMedical && (
                <MedicalBackgroundSection
                  catalogs={catalogs}
                  allergyProfile={recordData.allergyProfile}
                  immunizationProfile={recordData.immunizationProfile}
                  hospitalizationProfile={recordData.hospitalizationProfile}
                  operationProfile={recordData.operationProfile}
                  medicationProfile={recordData.medicationProfile}
                  lifestyle={recordData.lifestyle}
                  visualAcuityProfile={recordData.visualAcuityProfile}
                  vitalSigns={recordData.vitalSigns}
                  isEditing={editingSections.medicalBackground ?? false}
                  editedFields={editedFields.medicalBackground ?? {}}
                  onFieldChange={(f, v) => setFieldValue('medicalBackground', f, v)}
                  onToggleEdit={canAccessMedical ? () => toggleEdit('medicalBackground') : undefined}
                  isPending={isPending && canAccessMedical}
                  isLocked={!canAccessMedical}
                />
              )}

              {/* OB-GYNE (female + medical scope) */}
              {includeMedical && isFemale && (
                <ObGyneSection
                  obgynHistory={recordData.obgynHistory}
                  isEditing={editingSections.obgyne ?? false}
                  editedFields={editedFields.obgyne ?? {}}
                  onFieldChange={(f, v) => setFieldValue('obgyne', f, v)}
                  onToggleEdit={canAccessMedical ? () => toggleEdit('obgyne') : undefined}
                  isPending={isPending && canAccessMedical}
                  isLocked={!canAccessMedical}
                />
              )}

              {/* Dental History */}
              {includeDental && (
                <DentalHistorySection
                  catalogs={catalogs}
                  dentalHistory={recordData.dentalHistory}
                  dentalProcedureProfile={recordData.dentalProcedureProfile}
                  oralApplianceProfile={recordData.oralApplianceProfile}
                  dentalPhotoRecord={recordData.dentalPhotoRecord}
                  isEditing={editingSections.dentalHistory ?? false}
                  editedFields={editedFields.dentalHistory ?? {}}
                  onFieldChange={(f, v) => setFieldValue('dentalHistory', f, v)}
                  onToggleEdit={canAccessDental ? () => toggleEdit('dentalHistory') : undefined}
                  isPending={isPending && canAccessDental}
                  isLocked={!canAccessDental}
                />
              )}

              {/* Edit summary when edits exist */}
              {hasAnyEdits && (
                <div className="bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-warning-900 dark:text-warning-400">
                        Staff Edits Pending
                      </h4>
                      <p className="text-xs text-warning-700 dark:text-warning-500 mt-1 mb-0">
                        You have modified patient data. These changes will be logged per the Data Privacy Act.
                        Ensure all edit reasons are provided before approving.
                      </p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(editedFields).map(([section, fields]) => {
                          const count = Object.keys(fields).length;
                          if (count === 0) return null;
                          return (
                            <p key={section} className="text-xs text-warning-600 dark:text-warning-400">
                              • <span className="font-medium">{section}</span>: {count} field(s) modified
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DPA Confirmation dialog */}
              {showDPAConfirm && (
                <div className="bg-primary-50 dark:bg-primary-900/10 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-bold text-primary-900 dark:text-primary-300">
                        Confirm Staff Changes
                      </h4>
                      <p className="text-xs text-primary-700 dark:text-primary-400 mt-1 mb-0">
                        You are about to approve this record with staff-modified fields.
                        By proceeding, you confirm that all edits are corrections of genuine
                        errors and that you are authorized to make these changes.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setShowDPAConfirm(false)}
                          className="px-3 py-1.5 text-xs font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoading && (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          )}
                          Confirm & Approve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Revision form */}
              {showRevisionForm && (
                <div className="border border-warning-200 dark:border-warning-800 rounded-lg overflow-hidden bg-warning-50 dark:bg-warning-900/10">
                  <div className="px-4 py-3 border-b border-warning-200 dark:border-warning-800">
                    <h3 className="text-sm font-semibold text-warning-900 dark:text-warning-400">
                      Reason for Revision Request
                    </h3>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={revisionNote}
                      onChange={(e) => { setRevisionNote(e.target.value); setActionError(''); }}
                      rows={3}
                      placeholder="Describe what the patient needs to correct or complete…"
                      className="w-full px-3 py-2 text-sm border border-warning-300 dark:border-warning-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-warning-500 focus:border-warning-500 resize-none"
                    />
                    <p className="mt-1 text-xs text-secondary-400 dark:text-neutral-500">
                      This note will be sent to the patient so they know what to correct.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <svg className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-error-700 dark:text-error-400 mb-0">{actionError}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3 rounded-b-xl">
          {showRevisionForm ? (
            <>
              <button
                onClick={() => { setShowRevisionForm(false); setRevisionNote(''); setActionError(''); }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Send Revision Request
              </button>
            </>
          ) : isPending ? (
            <>
              <button
                onClick={onClose}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRevisionForm(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Request Revision
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Approve
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordReviewModal;
