import React, { useState, useEffect } from 'react';
import { fetchActiveAnnouncements } from '../announcement-service';
import AnnouncementModal from './announcement-modal';
import AuthenticatedAnnouncementImage from './authenticated-announcement-image';
import { formatAnnouncementDate, getAnnouncementTimeZone } from '../timezoneUtils';

/**
 * Announcement Carousel Component - Patient Version (Read-only)
 * Full-width hero image carousel with text overlay — fixed container height,
 * image always fills the frame via object-cover regardless of original dimensions.
 */

const AnnouncementCarousel = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const clientTimeZone = getAnnouncementTimeZone();

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

  useEffect(() => {
    if (announcements.length === 0) return;
    const timer = setInterval(() => {
      goTo((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  const handlePrevious = (e) => {
    e.stopPropagation();
    goTo((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    goTo((prev) => (prev + 1) % announcements.length);
  };

  const handleDotClick = (e, index) => {
    e.stopPropagation();
    goTo(index);
  };

  if (isLoading) {
    return (
      <div className="w-full h-48 sm:h-56 lg:h-64 rounded-xl bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
    );
  }

  if (error || announcements.length === 0) {
    return (
      <div className="w-full h-32 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 flex flex-col items-center justify-center gap-2">
        <svg className="w-7 h-7 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <p className="text-xs text-neutral-400">{error || 'No announcements at this time'}</p>
      </div>
    );
  }

  const currentAnnouncement = announcements[currentIndex];
  const hasMultiple = announcements.length > 1;
  const formattedDate = formatAnnouncementDate(currentAnnouncement.created_at, clientTimeZone, {
    month: 'short', day: 'numeric', year: 'numeric',
  }) || 'Unknown date';

  return (
    <>
      {/*
        Fixed-height hero carousel.
        - h-48 (mobile) → h-56 (sm) → h-64 (lg): consistent frame regardless of image ratio.
        - `group` enables hover-based arrow reveal on desktop.
        - `select-none` prevents text selection while swiping / clicking.
      */}
      <div
        className={`relative w-full h-48 sm:h-56 lg:h-64 rounded-xl overflow-hidden cursor-pointer group select-none transition-opacity duration-200 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={() => setSelectedAnnouncement(currentAnnouncement)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedAnnouncement(currentAnnouncement)}
        aria-label={`View announcement: ${currentAnnouncement.label || 'Announcement'}`}
      >
        {/* ── Background layer ─────────────────────────────────────────── */}
        {/* Gradient fallback always rendered underneath the image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500" />

        {/* Pubmat image — covers the full frame, maintains aspect via object-cover */}
        {currentAnnouncement.pubmat && (
          <AuthenticatedAnnouncementImage
            path={`/media/record/announcement/${currentAnnouncement.pubmat}`}
            alt={currentAnnouncement.label || 'Announcement image'}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        )}

        {/* ── Overlay: dark gradient from bottom, soft vignette on top ── */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

        {/* ── Top badges: "Announcement" label + date ───────────────────── */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Announcement
          </span>
          <span className="text-[10px] text-white/80 bg-black/25 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {formattedDate}
          </span>
        </div>

        {/* ── Bottom text block ─────────────────────────────────────────── */}
        <div className={`absolute left-0 right-0 bottom-0 px-4 ${hasMultiple ? 'pb-10' : 'pb-4'}`}>
          <h3
            className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-1 mb-1"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            {currentAnnouncement.label || 'Announcement'}
          </h3>
          <p
            className="text-xs text-white/80 line-clamp-2 leading-snug"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            {currentAnnouncement.description || ''}
          </p>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-white/60 mt-1.5 group-hover:text-white transition-colors duration-200">
            Read more
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        {/* ── Navigation arrows ─────────────────────────────────────────── */}
        {/* Mobile: opacity-60 always visible. Desktop (sm+): hidden until hover. */}
        {hasMultiple && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-sm flex items-center justify-center text-white opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-label="Previous announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-sm flex items-center justify-center text-white opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-label="Next announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* ── Dot indicators ────────────────────────────────────────────── */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-1.5">
            {announcements.map((_, index) => (
              <button
                key={index}
                onClick={(e) => handleDotClick(e, index)}
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-5 h-1.5 bg-white shadow'
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to announcement ${index + 1}`}
              />
            ))}
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
