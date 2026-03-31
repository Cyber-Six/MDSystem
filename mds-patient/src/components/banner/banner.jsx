import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBanner } from '../../context/use-banner.js';
import styles from './banner.module.css';

const SLIDE_OUT_DURATION = 320; // ms — must match CSS animation duration
const AUTO_DISMISS_DELAY = 5000; // 5 s default for patient portal

const Banner = () => {
  const { banners, dismissBanner } = useBanner();
  const autoDismissTimersRef = useRef({});
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

  /**
   * Auto-dismiss: the banner service no longer owns auto-dismiss (duration: 0),
   * so the component drives it here with the slide-right animation.
   */
  useEffect(() => {
    banners.forEach((banner) => {
      const key = String(banner.id);
      if (!autoDismissTimersRef.current[key]) {
        autoDismissTimersRef.current[key] = setTimeout(() => {
          triggerDismiss(banner.id);
          delete autoDismissTimersRef.current[key];
        }, AUTO_DISMISS_DELAY);
      }
    });

    return () => {
      const currentKeys = new Set(banners.map((b) => String(b.id)));
      Object.keys(autoDismissTimersRef.current).forEach((key) => {
        if (!currentKeys.has(key)) {
          clearTimeout(autoDismissTimersRef.current[key]);
          delete autoDismissTimersRef.current[key];
        }
      });
    };
  }, [banners, triggerDismiss]);

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
            <span className={styles.icon}>
              {banner.type === 'success' && '✓'}
              {banner.type === 'error' && '✕'}
              {banner.type === 'info' && 'ℹ'}
            </span>
            <div className={styles.textContent}>
              {banner.error && (
                <div className={styles.errorCode}>{banner.error}</div>
              )}
              <div className={styles.message}>{banner.message}</div>
            </div>
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

