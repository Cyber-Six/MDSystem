/**
 * Axios Request Configuration
 * Centralized axios instance for all API requests
 * Automatically uses correct subdomain-based base URL
 * Implements automatic token refresh on expiration
 */

import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrlProvider.js';
import { shouldShowBanner, getBannerType, extractBannerData } from '../config/bannerConfig.js';
import { refreshAccessToken, TokenStorage, logout } from './refreshTokenService.js';

// Banner callback - will be set by BannerContext
let bannerCallback = null;

export const setBannerCallback = (callback) => {
  bannerCallback = callback;
};

// Create axios request instance with automatic base URL detection
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

// Token refresh logic moved to tokenService.js for better maintainability and security

// Request interceptor - add auth token if exists
axiosRequest.interceptors.request.use(
  (config) => {
    // SECURITY: Use TokenStorage for centralized token access
    const token = TokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    if (shouldShowBanner(response.status)) {
      const { error, message } = extractBannerData(response);
      if (bannerCallback) {
        bannerCallback({
          type: getBannerType(response.status),
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
        // SECURITY: Attempt to refresh the token (handled by tokenService)
        const newAccessToken = await refreshAccessToken();
        
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
        if (bannerCallback) {
          const errorCode = refreshError.code || 'SESSION_EXPIRED';
          const errorMessage = refreshError.message || 'Your session has expired. Please log in again.';
          
          bannerCallback({
            type: 'error',
            error: errorCode,
            message: errorMessage,
            duration: 0, // Don't auto-dismiss
          });
        }
        
        // SECURITY: Use logout function to ensure complete cleanup
        // Redirect to auth after short delay to show banner
        setTimeout(() => {
          logout(true); // Clear tokens and redirect
        }, 1000);
        
        return Promise.reject(refreshError);
      }
    }

    // Handle other error status codes
    if (error.response) {
      // Show error banner if configured for this status code
      if (shouldShowBanner(error.response.status)) {
        const { error: errorCode, message } = extractBannerData(error.response);
        if (bannerCallback) {
          bannerCallback({
            type: getBannerType(error.response.status),
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
      if (bannerCallback) {
        bannerCallback({
          type: 'error',
          error: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your internet connection.',
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosRequest;
