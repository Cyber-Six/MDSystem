/**
 * Core Service Setup for React Native (TypeScript)
 * 
 * This file creates React Native-specific implementations of the @mdsystem/core services
 * by injecting mobile-specific dependencies (AsyncStorage, navigation, etc.)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
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

// Get hostname from environment or config
const getHostname = (): string => {
  // TODO: Replace with your environment config (react-native-config or similar)
  // For now, return a default based on __DEV__
  if (__DEV__) {
    return 'localhost'; // or 'patient.mdsystemtip.space' for dev
  }
  return 'patient.mdsystemtip.space'; // or your production domain
};

// Get environment variable
const getEnv = (key: string): string | undefined => {
  // TODO: Replace with react-native-config when needed
  // import Config from 'react-native-config';
  // return Config[key];
  
  // For now, return defaults
  const envVars: Record<string, string> = {
    API_BASE_URL: __DEV__ ? 'http://localhost:3000' : 'https://api.mdsystemtip.space',
  };
  return envVars[key];
};

// 1. Create API base URL provider with React Native dependencies
export const apiBaseUrlProvider = createApiBaseUrlProvider({
  getHostname,
  getEnv,
}) as any; // Type assertion for JS module

// 2. Create token service with AsyncStorage and navigation
export const tokenService = createTokenService({
  storage: AsyncStorage, // AsyncStorage returns promises automatically
  navigator: {
    navigate: (path: string) => {
      if (navigationRef) {
        // Navigate using your navigation reference
        // Example: navigationRef.navigate('Login');
        navigationRef.navigate('Auth'); // Adjust based on your route names
      }
    },
  },
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
}) as any; // Type assertion for JS module

// 3. Create banner service instance
export const bannerService = new BannerService() as any;

// 4. Create axios instance with all dependencies
export const axiosRequest: AxiosInstance = createAxiosRequestHandler({
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner: any) => bannerService.showBanner(banner),
});

// Export convenience methods
export const getApiBaseUrl = apiBaseUrlProvider.getApiBaseUrl;
export const getDevSubdomain = apiBaseUrlProvider.getDevSubdomain;
export const TokenStorage = tokenService.TokenStorage;
export const refreshAccessToken = tokenService.refreshAccessToken;
export const logout = tokenService.logout;
export const isAuthenticated = tokenService.isAuthenticated;
