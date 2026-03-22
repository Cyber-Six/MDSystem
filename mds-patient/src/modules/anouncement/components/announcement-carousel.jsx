import React, { useState, useEffect } from 'react';
import { fetchActiveAnnouncements } from '../announcement-service';
import AnnouncementModal from './announcement-modal';

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

  // Auto-rotate announcements every 5 seconds
  useEffect(() => {
    if (announcements.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [announcements.length]);

  const handlePrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? announcements.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Announcements</h3>
        <div className="animate-pulse">
          <div className="h-24 bg-gray-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || announcements.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Announcements</h3>
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          {error || 'No announcements at this time'}
        </p>
      </div>
    );
  }

  const currentAnnouncement = announcements[currentIndex];

  return (
    <>
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
        {/* Announcement Content */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-700">
          <div
            className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-neutral-800 dark:to-neutral-700 rounded-lg min-h-24 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedAnnouncement(currentAnnouncement)}
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
                {currentAnnouncement.label || 'Announcement'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                {currentAnnouncement.description || 'No description available'}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(currentAnnouncement.created_at).toLocaleDateString()}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Read more →
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        {announcements.length > 1 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-800 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
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
                      ? 'w-4 bg-blue-500'
                      : 'w-1.5 bg-gray-400 dark:bg-gray-500 hover:bg-gray-500 dark:hover:bg-gray-400'
                  }`}
                  aria-label={`Go to announcement ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
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
          <div className="px-4 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
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
