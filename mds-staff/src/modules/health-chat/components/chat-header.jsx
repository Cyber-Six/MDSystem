import React, { useState } from 'react';
import { X, Check, Clock, User, ChevronDown, AlertCircle } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';
import { formatPatientName, getPatientInitials } from '../health-chat-service';
import TicketStatusBadge from './ticket-status-badge';

const ChatHeader = () => {
  const { selectedTicket, approveTicket, rejectTicket, closeTicket } = useHealthChat();

  const [actionLoading, setActionLoading] = useState(null);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [actionError, setActionError] = useState(null);

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

  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try {
      setActionLoading('reject');
      await rejectTicket(selectedTicket.id, reason || null);
    } catch (err) {
      setActionError(err.message || 'Failed to reject');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this conversation?')) return;
    try {
      setActionLoading('close');
      await closeTicket(selectedTicket.id);
    } catch (err) {
      setActionError(err.message || 'Failed to close');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Error strip */}
      {actionError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs flex-shrink-0"
          style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', color: '#DC2626' }}
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Main header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          background: '#fdfcfa',
          borderBottom: '1px solid #e8e5e0',
        }}
      >
        {/* Left — patient identity block */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Initials avatar — centered against the two-line text block */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold self-center"
            style={{ background: '#f4c430', color: '#1c1a17' }}
          >
            {getPatientInitials(patient)}
          </div>

          {/* Name + meta — tight two-line block */}
          <div className="min-w-0 flex flex-col justify-center gap-0.5">
            {/* Row 1: name + tags */}
            <div className="flex items-center gap-1.5 flex-wrap leading-none">
              <span
                className="font-semibold text-sm leading-none"
                style={{ color: '#1c1a17', fontFamily: 'Poppins, sans-serif' }}
              >
                {formatPatientName(patient)}
              </span>

              {patient?.identifier && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded leading-none"
                  style={{ background: '#f4f2ef', color: '#78716c' }}
                >
                  {getIdLabel()}: {patient.identifier}
                </span>
              )}

              <TicketStatusBadge status={selectedTicket.status} />

              <button
                onClick={() => setShowPatientInfo(true)}
                className="flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 leading-none transition-colors"
                style={{ color: '#a19b93', border: '1px solid #e8e5e0' }}
                onMouseEnter={e => e.currentTarget.style.color = '#57534e'}
                onMouseLeave={e => e.currentTarget.style.color = '#a19b93'}
              >
                <User className="w-3 h-3" />
                Info
              </button>
            </div>

            {/* Row 2: purpose */}
            <p
              className="text-[11px] truncate max-w-sm leading-none"
              style={{ color: '#a19b93' }}
            >
              {selectedTicket.purpose}
            </p>
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
                           transition-all duration-150 disabled:opacity-50"
                style={{ background: '#D1FAE5', color: '#065F46' }}
                onMouseEnter={e => e.currentTarget.style.background = '#A7F3D0'}
                onMouseLeave={e => e.currentTarget.style.background = '#D1FAE5'}
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           transition-all duration-150 disabled:opacity-50"
                style={{ color: '#DC2626', border: '1px solid #FECACA' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}

          {isActive && (
            <button
              onClick={handleClose}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all duration-150 disabled:opacity-50"
              style={{ color: '#78716c', border: '1px solid #e8e5e0' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#DC2626';
                e.currentTarget.style.borderColor = '#FECACA';
                e.currentTarget.style.background = '#FEF2F2';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.borderColor = '#e8e5e0';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          )}

          {isArchived && (
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: '#a19b93' }}
            >
              <Clock className="w-3.5 h-3.5" />
              Conversation ended
            </span>
          )}
        </div>
      </div>

      {/* Patient Info Modal */}
      {showPatientInfo && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(28,25,23,0.45)' }}
          onClick={() => setShowPatientInfo(false)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
            style={{
              background: '#fdfcfa',
              boxShadow: '0 20px 60px rgba(28,25,23,0.2)',
              border: '1px solid #e8e5e0'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid #e8e5e0' }}
            >
              <span
                className="font-semibold text-sm"
                style={{ color: '#1c1a17', fontFamily: 'Poppins, sans-serif' }}
              >
                Patient Information
              </span>
              <button
                onClick={() => setShowPatientInfo(false)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: '#a19b93' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f2ef'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Full Name',    value: formatPatientName(patient) },
                patient?.identifier && { label: getIdLabel(), value: patient.identifier, mono: true },
                patient?.branch && { label: 'Type',   value: patient.branch },
                patient?.email  && { label: 'Email',  value: patient.email },
                { label: 'User ID', value: patient?.id || 'N/A', mono: true },
              ].filter(Boolean).map((row) => (
                <div key={row.label}>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: '#a19b93' }}
                  >
                    {row.label}
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      color: '#1c1a17',
                      fontFamily: row.mono ? 'Fira Code, monospace' : 'inherit'
                    }}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div
              className="px-5 py-4 flex justify-end"
              style={{ borderTop: '1px solid #e8e5e0' }}
            >
              <button
                onClick={() => setShowPatientInfo(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#f4c430', color: '#1c1a17' }}
                onMouseEnter={e => e.currentTarget.style.background = '#DDB322'}
                onMouseLeave={e => e.currentTarget.style.background = '#f4c430'}
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