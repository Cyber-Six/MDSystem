import React, { useState } from 'react';

/* ─── Image Preview Modal ──────────────────────────────────────── */
function ImagePreviewModal({ image, onClose }) {
  if (!image) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-neutral-300 transition-colors"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={image.url}
          alt={image.description || 'Teeth image'}
          className="w-full h-full object-contain rounded-lg"
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
          <p className="text-white text-sm">{image.description}</p>
          <p className="text-neutral-400 text-xs mt-1">
            Submitted: {new Date(image.submittedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Submission Card ──────────────────────────────────────────── */
function SubmissionCard({ submission, onVerify, onDismiss, onImageClick }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerify = async () => {
    setIsProcessing(true);
    try {
      await onVerify(submission.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (confirm('Dismiss this submission without updating the chart?')) {
      setIsProcessing(true);
      try {
        await onDismiss(submission.id);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="border border-warning-200 dark:border-warning-800/50 bg-warning-50/50 dark:bg-warning-900/10 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <button
          onClick={() => onImageClick(submission.images[0])}
          className="relative w-20 h-20 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0 group"
        >
          <img
            src={submission.images[0]?.url || '/placeholder-teeth.jpg'}
            alt="Teeth submission"
            className="w-full h-full object-cover"
          />
          {submission.images.length > 1 && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded">
              +{submission.images.length - 1}
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">
                {submission.title || 'Teeth Photo Submission'}
              </p>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <span className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-[10px] font-medium rounded-full">
              Pending
            </span>
          </div>

          {submission.notes && (
            <p className="text-xs text-secondary-600 dark:text-neutral-400 mt-2 line-clamp-2">
              {submission.notes}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleVerify}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-medium bg-success-500 hover:bg-success-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isProcessing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Verify & Update Chart
            </button>
            <button
              onClick={handleDismiss}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Multiple images row */}
      {submission.images.length > 1 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-warning-200 dark:border-warning-800/30 overflow-x-auto">
          {submission.images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => onImageClick(img)}
              className="w-14 h-14 rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0 hover:ring-2 ring-primary-500 transition-all"
            >
              <img
                src={img.url}
                alt={`Teeth ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function PendingDentalSubmissions({
  submissions = [],
  onVerify,
  onDismiss,
  onRefresh
}) {
  const [previewImage, setPreviewImage] = useState(null);

  if (submissions.length === 0) {
    return null; // Don't render if no pending submissions
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 bg-warning-500 text-white text-[10px] font-bold rounded-full">
              {submissions.length}
            </span>
            <span className="text-xs text-secondary-600 dark:text-neutral-400">
              pending verification
            </span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>

        {submissions.map(submission => (
          <SubmissionCard
            key={submission.id}
            submission={submission}
            onVerify={onVerify}
            onDismiss={onDismiss}
            onImageClick={setPreviewImage}
          />
        ))}
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
