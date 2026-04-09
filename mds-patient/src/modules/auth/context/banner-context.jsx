import React, { createContext, useState, useEffect, useRef } from 'react';
import { bannerService } from '../packages-core-adapter.js';

const BannerContext = createContext();

export default BannerContext;

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
