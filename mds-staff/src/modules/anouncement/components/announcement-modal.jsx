import React, { useState, useEffect } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import { formatAnnouncementDate, getAnnouncementTimeZone } from '../timezoneUtils';

/* Small authenticated image loader (media endpoints require JWT) */
function AuthImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let objectUrl = null, cancelled = false;
    axiosRequest.get(path, { responseType: 'blob' })
      .then((res) => { if (!cancelled) { objectUrl = URL.createObjectURL(res.data); setSrc(objectUrl); } })
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}

/**
 * Announcement Modal Component
 * Displays full announcement details
 */
const AnnouncementModal = ({ announcement, onClose }) => {
  if (!announcement) return null;
  const clientTimeZone = getAnnouncementTimeZone();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format date
  const formattedDate = formatAnnouncementDate(announcement.created_at, clientTimeZone) || 'Unknown date';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

          {/* Pubmat Image */}
          {announcement.pubmat && (
            <div className="mt-4">
              <AuthImage
                path={`/media/record/announcement/${announcement.pubmat}`}
                alt={announcement.label || 'Announcement image'}
                className="w-full max-h-[60vh] object-contain rounded border border-neutral-200 dark:border-neutral-600"
              />
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
