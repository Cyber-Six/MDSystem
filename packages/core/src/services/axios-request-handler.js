/**
 * Axios Request Handler Factory
 * Platform-agnostic HTTP client with automatic token refresh
 * 
 * Creates configured axios instance with interceptors for:
 * - Automatic token injection
 * - Token refresh on 401 errors
 * - Banner notifications for responses
 * - Request queuing during token refresh
 * 
 * @module axios-request-handler
 */

import axios from 'axios';
import { createRequestLogger } from './console-request-logger.js';

/**
 * Creates an axios instance with platform-specific dependencies
 * 
 * @param {Object} dependencies - Platform-specific dependencies
 * @param {Function} dependencies.getApiBaseUrl - Function that returns API base URL
 * @param {Function} dependencies.getDevSubdomain - Function that returns dev subdomain (or null)
 * @param {Object} dependencies.tokenService - Token service instance from createTokenService
 * @param {Object} dependencies.bannerConfig - Banner configuration module
 * @param {Function} dependencies.bannerConfig.shouldShowBanner - Check if status code should show banner
 * @param {Function} dependencies.bannerConfig.getBannerType - Get banner type for status code
 * @param {Function} dependencies.bannerConfig.extractBannerData - Extract error/message from response
 * @param {Function} dependencies.onShowBanner - Callback to show banner notification
 * 
 * @returns {import('axios').AxiosInstance} Configured axios instance
 * 
 * @example
 * // Web implementation
 * import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
 * import * as bannerConfig from '@mdsystem/core/config/banner-config';
 * 
 * const axiosRequest = createAxiosRequestHandler({
 *   getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
 *   getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
 *   tokenService,
 *   bannerConfig,
 *   onShowBanner: (banner) => bannerManager.showBanner(banner)
 * });
 * 
 * // Use like normal axios
 * const response = await axiosRequest.get('/api/users');
 * 
 * @example
 * // React Native implementation
 * import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
 * import * as bannerConfig from '@mdsystem/core/config/banner-config';
 * 
 * const axiosRequest = createAxiosRequestHandler({
 *   getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
 *   getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
 *   tokenService,
 *   bannerConfig,
 *   onShowBanner: (banner) => showToast(banner.message) // RN toast/notification
 * });
 */
export const createAxiosRequestHandler = ({
  getApiBaseUrl,
  getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner
}) => {
  // ============================================
  // DEBUG LOGGING
  // Auto-enabled on localhost, auto-disabled in production
  // Set forceEnabled: true to enable logging in production
  // ============================================
  const computedBaseURL = getApiBaseUrl();
  const requestLogger = createRequestLogger({
    forceEnabled: undefined, // Set to true to force enable in production, false to force disable
    computedBaseURL,
    getDevSubdomain,
  });
  // ============================================

  // Create axios instance with relative URLs and 1-minute timeout
  const axiosRequest = axios.create({
    baseURL: computedBaseURL,
    timeout: 45000, // timeout for all requests
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  });

  // Flag to prevent multiple simultaneous refresh requests
  let isRefreshing = false;
  let failedQueue = [];

  /**
   * Process queued requests after token refresh
   * @private
   */
  const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  // Request interceptor - inject auth token and subdomain headers
  axiosRequest.interceptors.request.use(
    async (config) => {
      // Inject access token if available (handles both sync and async storage)
      const token = await Promise.resolve(tokenService.TokenStorage.getAccessToken());
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add X-Forwarded-Host for backend portal detection
      // Dev: Maps localhost → www/staff.mdsystemtip.space
      // Prod: Normalizes www2/staff2 → www/staff
      const devSubdomain = getDevSubdomain();
      if (devSubdomain) {
        config.headers['X-Forwarded-Host'] = devSubdomain;
      }
      
      requestLogger.logRequest(config);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle token refresh and error notifications
  axiosRequest.interceptors.response.use(
    (response) => {
      // Show banner notification for configured status codes
      if (onShowBanner && bannerConfig.shouldShowBanner(response.status)) {
        const { error, message } = bannerConfig.extractBannerData(response);
        onShowBanner({
          type: bannerConfig.getBannerType(response.status),
          error,
          message,
        });
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh');
      
      // Handle 401 errors with automatic token refresh (skip if already retrying or is refresh endpoint)
      if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
        // Queue request if refresh is already in progress
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosRequest(originalRequest);
          });
        }

        // Attempt to refresh the token
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newAccessToken = await tokenService.refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          isRefreshing = false;
          
          return axiosRequest(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          
          // Show session expired banner
          if (onShowBanner) {
            onShowBanner({
              type: 'error',
              error: refreshError.code || 'SESSION_EXPIRED',
              message: refreshError.message || 'Your session has expired. Please log in again.',
              duration: 0,
            });
          }
          
          // Logout after brief delay to show banner
          setTimeout(() => tokenService.logout(true), 1000);
          return Promise.reject(refreshError);
        }
      }

      // Handle other HTTP errors
      if (error.response) {
        if (onShowBanner && bannerConfig.shouldShowBanner(error.response.status)) {
          const { error: errorCode, message } = bannerConfig.extractBannerData(error.response);
          onShowBanner({
            type: bannerConfig.getBannerType(error.response.status),
            error: errorCode,
            message,
          });
        }
      } else if (error.request && onShowBanner) {
        // Network error - no response received
        onShowBanner({
          type: 'error',
          error: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your internet connection.',
        });
      }
      
      return Promise.reject(error);
    }
  );

  return axiosRequest;
};
