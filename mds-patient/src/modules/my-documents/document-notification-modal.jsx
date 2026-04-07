import React from 'react';

/**
 * Document Notification Modal
 * Shows patient notifications when their document request is approved or rejected
 * Similar pattern to medicine request notification modal
 */
const DocumentNotificationModal = ({ document, onDismiss }) => {
  if (!document) return null;

  const isApproved = document.status?.toLowerCase() === 'recorded'; // Recorded = Approved
  const isRejected = document.status?.toLowerCase() === 'rejected';

  if (!isApproved && !isRejected) return null;

  const documentType = document.type || 'document';
  const documentLabel = document.label || documentType;
  const notes = document.notes || '';
  const submittedAt = document.submittedAt || document.created_at;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isApproved ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-success-700 dark:text-success-400">Document Approved</h2>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-error-700 dark:text-error-400">Document Rejected</h2>
            </>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3 mb-5">
          {/* Status Message */}
          <p className="text-sm text-secondary-700 dark:text-neutral-300">
            {isApproved
              ? `Your ${documentLabel} has been approved and recorded in the system.`
              : `Your ${documentLabel} has been rejected.`}
          </p>

          {/* Document Details */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Document Type</span>
              <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">{documentLabel}</span>
            </div>
            {document.id && (
              <div className="flex justify-between">
                <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Document ID</span>
                <span className="text-xs font-mono text-secondary-700 dark:text-neutral-300">#{document.id}</span>
              </div>
            )}
            {submittedAt && (
              <div className="flex justify-between">
                <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Submitted</span>
                <span className="text-xs text-secondary-700 dark:text-neutral-300">
                  {new Date(submittedAt).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {notes && (
            <div className={`border rounded-lg p-3 ${
              isApproved
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-900/50'
                : 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-900/50'
            }`}>
              <p className={`text-[10px] uppercase tracking-wider font-medium mb-2 ${
                isApproved
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-error-600 dark:text-error-400'
              }`}>
                {isApproved ? 'Staff Notes' : 'Rejection Reason'}
              </p>
              <p className={`text-xs break-words whitespace-pre-wrap ${
                isApproved
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-error-700 dark:text-error-300'
              }`}>
                {notes}
              </p>
            </div>
          )}

          {/* Additional Instructions */}
          {isApproved && (
            <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-900/50 rounded-lg p-3">
              <p className="text-xs text-success-700 dark:text-success-300">
                Your document has been successfully recorded. You can view it anytime in your documents list.
              </p>
            </div>
          )}

          {isRejected && (
            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-900/50 rounded-lg p-3">
              <p className="text-xs text-error-700 dark:text-error-300">
                Please review the rejection reason above and submit a corrected version if needed.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onDismiss}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default DocumentNotificationModal;
