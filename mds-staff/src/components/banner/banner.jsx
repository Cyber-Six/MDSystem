import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBanner } from '../../context/use-banner.js';
import { getStaffSettings } from '../../context/settings-context.jsx';
import styles from './banner.module.css';

const SLIDE_OUT_DURATION = 320; // ms — must match CSS animation duration

const Banner = () => {
  const { banners, dismissBanner } = useBanner();
  const autoDismissTimersRef = useRef({});
  const [exitingIds, setExitingIds] = useState(new Set());

  /**
   * Animated dismiss: plays slide-right exit animation then removes from service.
   */
  const triggerDismiss = useCallback((id) => {
    // Avoid double-triggering
    setExitingIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });
    setTimeout(() => {
      dismissBanner(id);
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, SLIDE_OUT_DURATION);
  }, [dismissBanner]);

  /**
   * Auto-dismiss: read settings and set timers for visible banners.
   * Re-runs whenever banners list changes.
   */
  useEffect(() => {
    const s = getStaffSettings();
    if (!s.showBanners || !s.bannerAutoDismiss) return;

    const delay = Math.max(1, s.bannerDismissDelay || 5) * 1000;

    banners.forEach((banner) => {
      if (!autoDismissTimersRef.current[banner.id]) {
        autoDismissTimersRef.current[banner.id] = setTimeout(() => {
          triggerDismiss(banner.id);
          delete autoDismissTimersRef.current[banner.id];
        }, delay);
      }
    });

    return () => {
      // Clear timers for banners that were removed externally (e.g. dismissed by button)
      const currentIds = new Set(banners.map((b) => b.id));
      Object.keys(autoDismissTimersRef.current).forEach((timerId) => {
        if (!currentIds.has(timerId)) {
          clearTimeout(autoDismissTimersRef.current[timerId]);
          delete autoDismissTimersRef.current[timerId];
        }
      });
    };
  }, [banners, triggerDismiss]);

  // Nothing at all to show (including exit animations)
  if (banners.length === 0 && exitingIds.size === 0) return null;

  const s = getStaffSettings();

  // Apply banner visibility filters
  let visibleBanners = banners;

  if (!s.showBanners) {
    // Banners disabled — show only critical errors
    visibleBanners = banners.filter((b) => b.type === 'error');
  } else if (s.bannerErrorsOnly) {
    // Errors-only mode — suppress success/info
    visibleBanners = visibleBanners.filter((b) => b.type === 'error');
  }

  // Compact mode — cap how many show at once (keep the most recent N)
  if (s.bannerCompact) {
    const max = Math.max(1, s.bannerMaxVisible || 3);
    visibleBanners = visibleBanners.slice(-max);
  }

  if (visibleBanners.length === 0 && exitingIds.size === 0) return null;

  return (
    <div className={styles.bannerContainer}>
      {visibleBanners.map((banner) => (
        <div
          key={banner.id}
          className={`${styles.banner} ${styles[banner.type]}${exitingIds.has(banner.id) ? ` ${styles.exiting}` : ''}`}
          role="alert"
        >
          <div className={styles.bannerContent}>
            {/* Icon based on type */}
            <span className={styles.icon}>
              {banner.type === 'success' && '✓'}
              {banner.type === 'error' && '✕'}
              {banner.type === 'info' && 'ℹ'}
            </span>

            {/* Message and Error Code */}
            <div className={styles.textContent}>
              {banner.error && (
                <div className={styles.errorCode}>{banner.error}</div>
              )}
              <div className={styles.message}>{banner.message}</div>
            </div>

            {/* Close Button */}
            <button
              className={styles.closeButton}
              onClick={() => triggerDismiss(banner.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Banner;

