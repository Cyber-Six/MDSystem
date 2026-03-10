import React, { useState, useEffect, useCallback } from 'react';
import { getPatientStatus, getPatientRecords } from '../staff-appointment-service';

/**
 * Appointment Detail Modal
 * Shows real patientSlot record from the backend.
 * Backend shape: { id, patientId, slotEntityId, status, session,
 *   approvedBy, notes, arrived_at, created_at, requirements[] }
 *
 * Actions align to the appointment state machine:
 *   Pending     → Approve (Scheduled), Reject
 *   Scheduled   → Record Attendance (InProgress), Cancel (CancelledByMedical), No-Show
 *   InProgress  → Complete, No-Show
 */
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

const AppointmentDetailModal = ({ appointment, onClose, onConfirm, onCancel, onMarkDone, onMarkNoShow, onMarkComplete }) => {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async (pid) => {
    setHistoryLoading(true);
    try {
      const [status, records] = await Promise.all([
        getPatientStatus(pid),
        getPatientRecords(pid, 0, 10),
      ]);
      setHistoryStatus(status);
      setHistory(records || []);
    } catch {
      // non-critical — history panel stays empty
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appointment?.patientId) {
      setHistory([]);
      setHistoryStatus(null);
      loadHistory(appointment.patientId);
    }
  }, [appointment?.patientId, loadHistory]);

  if (!appointment) return null;

  const {
    id,
    patientId,
    patientIdentifier,
    patientName,
    slotEntityId,
    status,
    session,
    approvedBy,
    notes,
    arrived_at,
    created_at,
    requirements = [],
  } = appointment;

  const canConfirm = status === 'Pending';
  const canReject = status === 'Pending';
  const canRecordAttendance = status === 'Scheduled';
  const canCancelByMedical = status === 'Scheduled';
  const canMarkComplete = status === 'InProgress';
  const canMarkNoShow = status === 'Scheduled' || status === 'InProgress';

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    if (status === 'Pending') {
      onCancel?.(patientId, cancelReason);
    } else if (status === 'Scheduled') {
      onCancel?.(patientId, cancelReason, 'CancelledByMedical');
    }
    onClose();
  };

  const handleConfirm = () => {
    onConfirm?.(patientId);
    onClose();
  };

  const handleRecordAttendance = () => {
    onMarkDone?.(id);
    onClose();
  };

  const handleMarkComplete = () => {
    onMarkComplete?.(patientId);
    onClose();
  };

  const handleMarkNoShow = () => {
    onMarkNoShow?.(patientId);
    onClose();
  };

  const statusColors = STATUS_COLORS;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-800 px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Appointment #{id}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-secondary-500 dark:text-neutral-400">
                  Patient: {patientName ? `${patientName} ` : ''}
                  {patientIdentifier ? `ID ${patientIdentifier}` : `(uid ${patientId})`}
                </p>
              {historyStatus && (
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${STATUS_COLORS[historyStatus] || 'bg-neutral-100 text-neutral-600'}`}>
                  Latest: {historyStatus}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${statusColors[status] || 'bg-neutral-100 text-neutral-600'}`}>
              {status}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Appointment Details */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Appointment Details</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Student / Employee ID', value: patientIdentifier ?? '—' },
                { label: 'Internal User ID', value: patientId },
                { label: 'Session', value: session },
                { label: 'Status', value: status },
                { label: 'Slot Entity', value: slotEntityId },
                { label: 'Approved By', value: approvedBy || '—' },
                { label: 'Arrived At', value: arrived_at ? new Date(arrived_at).toLocaleString() : '—' },
                { label: 'Created', value: created_at ? new Date(created_at).toLocaleString() : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
                <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Notes</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-secondary-700 dark:text-neutral-300">{notes}</p>
              </div>
            </div>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
                <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Submitted Requirements</h3>
              </div>
              <div className="p-3 space-y-2">
                {requirements.map((req) => (
                  <div key={req.id} className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-success-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-secondary-700 dark:text-neutral-300">
                      Req #{req.scheduleRequirementId}
                    </span>
                    {req.filename && (
                      <span className="text-xs text-secondary-400 dark:text-neutral-500 font-mono">{req.filename}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patient History */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Patient Appointment History</h3>
              <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{history.length} record{history.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
              {historyLoading ? (
                <div className="px-4 py-3 text-xs text-secondary-400 dark:text-neutral-500">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="px-4 py-3 text-xs text-secondary-400 dark:text-neutral-500">No past appointments found.</div>
              ) : (
                history.map((rec) => (
                  <div key={rec.id} className={`px-4 py-2.5 flex items-center justify-between gap-3 ${rec.id === id ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">#{rec.id}</span>
                        {rec.id === id && <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold">current</span>}
                        <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{rec.session}</span>
                      </div>
                      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-0.5">
                        {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '—'}
                        {rec.notes ? ` · ${rec.notes}` : ''}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${STATUS_COLORS[rec.status] || 'bg-neutral-100 text-neutral-600'}`}>
                      {rec.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cancel Form */}
          {showCancelForm && (
            <div className="border border-error-200 dark:border-error-800 rounded-lg p-3 bg-error-50 dark:bg-error-900/20">
              <label className="text-xs font-medium text-error-700 dark:text-error-400 mb-1.5 block">
                Reason for Rejection
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="Provide a reason..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 border border-error-200 dark:border-error-700 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-error-500 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-error-500 hover:bg-error-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => { setShowCancelForm(false); setCancelReason(''); }}
                  className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-800 px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end">
          <div className="flex items-center gap-2">
            {(canReject || canCancelByMedical) && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="px-4 py-2 text-sm font-medium text-error-600 dark:text-error-400 border border-error-200 dark:border-error-700 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-colors"
              >
                {canReject ? 'Reject' : 'Cancel'}
              </button>
            )}
            {canMarkNoShow && (
              <button
                onClick={handleMarkNoShow}
                className="px-4 py-2 text-sm font-medium text-warning-600 dark:text-warning-400 border border-warning-200 dark:border-warning-700 hover:bg-warning-50 dark:hover:bg-warning-900/20 rounded-md transition-colors"
              >
                No-Show
              </button>
            )}
            {canConfirm && (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-md transition-colors"
              >
                Approve
              </button>
            )}
            {canRecordAttendance && (
              <button
                onClick={handleRecordAttendance}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
              >
                Record Attendance
              </button>
            )}
            {canMarkComplete && (
              <button
                onClick={handleMarkComplete}
                className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-md transition-colors"
              >
                Mark Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailModal;
