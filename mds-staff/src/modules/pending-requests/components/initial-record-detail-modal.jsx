import React, { useState } from 'react';
import { TICKET_STATUS, staffUpdateTicket } from '../initial-record-service';
import RecordReviewModal from './record-review-modal';

/**
 * InitialRecordDetailModal
 *
 * Step 1: Shows patient summary info (name, ID, scope, status, branch).
 * Provides a "Review Request" button to open Step 2 (RecordReviewModal)
 * where staff can see all patient-submitted data, edit typos, and approve/reject.
 *
 * Also retains the existing quick-approve and revision request actions
 * for cases where a full review is not needed.
 *
 * Props:
 *  ticket     {id, patientId, status, scope, first_name, last_name, branch, created_at}
 *  onClose    () => void
 *  onAction   (ticket, newStatus) => void  — called after a successful mutation
 *  staffRole  'medical' | 'dental' | 'both'  (defaults to 'both')
 */
const InitialRecordDetailModal = ({ ticket, onClose, onAction, staffRole = 'both' }) => {
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!ticket) return null;

  const isPending =
    ticket.status === TICKET_STATUS.PENDING ||
    ticket.status === TICKET_STATUS.REVISION_SUBMITTED;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const newStatus = await staffUpdateTicket(ticket.patientId, TICKET_STATUS.APPROVED);
      onAction?.({ ...ticket, status: newStatus }, newStatus);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to approve ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    // revisionNote is for operator context – it is not sent to the backend
    // because the current staffUpdateTicket mutation does not accept a notes
    // parameter. See backend issues table.
    if (!revisionNote.trim()) {
      setError('Please provide a reason for the revision request.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const newStatus = await staffUpdateTicket(ticket.patientId, TICKET_STATUS.REVISION);
      onAction?.({ ...ticket, status: newStatus }, newStatus);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to request revision.');
    } finally {
      setLoading(false);
    }
  };

  // ── Status badge helpers ──────────────────────────────────────────────────

  const statusClasses = {
    [TICKET_STATUS.PENDING]:            'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    [TICKET_STATUS.REVISION_SUBMITTED]: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    [TICKET_STATUS.APPROVED]:           'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    [TICKET_STATUS.REVISION]:           'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
    [TICKET_STATUS.EXPIRED]:            'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
    [TICKET_STATUS.CANCELLED]:          'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  };

  const badgeClass = statusClasses[ticket.status] ?? 'bg-neutral-100 text-neutral-600';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
              Initial Record Submission
            </h2>
            <p className="text-sm text-secondary-600 dark:text-neutral-400">
              Ticket&nbsp;#&nbsp;{ticket.id}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Ticket info */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">
                Ticket Information
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Patient Name
                </p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                  {ticket.first_name || ticket.last_name
                    ? `${ticket.first_name ?? ''} ${ticket.last_name ?? ''}`.trim()
                    : <span className="italic text-secondary-400 dark:text-neutral-500">— not available —</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Patient ID
                </p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white font-mono">
                  {ticket.patientId}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Status
                </p>
                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${badgeClass}`}>
                  {ticket.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Submitted
                </p>
                <p className="text-sm text-secondary-700 dark:text-neutral-300">
                  {ticket.created_at
                    ? new Date(ticket.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Branch
                </p>
                <p className="text-sm text-secondary-700 dark:text-neutral-300">
                  {ticket.branch === 'QuezonCity' ? 'Quezon City' : ticket.branch ?? '—'}
                </p>
              </div>
              {ticket.scope && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Scope
                  </p>
                  <p className="text-sm text-secondary-700 dark:text-neutral-300">
                    {ticket.scope}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Review Request Button (Step 1 → Step 2) ── */}
          {isPending && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-semibold text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Review Full Record
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}

          {/* Info notice for Revision-Submitted resubmissions */}
          {ticket.status === TICKET_STATUS.REVISION_SUBMITTED && (
            <div className="flex items-start gap-3 p-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg">
              <svg className="w-5 h-5 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <p className="text-sm text-accent-700 dark:text-accent-400">
                This patient revised their record after a previous revision request. Reviewing the updated submission before approving is recommended.
              </p>
            </div>
          )}

          {/* Error alert */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <svg className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
            </div>
          )}

          {/* Revision reason form */}
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
                  onChange={(e) => { setRevisionNote(e.target.value); setError(''); }}
                  rows={3}
                  placeholder="Describe what the patient needs to correct or complete before the submission can be approved…"
                  className="w-full px-3 py-2 text-sm border border-warning-300 dark:border-warning-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-warning-500 focus:border-warning-500 resize-none"
                />
                <p className="mt-1 text-xs text-secondary-400 dark:text-neutral-500">
                  This note is for your reference only and is not stored in the backend at this time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {showRevisionForm ? (
            <>
              <button
                onClick={() => { setShowRevisionForm(false); setRevisionNote(''); setError(''); }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
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
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRevisionForm(true)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Request Revision
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
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

      {/* ── Step 2: Full Record Review Modal ── */}
      {showReviewModal && (
        <RecordReviewModal
          ticket={ticket}
          onClose={() => setShowReviewModal(false)}
          onAction={(updatedTicket, newStatus) => {
            onAction?.(updatedTicket, newStatus);
            setShowReviewModal(false);
            onClose();
          }}
          staffRole={staffRole}
        />
      )}
    </div>
  );
};

export default InitialRecordDetailModal;
