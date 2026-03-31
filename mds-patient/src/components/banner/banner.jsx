import React, { useState, useCallback } from 'react';
import { useBanner } from '../../context/use-banner.js';
import styles from './banner.module.css';

const SLIDE_OUT_DURATION = 320; // ms — must match CSS animation duration

const Banner = () => {
  const { banners, dismissBanner } = useBanner();
  const [exitingIds, setExitingIds] = useState(new Set());

  /**
   * Animated dismiss: plays slide-right exit animation then removes from service.
   */
  const triggerDismiss = useCallback((id) => {
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

  if (banners.length === 0 && exitingIds.size === 0) {
    return null;
  }

  return (
    <div className={styles.bannerContainer}>
      {banners.map((banner) => (
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

