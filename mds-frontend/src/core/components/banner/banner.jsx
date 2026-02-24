import React from 'react';
import { useBanner } from '@core/context/banner-context.jsx';
import styles from './banner.module.css';

const Banner = () => {
  const { banners, dismissBanner } = useBanner();

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className={styles.bannerContainer}>
      {banners.map((banner) => (
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
