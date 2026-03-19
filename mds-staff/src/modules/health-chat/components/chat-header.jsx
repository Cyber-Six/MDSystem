import React, { useState } from 'react';
import { X, Check, Clock, Trash2, User } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import {formatPatientName, getPatientInitials } from '../health-chat-service';
import TicketStatusBadge from './ticket-status-badge';

const ChatHeader = () => {
  const {
    selectedTicket,
    approveTicket,
    rejectTicket,
    closeTicket,
    filter
  } = useHealthChat();

  const [actionLoading, setActionLoading] = useState(null);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!selectedTicket) return null;

  const patient = selectedTicket.patient;
  const isPending = selectedTicket.status === 'Open';
  const isActive = selectedTicket.status === 'Ongoing';
  const isArchived = ['Closed', 'Expired'].includes(selectedTicket.status);

  const getPatientIdLabel = () => {
    if (!patient?.branch) return 'ID';
    return patient.branch === 'Student' ? 'Student ID' : 'Employee #';
  };

  const handleApprove = async () => {
    try {
      setActionLoading('approve');
      setActionError(null);
      await approveTicket(selectedTicket.id);
    } catch (err) {
      console.error('Failed to approve:', err);
      const errorMsg = err.message || 'Failed to approve ticket';
      setActionError(errorMsg);
      // Clear error after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      setActionLoading('reject');
      await rejectTicket(selectedTicket.id, reason || null);
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async () => {
    const confirmed = window.confirm('Are you sure you want to close this conversation?');
    if (!confirmed) return;

    try {
      setActionLoading('close');
      await closeTicket(selectedTicket.id);
    } catch (err) {
      console.error('Failed to close:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Error message */}
      {actionError && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{actionError}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        {/* Patient Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
            {getPatientInitials(patient)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-neutral-900 dark:text-white text-sm">
                {formatPatientName(patient)}
              </h3>
              {patient?.identifier && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  ({getPatientIdLabel()}: {patient.identifier})
                </span>
              )}
              <TicketStatusBadge status={selectedTicket.status} />
              <button
                onClick={() => setShowPatientInfo(true)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title="View patient info"
              >
                <User className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
              {selectedTicket.purpose}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Pending: Approve / Reject */}
          {isPending && (
            <>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 text-white
                         rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </>
          )}

          {/* Active: Close */}
          {isActive && (
            <button
              onClick={handleClose}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400
                       hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30
                       rounded-lg disabled:opacity-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          )}

          {/* Archived: Show closed info */}
          {isArchived && (
            <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              <Clock className="w-4 h-4" />
              Conversation ended
            </div>
          )}
        </div>
      </div>

      {/* Patient Info Modal */}
      {showPatientInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPatientInfo(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Patient Information</h3>
              <button
                onClick={() => setShowPatientInfo(false)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Full Name</label>
                <p className="text-sm text-neutral-900 dark:text-white mt-1">{formatPatientName(patient) || 'N/A'}</p>
              </div>
              {patient?.identifier && (
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{getPatientIdLabel()}</label>
                  <p className="text-sm text-neutral-900 dark:text-white mt-1 font-mono">{patient.identifier}</p>
                </div>
              )}
              {patient?.branch && (
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Type</label>
                  <p className="text-sm text-neutral-900 dark:text-white mt-1">{patient.branch}</p>
                </div>
              )}
              {patient?.email && (
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</label>
                  <p className="text-sm text-neutral-900 dark:text-white mt-1">{patient.email}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">User ID</label>
                <p className="text-sm text-neutral-900 dark:text-white mt-1 font-mono">{patient?.id || 'N/A'}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end">
              <button
                onClick={() => setShowPatientInfo(false)}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatHeader;
