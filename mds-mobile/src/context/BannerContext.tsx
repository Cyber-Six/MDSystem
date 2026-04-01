import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { bannerService } from '../core';

interface Banner {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  statusCode?: number;
}

interface ShowBannerOptions {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface BannerContextType {
  banners: Banner[];
  showBanner: (options: ShowBannerOptions) => void;
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
    const unsubscribe = bannerService.subscribe(setBanners);
    return () => unsubscribe();
  }, []);

  const showBanner = useCallback((options: ShowBannerOptions) => {
    bannerService.showBanner({
      type: options.type,
      message: options.message,
      duration: options.duration ?? 5000,
    });
  }, []);

  const dismissBanner = useCallback((id: string) => {
    bannerService.dismissBanner(id as any);
  }, []);

  const clearAllBanners = useCallback(() => {
    bannerService.clearAllBanners();
  }, []);

  return (
    <BannerContext.Provider value={{ banners, showBanner, dismissBanner, clearAllBanners }}>
      {children}
    </BannerContext.Provider>
  );
};

export const useBanner = (): BannerContextType => {
  const context = useContext(BannerContext);
  if (context === undefined) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
};
