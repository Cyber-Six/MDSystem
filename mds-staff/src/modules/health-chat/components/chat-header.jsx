import React, { useState } from 'react';
import { X, Check, Clock, Trash2 } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { formatPatientName, getPatientInitials } from '../health-chat-service';
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

  if (!selectedTicket) return null;

  const patient = selectedTicket.patient;
  const isPending = selectedTicket.status === 'Open';
  const isActive = selectedTicket.status === 'Ongoing';
  const isArchived = ['Closed', 'Expired'].includes(selectedTicket.status);

  const handleApprove = async () => {
    try {
      setActionLoading('approve');
      await approveTicket(selectedTicket.id);
    } catch (err) {
      console.error('Failed to approve:', err);
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
            <TicketStatusBadge status={selectedTicket.status} />
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
  );
};

export default ChatHeader;
