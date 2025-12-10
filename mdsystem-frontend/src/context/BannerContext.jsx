import React, { createContext, useContext, useState, useCallback } from 'react';

const BannerContext = createContext();

export const BannerProvider = ({ children }) => {
  const [banners, setBanners] = useState([]);

  /**
   * Dismiss a specific banner by ID
   */
  const dismissBanner = useCallback((id) => {
    setBanners((prev) => prev.filter((banner) => banner.id !== id));
  }, []);

  /**
   * Add a new banner notification
   * @param {Object} banner - Banner configuration
   * @param {string} banner.type - 'success', 'error', or 'info' (maps to green, red, grey)
   * @param {string} banner.message - Main message to display
   * @param {string} [banner.error] - Error code (optional)
   * @param {number} [banner.duration] - Auto-dismiss duration in ms (default: 5000, 0 for no auto-dismiss)
   */
  const showBanner = useCallback((banner) => {
    const id = Date.now() + Math.random();
    const newBanner = {
      id,
      type: banner.type || 'info',
      message: banner.message || 'An action occurred',
      error: banner.error || null,
      duration: banner.duration !== undefined ? banner.duration : 5000,
    };

    setBanners((prev) => [...prev, newBanner]);

    // Auto-dismiss if duration > 0
    if (newBanner.duration > 0) {
      setTimeout(() => {
        dismissBanner(id);
      }, newBanner.duration);
    }

    return id;
  }, [dismissBanner]);

  /**
   * Clear all banners
   */
  const clearAllBanners = useCallback(() => {
    setBanners([]);
  }, []);

  const value = {
    banners,
    showBanner,
    dismissBanner,
    clearAllBanners,
  };

  return (
    <BannerContext.Provider value={value}>
      {children}
    </BannerContext.Provider>
  );
};

export const useBanner = () => {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
};
