import React from 'react';

/**
 * Announcement Modal Component - Patient Version (Read-only)
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
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-neutral-800 dark:to-neutral-700 px-6 py-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {announcement.label || 'Announcement'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Posted on {formattedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
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
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {announcement.description}
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No description available
              </p>
            )}
          </div>

          {/* Attachment */}
          {announcement.pubmat && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Attachment
              </h4>
              <a
                href={`/media/record/announcement/${announcement.pubmat}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Material
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-neutral-700 px-6 py-3 bg-gray-50 dark:bg-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-neutral-600 text-gray-800 dark:text-white text-sm font-medium rounded hover:bg-gray-400 dark:hover:bg-neutral-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
