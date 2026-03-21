import React, { useState } from 'react';

/**
 * Request Action Modal
 * Reusable modal for approving or rejecting medicine requests with optional notes
 */
const RequestActionModal = ({ request, action, onConfirm, onCancel }) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const isApprove = action?.toLowerCase() === 'approve';
  const isReject = action?.toLowerCase() === 'reject';

  if (!isApprove && !isReject) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(request, notes || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format date
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        if (/^\d+$/.test(trimmed)) {
          const numeric = Number(trimmed);
          date = new Date(trimmed.length >= 13 ? numeric : numeric * 1000);
        } else {
          date = new Date(trimmed);
        }
      } else {
        date = dateValue;
      }
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (err) {
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isApprove ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-success-700 dark:text-success-400">Approve Request</h2>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-error-700 dark:text-error-400">Reject Request</h2>
            </>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4 mb-5">
          {/* Request Info */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-3">
            {/* Request ID */}
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Request ID</p>
              <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300">#{request.id}</p>
            </div>

            {/* Date */}
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Date Created</p>
              <p className="text-xs text-secondary-600 dark:text-neutral-400">{formatDate(request.created_at)}</p>
            </div>

            {/* Purpose */}
            {request.purpose && (
              <div>
                <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Purpose</p>
                <p className="text-xs text-secondary-600 dark:text-neutral-400 break-words whitespace-pre-wrap">{request.purpose}</p>
              </div>
            )}

            {/* Medicines */}
            {request.items?.length > 0 && (
              <div>
                <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Medicines</p>
                <div className="space-y-1.5">
                  {request.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between text-xs bg-white dark:bg-neutral-700/50 p-2 rounded border border-neutral-200 dark:border-neutral-600">
                      <span className="text-secondary-600 dark:text-neutral-300 font-medium flex-1">
                        {item.itemName || `Medicine #${item.medicineId || item.batchId}`}
                      </span>
                      <span className="text-secondary-500 dark:text-neutral-400 ml-2">
                        {item.quantity} unit{item.quantity > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              {isReject ? 'Reason for Rejection' : 'Notes'} (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isReject 
                ? 'e.g., Out of stock, Expired, Incorrect dosage...' 
                : 'e.g., Available at clinic, pick up from counter...'}
              rows={3}
              className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isApprove
                ? 'bg-success-500 hover:bg-success-600'
                : 'bg-error-500 hover:bg-error-600'
            }`}
          >
            {isSubmitting ? 'Processing...' : (isApprove ? 'Approve' : 'Reject')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestActionModal;
