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
import { apiEndpoint, normalizeApiBaseUrl } from '../internal/api-url.js';

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
 * @param {boolean} [dependencies.requestLoggerForceEnabled] - Optional override to force-enable/disable request logging
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
 *   getApiBaseUrl: () => Config.API_URL || 'https://www.mdsystemtip.space',
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
  onShowBanner,
  requestLoggerForceEnabled
}) => {
  // ============================================
  // DEBUG LOGGING
  // Auto-enabled on localhost, auto-disabled in production
  // Set forceEnabled: true to enable logging in production
  // ============================================
  const runtimeDevFlag = typeof __DEV__ !== 'undefined' ? __DEV__ : undefined;
  const loggerForceEnabled =
    typeof requestLoggerForceEnabled === 'boolean'
      ? requestLoggerForceEnabled
      : runtimeDevFlag;

  const computedBaseURL = normalizeApiBaseUrl(getApiBaseUrl());
  const requestLogger = createRequestLogger({
    forceEnabled: loggerForceEnabled,
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

  // This client carries session credentials and must only contact the configured API.
  // Resolve Axios' final URL, including per-request baseURL overrides, before reading tokens.
  const browserUrl = typeof window !== 'undefined' ? window.location?.href : undefined;
  if (!browserUrl && !/^https?:\/\//i.test(computedBaseURL)) {
    throw new Error('An absolute HTTP(S) API base URL is required without a browser location');
  }
  const trustedUrl = new URL(computedBaseURL || '/', browserUrl);
  const refreshPath = new URL(apiEndpoint(computedBaseURL, '/auth/refresh'), browserUrl).pathname;
  const resolveApiUrl = (config) => {
    if (config.baseURL !== undefined) config.baseURL = normalizeApiBaseUrl(config.baseURL);
    const url = new URL(axiosRequest.getUri(config), browserUrl || trustedUrl.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== trustedUrl.origin || url.username || url.password) {
      throw new Error('Authenticated requests must target the configured API origin');
    }
    return url;
  };

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
      resolveApiUrl(config);
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
      // Log response for debugging
      requestLogger.logResponse(response);

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
      // Log error for debugging
      requestLogger.logError(error);

      const originalRequest = error.config;
      const isRefreshEndpoint = originalRequest && resolveApiUrl(originalRequest).pathname.replace(/\/$/, '') === refreshPath;
      
      // Handle 401 errors with automatic token refresh (skip if already retrying or is refresh endpoint)
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshEndpoint) {
        // Queued requests also get only one retry, even if the new token is rejected.
        originalRequest._retry = true;
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

          if (refreshError.code === 'AUTH_SESSION_CHANGED') return Promise.reject(refreshError);
          
          // Show session expired banner
          if (onShowBanner) {
            onShowBanner({
              type: 'error',
              error: refreshError.code || 'SESSION_EXPIRED',
              message: refreshError.message || 'Your session has expired. Please log in again.',
              duration: 0,
            });
          }
          
          // Finish logout now; a delayed logout could clear a subsequent login.
          await tokenService.logout(true);
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
