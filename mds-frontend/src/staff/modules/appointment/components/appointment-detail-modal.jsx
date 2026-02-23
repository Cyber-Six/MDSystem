import React, { useState } from 'react';

/**
 * Appointment Detail Modal
 * Full appointment details with OJT document checklist, actions (confirm/cancel/mark done)
 * SRS §3.4.3, §3.4.4, §3.4.5, §3.4.6, §3.4.7
 */
const AppointmentDetailModal = ({ appointment, onClose, onConfirm, onCancel, onMarkDone, onReschedule }) => {
  const [consultationNotes, setConsultationNotes] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!appointment) return null;

  const {
    id,
    patientName,
    patientId,
    program,
    yearLevel,
    classification,
    appointmentType,
    scheduledDate,
    timeSlot,
    mode,
    status,
    docsComplete,
    missingDocs,
  } = appointment;

  const isOJT = appointmentType === 'OJT';
  const isMedClearance = appointmentType === 'Medical Clearance';
  const canConfirm = status === 'Pending' && (!isOJT || docsComplete);
  const canMarkDone = status === 'Confirmed' || status === 'Auto-Confirmed';
  const canCancel = status !== 'Completed' && status !== 'Cancelled';

  // OJT required documents — SRS §3.4.3
  const ojtDocuments = [
    { name: 'CBC (Complete Blood Count)', submitted: true },
    { name: 'Chest X-ray', submitted: true },
    { name: 'Drug Test', submitted: !missingDocs?.includes('Drug Test') },
    { name: 'QR Form (submitted day before)', submitted: !missingDocs?.includes('QR Form') },
  ];

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    onCancel?.(id, cancelReason);
    onClose();
  };

  const handleConfirm = () => {
    onConfirm?.(id);
    onClose();
  };

  const handleMarkDone = () => {
    onMarkDone?.(id, consultationNotes);
    onClose();
  };

  const initials = patientName.split(' ').map((n) => n[0]).join('');

  const statusColors = {
    Pending: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    Confirmed: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    'Auto-Confirmed': 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    Completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    Cancelled: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-800 px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-400">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white">{patientName}</h2>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">{id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${statusColors[status]}`}>
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
          {/* Patient Info */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Patient Information</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Student ID', value: patientId },
                { label: 'Program', value: program },
                { label: 'Year Level', value: yearLevel },
                { label: 'Classification', value: classification },
                { label: 'Consultation Mode', value: mode },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Appointment Details */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Appointment Details</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Type', value: appointmentType },
                { label: 'Date', value: scheduledDate },
                { label: 'Time Slot', value: timeSlot },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            {isMedClearance && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-1.5 text-xs text-success-600 dark:text-success-400">
                </div>
              </div>
            )}
          </div>

          {/* OJT Document Checklist — SRS §3.4.3 */}
          {isOJT && (
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Required Documents (OJT)</h3>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                  docsComplete
                    ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                    : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                }`}>
                  {docsComplete ? 'Complete' : 'Incomplete'}
                </span>
              </div>
              <div className="p-3 space-y-2">
                {ojtDocuments.map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2.5">
                    {doc.submitted ? (
                      <svg className="w-4 h-4 text-success-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-error-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`text-sm ${
                      doc.submitted
                        ? 'text-secondary-700 dark:text-neutral-300'
                        : 'text-error-600 dark:text-error-400 font-medium'
                    }`}>
                      {doc.name}
                    </span>
                  </div>
                ))}
                {!docsComplete && (
                  <p className="text-xs text-warning-600 dark:text-warning-400 mt-2 p-2 bg-warning-50 dark:bg-warning-900/20 rounded">
                    Cannot confirm appointment until all required documents are submitted.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Consultation Notes — SRS §3.4.7 */}
          {canMarkDone && (
            <div>
              <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">
                Consultation Notes (Optional — SRS §3.4.7)
              </label>
              <textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                rows={3}
                placeholder="Add consultation notes to attach to patient's record..."
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
              />
            </div>
          )}

          {/* Cancel Form */}
          {showCancelForm && (
            <div className="border border-error-200 dark:border-error-800 rounded-lg p-3 bg-error-50 dark:bg-error-900/20">
              <label className="text-xs font-medium text-error-700 dark:text-error-400 mb-1.5 block">
                Reason for Cancellation
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
                  Confirm Cancel
                </button>
                <button
                  onClick={() => { setShowCancelForm(false); setCancelReason(''); }}
                  className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                >
                  Nevermind
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-800 px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {canCancel && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="px-4 py-2 text-sm font-medium text-error-600 dark:text-error-400 border border-error-200 dark:border-error-700 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-colors"
              >
                Cancel Appointment
              </button>
            )}
            {status === 'Pending' && (
              <button
                onClick={() => onReschedule?.(id)}
                className="px-4 py-2 text-sm font-medium text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-700 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-md transition-colors"
              >
                Reschedule
              </button>
            )}
            {canConfirm && (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-md transition-colors"
              >
                Confirm
              </button>
            )}
            {canMarkDone && (
              <button
                onClick={handleMarkDone}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
              >
                Mark as Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailModal;
