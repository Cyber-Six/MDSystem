/**
 * Core Service Setup for React Native (TypeScript)
 * 
 * This file creates React Native-specific implementations of the @mdsystem/core services
 * by injecting mobile-specific dependencies (AsyncStorage, navigation, etc.)
 * 
 * Unlike the web apps (which use Vite's dev proxy and relative URLs),
 * React Native MUST use absolute URLs since there is no proxy layer.
 * Both dev and production connect to the same backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTokenService } from '@mdsystem/core/services/token-service';
import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
import * as bannerConfig from '@mdsystem/core/config/banner-config';
import { BannerService } from '@mdsystem/core/services/banner-service';
import type { AxiosInstance } from 'axios';

// Navigation reference (set this from your navigation setup)
let navigationRef: any = null;

/**
 * Set navigation reference for logout redirects
 * Call this from your NavigationContainer setup
 */
export const setNavigationRef = (ref: any): void => {
  navigationRef = ref;
};

export const getNavigationRef = (): any => navigationRef;

// Session-expired callback — registered by AuthContext to react to forced logouts
type SessionExpiredCallback = () => void;
let _sessionExpiredCallback: SessionExpiredCallback | null = null;

export const registerSessionExpiredCallback = (cb: SessionExpiredCallback): void => {
  _sessionExpiredCallback = cb;
};

// ── Backend Configuration ──
// React Native has no proxy — always use the absolute backend URL.
// Reads from EXPO_PUBLIC_API_URL in .env; falls back to production URL.
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://www.mdsystemtip.space';

/**
 * Returns the absolute backend URL.
 * Web apps return '' (empty) for relative/proxy URLs, but React Native
 * must always return the full URL since there is no proxy.
 */
const getApiBaseUrl = (): string => BACKEND_URL;

/**
 * Returns the hostname for the X-Forwarded-Host header.
 * The backend uses this to detect which portal (patient vs staff) is calling.
 * Derived automatically from EXPO_PUBLIC_API_URL.
 */
const getDevSubdomain = (): string => {
  try {
    return new URL(BACKEND_URL).hostname;
  } catch {
    return 'www.mdsystemtip.space';
  }
};

// 1. Create token service with AsyncStorage and navigation
export const tokenService = createTokenService({
  storage: AsyncStorage,
  navigator: {
    navigate: (_path: string) => {
      // Notify AuthContext — flips isAuthenticated to false, which unmounts
      // the NavigationContainer and renders AuthScreen.
      if (_sessionExpiredCallback) {
        _sessionExpiredCallback();
      }
    },
  },
  getApiBaseUrl,
  tokenNamespace: 'patient',
}) as any;

// 2. Create banner service instance
export const bannerService = new BannerService() as any;

// 3. Create axios instance with all dependencies
export const axiosRequest: AxiosInstance = createAxiosRequestHandler({
  getApiBaseUrl,
  getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner: any) => bannerService.showBanner(banner),
});

// Export convenience methods
export { getApiBaseUrl, getDevSubdomain };
export const TokenStorage = tokenService.TokenStorage;
export const refreshAccessToken = tokenService.refreshAccessToken;
export const logout = tokenService.logout;
export const isAuthenticated = tokenService.isAuthenticated;
