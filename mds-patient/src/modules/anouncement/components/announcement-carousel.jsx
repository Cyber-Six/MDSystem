import React, { useState, useEffect } from 'react';
import { fetchActiveAnnouncements } from '../announcement-service';
import { axiosRequest } from '../../../packages-core-adapter';
import AnnouncementModal from './announcement-modal';

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
 * Announcement Carousel Component - Patient Version (Read-only)
 * Displays active announcements on the patient dashboard
 */
const AnnouncementCarousel = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch announcements on mount
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        setIsLoading(true);
        const data = await fetchActiveAnnouncements();
        setAnnouncements(data);
        setError(null);
      } catch (err) {
        setError('Failed to load announcements');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  const goTo = (indexOrFn) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(indexOrFn);
      setIsTransitioning(false);
    }, 200);
  };

  // Auto-rotate announcements every 5 seconds
  useEffect(() => {
    if (announcements.length === 0) return;

    const timer = setInterval(() => {
      goTo((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [announcements.length]);

  const handlePrevious = () => {
    goTo((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
  };

  const handleNext = () => {
    goTo((prev) => (prev + 1) % announcements.length);
  };

  const handleDotClick = (index) => {
    goTo(index);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Announcements</h3>
        <div className="animate-pulse">
          <div className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || announcements.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Announcements</h3>
        <p className="text-xs text-secondary-500 dark:text-neutral-400">
          {error || 'No announcements at this time'}
        </p>
      </div>
    );
  }

  const currentAnnouncement = announcements[currentIndex];

  return (
    <>
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Announcement Content */}
        <div
          className={`p-5 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-800 min-h-32 flex gap-4 cursor-pointer hover:shadow-md transition-all duration-300 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={() => setSelectedAnnouncement(currentAnnouncement)}
        >
          {/* Text Content */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="text-base font-bold text-secondary-800 dark:text-white mb-2">
                {currentAnnouncement.label || 'Announcement'}
              </h3>
              <p className="text-sm text-secondary-600 dark:text-neutral-300 line-clamp-3">
                {currentAnnouncement.description || 'No description available'}
              </p>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-secondary-500 dark:text-neutral-400">
                {new Date(currentAnnouncement.created_at).toLocaleDateString()}
              </span>
              <span className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                Read more →
              </span>
            </div>
          </div>
          {/* Pubmat Image */}
          {currentAnnouncement.pubmat && (
            <div className="flex-shrink-0">
              <AuthImage
                path={`/media/record/announcement/${currentAnnouncement.pubmat}`}
                alt={currentAnnouncement.label || 'Announcement image'}
                className="w-28 h-28 object-cover rounded border border-neutral-200 dark:border-neutral-600"
              />
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        {announcements.length > 1 && (
          <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-700 border-t border-neutral-200 dark:border-neutral-600 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              className="p-1 text-secondary-500 hover:text-secondary-700 dark:text-neutral-400 dark:hover:text-white transition-colors"
              aria-label="Previous announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Dot Indicators */}
            <div className="flex gap-1">
              {announcements.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentIndex
                      ? 'w-4 bg-primary-500'
                      : 'w-1.5 bg-neutral-400 dark:bg-neutral-500 hover:bg-neutral-500 dark:hover:bg-neutral-400'
                  }`}
                  aria-label={`Go to announcement ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-1 text-secondary-500 hover:text-secondary-700 dark:text-neutral-400 dark:hover:text-white transition-colors"
              aria-label="Next announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Counter */}
        {announcements.length > 1 && (
          <div className="px-4 py-1.5 text-right text-xs text-secondary-500 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-600">
            {currentIndex + 1} of {announcements.length}
          </div>
        )}
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <AnnouncementModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </>
  );
};

export default AnnouncementCarousel;
