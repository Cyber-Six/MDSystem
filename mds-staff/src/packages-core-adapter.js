/**
 * Core Service Setup for Web
 * 
 * This file creates web-specific implementations of the @mdsystem/core services
 * by injecting browser-specific dependencies (localStorage, window.location, etc.)
 */

import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
import { createTokenService } from '@mdsystem/core/services/token-service';
import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
import * as bannerConfig from '@mdsystem/core/config/banner-config';
import { BannerService } from '@mdsystem/core/services/banner-service';

// 1. Create API base URL provider with web dependencies
export const apiBaseUrlProvider = createApiBaseUrlProvider({
  getHostname: () => window.location.hostname,
  getEnv: (key) => import.meta.env[`VITE_${key}`]
});

// 2. Create token service with localStorage and window.location
export const tokenService = createTokenService({
  storage: localStorage,
  navigator: { 
    navigate: (path) => { 
      window.location.assign(path); // Assign instead of href to properly trigger navigation
    } 
  },
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  tokenNamespace: 'staff'
});

// 3. Create banner service instance
export const bannerService = new BannerService();

// 4. Create axios instance with all dependencies
export const axiosRequest = createAxiosRequestHandler({
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner) => bannerService.showBanner(banner)
});

// Export convenience methods
export const { getApiBaseUrl, getDevSubdomain } = apiBaseUrlProvider;
export const { TokenStorage, refreshAccessToken, isAccessTokenExpired, logout, isAuthenticated } = tokenService;
