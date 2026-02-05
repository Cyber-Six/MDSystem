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
  // Create axios instance with automatic base URL detection
  const axiosRequest = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies with requests
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

  // Request interceptor - add auth token if exists
  axiosRequest.interceptors.request.use(
    async (config) => {
      // SECURITY: Use TokenStorage for centralized token access
      // Handle async storage (React Native)
      const token = await Promise.resolve(tokenService.TokenStorage.getAccessToken());
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Send subdomain header for backend portal detection
      // In dev: simulates subdomain (localhost → www/staff)
      // In prod: normalizes subdomain (www2 → www, staff2 → staff)
      const devSubdomain = getDevSubdomain();
      if (devSubdomain) {
        config.headers['X-Forwarded-Host'] = devSubdomain;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle token refresh and common errors
  axiosRequest.interceptors.response.use(
    (response) => {
      // Show success banner if configured for this status code
      if (bannerConfig.shouldShowBanner(response.status)) {
        const { error, message } = bannerConfig.extractBannerData(response);
        if (onShowBanner) {
          onShowBanner({
            type: bannerConfig.getBannerType(response.status),
            error,
            message,
          });
        }
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // SECURITY: Prevent infinite loop - don't retry refresh endpoint itself
      const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');
      
      // Check if error is due to expired token (excluding refresh endpoint)
      // SECURITY: Skip banner notification for 401 during token refresh flow
      if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axiosRequest(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // SECURITY: Attempt to refresh the token
          const newAccessToken = await tokenService.refreshAccessToken();
          
          // SECURITY: Update authorization header with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          // Process queued requests with new token
          processQueue(null, newAccessToken);
          
          // SECURITY: Reset refresh flag before retry to allow new refresh if this retry fails
          isRefreshing = false;
          
          // Retry original request with new token
          return axiosRequest(originalRequest);
        } catch (refreshError) {
          // Token refresh failed - clear queue
          processQueue(refreshError, null);
          
          // SECURITY: Reset flag before redirect
          isRefreshing = false;
          
          // Show banner for failed refresh with specific error from backend
          if (onShowBanner) {
            const errorCode = refreshError.code || 'SESSION_EXPIRED';
            const errorMessage = refreshError.message || 'Your session has expired. Please log in again.';
            
            onShowBanner({
              type: 'error',
              error: errorCode,
              message: errorMessage,
              duration: 0, // Don't auto-dismiss
            });
          }
          
          // SECURITY: Use logout function to ensure complete cleanup
          // Redirect to auth after short delay to show banner
          setTimeout(() => {
            tokenService.logout(true); // Clear tokens and redirect
          }, 1000);
          
          return Promise.reject(refreshError);
        }
      }

      // Handle other error status codes
      if (error.response) {
        // Show error banner if configured for this status code
        if (bannerConfig.shouldShowBanner(error.response.status)) {
          const { error: errorCode, message } = bannerConfig.extractBannerData(error.response);
          if (onShowBanner) {
            onShowBanner({
              type: bannerConfig.getBannerType(error.response.status),
              error: errorCode,
              message,
            });
          }
        }

        // Log errors for debugging
        switch (error.response.status) {
          case 403:
            console.error('Access forbidden');
            break;
          case 500:
            console.error('Server error');
            break;
          default:
            console.error('API Error:', error.response.data);
        }
      } else if (error.request) {
        // Network error - no response received
        if (onShowBanner) {
          onShowBanner({
            type: 'error',
            error: 'NETWORK_ERROR',
            message: 'Unable to connect to server. Please check your internet connection.',
          });
        }
      }
      
      return Promise.reject(error);
    }
  );

  return axiosRequest;
};
