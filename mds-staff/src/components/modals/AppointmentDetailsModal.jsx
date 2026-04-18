import React, { useState } from 'react';

/**
 * Appointment Details Modal
 * Displays full appointment details with actions to accept, reject, or edit
 */
const AppointmentDetailsModal = ({ appointment, onClose, onAccept, onReject, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    date: appointment?.scheduledDate || '',
    time: appointment?.scheduledTime || '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!appointment) return null;

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdate?.(appointment.id, editedData);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedData({
      date: appointment.scheduledDate,
      time: appointment.scheduledTime,
    });
    setIsEditing(false);
  };

  const handleAccept = () => {
    onAccept?.(appointment.id);
    onClose();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for rejection');
      return;
    }
    setRejectError('');
    onReject?.(appointment.id, rejectReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">Appointment Details</h2>
            <p className="text-sm text-secondary-600 dark:text-neutral-400">Request ID: {appointment.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Student Information */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Student Information</h3>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Name</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.studentName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Student Number</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.studentNumber}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Program</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.program}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Year Level</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.yearLevel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Contact Number</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.contactNumber}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.email}</p>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Appointment Information</h3>
              {!isEditing && appointment.status === 'Pending' && (
                <button
                  onClick={handleEdit}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    Scheduled Date
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedData.date}
                      onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.scheduledDate}</p>
                  )}
                </div>

                {/* Time */}
                <div>
                  <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    Scheduled Time
                  </label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={editedData.time}
                      onChange={(e) => setEditedData({ ...editedData, time: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.scheduledTime}</p>
                  )}
                </div>
              </div>

              {/* Reason/Purpose */}
              <div>
                <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                  Reason/Purpose
                </label>
                <p className="text-sm text-secondary-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg">
                  {appointment.reason}
                </p>
              </div>

              {/* Submission Details */}
              <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Submitted On</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{appointment.submittedDate}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                    appointment.status === 'Pending'
                      ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                      : appointment.status === 'Approved' || appointment.status === 'Scheduled'
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                      : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                  }`}>
                    {appointment.status}
                  </span>
                </div>
              </div>

              {/* Staff Notes (Rejection/Cancellation Reason) */}
              {appointment.notes && (appointment.status === 'Rejected' || appointment.status?.startsWith('Cancelled')) && (
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    {appointment.status === 'Rejected' ? 'Rejection Reason' : 'Cancellation Reason'}
                  </label>
                  <p className="text-sm text-secondary-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg whitespace-pre-wrap">
                    {appointment.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="border border-error-200 dark:border-error-800 rounded-lg overflow-hidden bg-error-50 dark:bg-error-900/20">
              <div className="px-4 py-3 border-b border-error-200 dark:border-error-800">
                <h3 className="text-sm font-semibold text-error-900 dark:text-error-400">Reason for Rejection</h3>
              </div>
              <div className="p-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  rows={3}
                  placeholder="Please provide a reason for rejecting this appointment..."
                  className="w-full px-3 py-2 text-sm border border-error-300 dark:border-error-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-error-500 focus:border-error-500"
                />
                {rejectError && (
                  <p className="mt-2 text-xs text-error-700 dark:text-error-400">
                    {rejectError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </>
          ) : showRejectForm ? (
            <>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                  setRejectError('');
                }}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </>
          ) : appointment.status === 'Pending' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRejectForm(true);
                    setRejectError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept
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

export default AppointmentDetailsModal;
