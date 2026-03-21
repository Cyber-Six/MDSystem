import React, { useState } from 'react';
import { X, Check, Clock, User, ChevronDown, AlertCircle, Trash2 } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { formatPatientName, getPatientInitials } from '../health-chat-service';
import TicketStatusBadge from './ticket-status-badge';
import ConfirmModal from './confirm-modal';

const ChatHeader = () => {
  const { selectedTicket, approveTicket, rejectTicket, closeTicket, deleteTicket } = useHealthChat();

  const [actionLoading, setActionLoading] = useState(null);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, reason: '' });

  if (!selectedTicket) return null;

  const patient = selectedTicket.patient;
  const isPending  = selectedTicket.status === 'Open';
  const isActive   = selectedTicket.status === 'Ongoing';
  const isArchived = ['Closed', 'Expired'].includes(selectedTicket.status);

  const getIdLabel = () => {
    if (!patient?.branch) return 'ID';
    return patient.branch === 'Student' ? 'Student ID' : 'Employee No.';
  };

  const handleApprove = async () => {
    try {
      setActionLoading('approve');
      setActionError(null);
      await approveTicket(selectedTicket.id);
    } catch (err) {
      setActionError(err.message || 'Failed to approve');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason = null) => {
    try {
      setActionLoading('reject');
      setConfirmModal({ isOpen: false, type: null, reason: '' });
      await rejectTicket(selectedTicket.id, reason || null);
    } catch (err) {
      setActionError(err.message || 'Failed to reject');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async () => {
    try {
      setActionLoading('close');
      setConfirmModal({ isOpen: false, type: null, reason: '' });
      await closeTicket(selectedTicket.id);
    } catch (err) {
      setActionError(err.message || 'Failed to close');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading('delete');
      setConfirmModal({ isOpen: false, type: null, reason: '' });
      setActionError(null);
      await deleteTicket(selectedTicket.id);
    } catch (err) {
      setActionError(err.message || 'Failed to delete');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Error strip */}
      {actionError && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Main header bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
        {/* Left — patient identity block */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Initials avatar — centered against the two-line text block */}
          <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold self-center bg-primary-500 text-secondary-900">
            {getPatientInitials(patient)}
          </div>

          {/* Name + meta — two-line block */}
          <div className="min-w-0 flex flex-col justify-center gap-0.5">
            {/* Row 1: name + status + info button */}
            <div className="flex items-center gap-1.5 flex-wrap leading-none">
              <span className="font-semibold text-sm leading-none text-secondary-900 dark:text-white font-heading">
                {formatPatientName(patient)}
              </span>

              <TicketStatusBadge status={selectedTicket.status} />

              <button
                onClick={() => setShowPatientInfo(true)}
                className="flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 leading-none transition-colors
                           text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700
                           hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <User className="w-3 h-3" />
                Info
              </button>
            </div>

            {/* Row 2: Student ID or Employee No. */}
            {patient?.identifier && (
              <span className="text-xs font-mono leading-none text-neutral-500 dark:text-neutral-400">
                {getIdLabel()}: {patient.identifier}
              </span>
            )}
          </div>
        </div>

        {/* Right — action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && (
            <>
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           transition-all duration-150 disabled:opacity-50
                           bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400
                           hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => setConfirmModal({ isOpen: true, type: 'reject', reason: '' })}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           transition-all duration-150 disabled:opacity-50
                           text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800
                           hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}

          {isActive && (
            <button
              onClick={() => setConfirmModal({ isOpen: true, type: 'close', reason: '' })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all duration-150 disabled:opacity-50
                         text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700
                         hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="w-3.5 h-3.5" />
              Close Ticket
            </button>
          )}

          {isArchived && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                <Clock className="w-3.5 h-3.5" />
                Ticket ended
              </span>
              <button
                onClick={() => setConfirmModal({ isOpen: true, type: 'delete', reason: '' })}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           transition-all duration-150 disabled:opacity-50
                           text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800
                           hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete this archived ticket (admin only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Patient Info Modal */}
      {showPatientInfo && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          onClick={() => setShowPatientInfo(false)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-700"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <span className="font-semibold text-sm text-secondary-900 dark:text-white font-heading">
                Patient Information
              </span>
              <button
                onClick={() => setShowPatientInfo(false)}
                className="p-1 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Full Name',    value: formatPatientName(patient) },
                patient?.identifier && { label: getIdLabel(), value: patient.identifier, mono: true },
                patient?.branch && { label: 'Branch',   value: patient.branch },
                patient?.email  && { label: 'Email',  value: patient.email },
              ].filter(Boolean).map((row) => (
                <div key={row.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-neutral-400 dark:text-neutral-500">
                    {row.label}
                  </p>
                  <p
                    className="text-sm text-secondary-900 dark:text-white"
                    style={{ fontFamily: row.mono ? 'Fira Code, monospace' : 'inherit' }}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 flex justify-end border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowPatientInfo(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all bg-primary-500 hover:bg-primary-600 text-secondary-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmModal.type === 'reject' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                    Reject Ticket
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, reason: '' })}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                Are you sure you want to reject this ticket? You can optionally provide a reason below.
              </p>
              <textarea
                value={confirmModal.reason}
                onChange={(e) => setConfirmModal({ ...confirmModal, reason: e.target.value })}
                placeholder="Reason for rejection (optional)"
                className="w-full px-3 py-2 rounded-lg text-sm resize-none
                           bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
                           text-secondary-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500
                           focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, reason: '' })}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                           text-neutral-700 dark:text-neutral-300
                           border border-neutral-300 dark:border-neutral-600
                           hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmModal.reason)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                           bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white"
              >
                Reject Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'close'}
        onClose={() => setConfirmModal({ isOpen: false, type: null, reason: '' })}
        onConfirm={handleClose}
        title="Close Ticket"
        message="Are you sure you want to close this ticket? The patient will no longer be able to send messages."
        confirmText="Close Ticket"
        variant="warning"
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'delete'}
        onClose={() => setConfirmModal({ isOpen: false, type: null, reason: '' })}
        onConfirm={handleDelete}
        title="Delete Archived Ticket"
        message="Are you sure you want to permanently delete this archived ticket? This action cannot be undone and will remove all messages."
        confirmText="Delete Permanently"
        variant="danger"
      />
    </>
  );
};

export default ChatHeader;
