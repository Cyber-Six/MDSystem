import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { bannerService } from '../core';

interface Banner {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  statusCode?: number;
}

interface BannerContextType {
  banners: Banner[];
  dismissBanner: (id: string) => void;
  clearAllBanners: () => void;
}

export const BannerContext = createContext<BannerContextType | undefined>(undefined);

interface BannerProviderProps {
  children: ReactNode;
}

export const BannerProvider: React.FC<BannerProviderProps> = ({ children }) => {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    // Subscribe to banner updates
    const unsubscribe = bannerService.subscribe(setBanners);
    return () => unsubscribe();
  }, []);

  const dismissBanner = (id: string) => {
    bannerService.dismissBanner(id as any);
  };

  const clearAllBanners = () => {
    bannerService.clearAllBanners();
  };

  return (
    <BannerContext.Provider value={{ banners, dismissBanner, clearAllBanners }}>
      {children}
    </BannerContext.Provider>
  );
};
