/**
 * Token Refresh Service
 * Handles access token refresh using refresh tokens
 * Isolated for security and maintainability
 */

import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrlProvider.js';

/**
 * SECURITY: Token storage interface
 * Centralizes all token operations for easier auditing
 */
export const TokenStorage = {
  /**
   * Get access token from localStorage
   */
  getAccessToken: () => {
    return localStorage.getItem('accessToken');
  },

  /**
   * Get refresh token from localStorage
   */
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken');
  },

  /**
   * Store tokens atomically
   * @param {string} accessToken - New access token
   * @param {string} refreshToken - New refresh token
   */
  setTokens: (accessToken, refreshToken) => {
    if (!accessToken || !refreshToken) {
      throw new Error('Both tokens are required');
    }
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  /**
   * Clear all authentication tokens
   * SECURITY: Should be called on logout, token refresh failure, or session expiry
   */
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  /**
   * Validate token format
   * SECURITY: Basic validation before using tokens
   */
  validateToken: (token) => {
    return token && typeof token === 'string' && token.length > 0;
  },
};

/**
 * Refresh access token using refresh token
 * SECURITY: Uses separate axios instance to prevent interceptor loops
 * 
 * @returns {Promise<string>} New access token
 * @throws {Error} If refresh fails
 */
export const refreshAccessToken = async () => {
  const refreshToken = TokenStorage.getRefreshToken();
  
  // SECURITY: Validate refresh token exists
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // SECURITY: Validate refresh token format (userId:deviceId:rawToken)
  const parts = refreshToken.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid refresh token format');
  }

  try {
    // SECURITY: Use plain axios (not axiosRequest) to avoid interceptor recursion
    // This prevents infinite loops when refresh endpoint returns 401
    const response = await axios.post(
      `${getApiBaseUrl()}/auth/refresh`,
      { refreshToken },
      {
        headers: { 
          'Content-Type': 'application/json',
        },
        withCredentials: true,
        timeout: 10000, // SECURITY: Shorter timeout for refresh (10s)
      }
    );

    // SECURITY: Validate response structure
    if (!response.data || !response.data.ok) {
      throw new Error('Invalid refresh response');
    }

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    
    // SECURITY: Validate tokens before storing
    if (!TokenStorage.validateToken(accessToken) || !TokenStorage.validateToken(newRefreshToken)) {
      throw new Error('Invalid tokens received from server');
    }

    // SECURITY: Validate new refresh token format
    const newParts = newRefreshToken.split(':');
    if (newParts.length !== 3) {
      throw new Error('Invalid new refresh token format');
    }
    
    // Store new tokens atomically
    TokenStorage.setTokens(accessToken, newRefreshToken);
    
    return accessToken;
  } catch (error) {
    // SECURITY: Clear tokens on any refresh failure to prevent using stale/invalid tokens
    TokenStorage.clearTokens();
    
    // Preserve error details for better debugging
    if (error.response) {
      // Backend returned error response
      const errorCode = error.response.data?.error || 'REFRESH_FAILED';
      const errorMessage = error.response.data?.message || 'Token refresh failed';
      const newError = new Error(errorMessage);
      newError.code = errorCode;
      newError.status = error.response.status;
      throw newError;
    } else if (error.request) {
      // Network error - no response received
      const newError = new Error('Network error during token refresh');
      newError.code = 'NETWORK_ERROR';
      throw newError;
    } else {
      // Other errors (validation, etc.)
      throw error;
    }
  }
};

/**
 * Logout user and clear all tokens
 * SECURITY: Ensures complete session cleanup
 * 
 * @param {boolean} redirectToAuth - Whether to redirect to /auth after logout
 */
export const logout = (redirectToAuth = true) => {
  // Clear all tokens
  TokenStorage.clearTokens();
  
  // Optional: Call backend logout endpoint to invalidate session
  // This is fire-and-forget, errors are ignored
  try {
    axios.post(`${getApiBaseUrl()}/auth/logout`, {}, {
      withCredentials: true,
      timeout: 5000,
    }).catch(() => {
      // Ignore errors - tokens are already cleared locally
    });
  } catch {
    // Ignore errors - tokens are already cleared locally
  }
  
  // Redirect if requested
  if (redirectToAuth) {
    window.location.href = '/';
  }
};

/**
 * Check if user is authenticated
 * SECURITY: Validates both tokens exist (does not verify validity)
 */
export const isAuthenticated = () => {
  const accessToken = TokenStorage.getAccessToken();
  const refreshToken = TokenStorage.getRefreshToken();
  return TokenStorage.validateToken(accessToken) && TokenStorage.validateToken(refreshToken);
};
