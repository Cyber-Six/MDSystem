import React from 'react';

/**
 * Announcement Modal Component
 * Displays full announcement details
 */
const AnnouncementModal = ({ announcement, onClose }) => {
  if (!announcement) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format date
  const formattedDate = new Date(announcement.created_at).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-secondary-800 dark:text-white">
              {announcement.label || 'Announcement'}
            </h2>
            <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
              Posted on {formattedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-secondary-500 hover:text-secondary-700 dark:text-neutral-400 dark:hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="prose dark:prose-invert max-w-none">
            {announcement.description ? (
              <p className="text-sm text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {announcement.description}
              </p>
            ) : (
              <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
                No description available
              </p>
            )}
          </div>

          {/* Attachment */}
          {announcement.pubmat && (
            <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-200 dark:border-neutral-600">
              <h4 className="text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                Attachment
              </h4>
              <a
                href={`/media/announcement/${announcement.pubmat}`}
                download
                className="inline-flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Download Material
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 dark:border-neutral-700 px-6 py-3 bg-neutral-50 dark:bg-neutral-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-300 dark:bg-neutral-600 text-secondary-800 dark:text-white text-sm font-medium rounded hover:bg-neutral-400 dark:hover:bg-neutral-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
