import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { bannerService } from '../packages-core-adapter.js';

const BannerContext = createContext();

export const BannerProvider = ({ children }) => {
  const [banners, setBanners] = useState([]);
  const bannerServiceRef = useRef(bannerService);

  // Subscribe to banner service updates
  useEffect(() => {
    const unsubscribe = bannerServiceRef.current.subscribe(setBanners);
    return unsubscribe;
  }, []);

  // Create wrapper functions that use the banner service
  const showBanner = (banner) => {
    return bannerServiceRef.current.showBanner(banner);
  };

  const dismissBanner = (id) => {
    bannerServiceRef.current.dismissBanner(id);
  };

  const clearAllBanners = () => {
    bannerServiceRef.current.clearAllBanners();
  };

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
