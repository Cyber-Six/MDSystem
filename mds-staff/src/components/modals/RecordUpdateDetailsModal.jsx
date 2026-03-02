import React, { useState } from 'react';

/**
 * Record Update Request Details Modal
 * Displays record update request details with approve/reject actions
 */
const RecordUpdateDetailsModal = ({ request, onClose, onApprove, onReject }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!request) return null;

  const handleApprove = () => {
    onApprove?.(request.id);
    onClose();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    onReject?.(request.id, rejectReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">Record Update Request</h2>
            <p className="text-sm text-secondary-600 dark:text-neutral-400">Request ID: #{request.id}</p>
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
          {/* Patient Information */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Patient Information</h3>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Name</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Patient ID</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.patientId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Category</p>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                  request.category === 'Medical' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' :
                  request.category === 'Dental' ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400' :
                  'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                }`}>
                  {request.category}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                  request.status === 'Pending' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' :
                  request.status === 'Approved' ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400' :
                  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                }`}>
                  {request.status}
                </span>
              </div>
            </div>
          </div>

          {/* Request Details */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Update Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Submitted On</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.submitted}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Expires On</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.expires}</p>
                </div>
              </div>

              {/* Fields to Update */}
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Fields Requested for Update</p>
                <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-lg p-4 space-y-3">
                  {request.updateFields?.map((field, idx) => (
                    <div key={idx} className="pb-3 border-b border-neutral-200 dark:border-neutral-700 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-secondary-800 dark:text-white">{field.fieldName}</p>
                        <span className="text-xs text-accent-600 dark:text-accent-400 font-medium">
                          {request.category === 'Medical' ? '🏥 Medical' : 
                           request.category === 'Dental' ? '🦷 Dental' : '📋 Both'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-secondary-500 dark:text-neutral-400 mb-1">Current Value:</p>
                          <p className="text-secondary-700 dark:text-neutral-300 font-medium bg-white dark:bg-neutral-700 p-2 rounded">
                            {field.currentValue || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-secondary-500 dark:text-neutral-400 mb-1">Requested Value:</p>
                          <p className="text-primary-700 dark:text-primary-400 font-medium bg-primary-50 dark:bg-primary-900/20 p-2 rounded">
                            {field.requestedValue}
                          </p>
                        </div>
                      </div>
                      {field.reason && (
                        <div className="mt-2">
                          <p className="text-secondary-500 dark:text-neutral-400 text-xs mb-1">Reason:</p>
                          <p className="text-secondary-700 dark:text-neutral-300 text-xs italic">{field.reason}</p>
                        </div>
                      )}
                    </div>
                  )) || (
                    <p className="text-sm text-secondary-600 dark:text-neutral-400">Loading update details...</p>
                  )}
                </div>
              </div>

              {/* Supporting Documents */}
              {request.documents && request.documents.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Supporting Documents</p>
                  <div className="space-y-2">
                    {request.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-800/30 rounded-lg">
                        <svg className="w-5 h-5 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-secondary-700 dark:text-neutral-300 flex-1">{doc.name}</span>
                        <button className="text-xs text-primary-600 dark:text-primary-400 hover:underline">View</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {request.notes && (
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Additional Notes</p>
                  <p className="text-sm text-secondary-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg">
                    {request.notes}
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
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Please provide a reason for rejecting this update request..."
                  className="w-full px-3 py-2 text-sm border border-error-300 dark:border-error-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-error-500 focus:border-error-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {showRejectForm ? (
            <>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
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
          ) : request.status === 'Pending' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
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

export default RecordUpdateDetailsModal;
