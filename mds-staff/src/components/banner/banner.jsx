import React, { useEffect, useRef } from 'react';
import { useBanner } from '../../context/use-banner.js';
import { getStaffSettings } from '../../context/settings-context.jsx';
import styles from './banner.module.css';

const Banner = () => {
  const { banners, dismissBanner } = useBanner();
  const timersRef = useRef({});

  // Auto-dismiss banners based on user settings
  useEffect(() => {
    const userSettings = getStaffSettings();
    if (!userSettings.bannerAutoDismiss || !userSettings.showBanners) return;

    const delay = (userSettings.bannerDismissDelay || 5) * 1000;

    banners.forEach((banner) => {
      if (!timersRef.current[banner.id]) {
        timersRef.current[banner.id] = setTimeout(() => {
          dismissBanner(banner.id);
          delete timersRef.current[banner.id];
        }, delay);
      }
    });

    return () => {
      // Clean up timers for banners that no longer exist
      const currentIds = new Set(banners.map((b) => b.id));
      Object.keys(timersRef.current).forEach((id) => {
        if (!currentIds.has(id)) {
          clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
      });
    };
  }, [banners, dismissBanner]);

  if (banners.length === 0) {
    return null;
  }

  // If banners are disabled, only show error banners (critical)
  const userSettings = getStaffSettings();
  const visibleBanners = userSettings.showBanners
    ? banners
    : banners.filter((b) => b.type === 'error');

  if (visibleBanners.length === 0) {
    return null;
  }

  return (
    <div className={styles.bannerContainer}>
      {visibleBanners.map((banner) => (
        <div
          key={banner.id}
          className={`${styles.banner} ${styles[banner.type]}`}
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
              onClick={() => dismissBanner(banner.id)}
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
