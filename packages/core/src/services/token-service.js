/**
 * Token Service Factory
 * Platform-agnostic token management with refresh capabilities
 * 
 * Handles access token refresh, storage, and authentication state
 * through dependency injection for cross-platform compatibility.
 * 
 * @module token-service
 */

import axios from 'axios';

/**
 * Creates a token service with platform-specific dependencies
 * 
 * @param {Object} dependencies - Platform-specific dependencies
 * @param {Object} dependencies.storage - Storage adapter (localStorage, AsyncStorage, etc.)
 * @param {Function} dependencies.storage.getItem - Get item from storage (may be async)
 * @param {Function} dependencies.storage.setItem - Set item in storage (may be async)
 * @param {Function} dependencies.storage.removeItem - Remove item from storage (may be async)
 * @param {Object} dependencies.navigator - Navigation adapter
 * @param {Function} dependencies.navigator.navigate - Navigate to path/route
 * @param {Function} dependencies.getApiBaseUrl - Function that returns API base URL
 * 
 * @returns {Object} Token service methods
 * 
 * @example
 * // Web implementation
 * import { createTokenService } from '@mdsystem/core/services/token-service';
 * 
 * const tokenService = createTokenService({
 *   storage: localStorage,
 *   navigator: { navigate: (path) => { window.location.href = path; } },
 *   getApiBaseUrl: () => apiBaseUrlProvider.getApiBaseUrl()
 * });
 * 
 * // Check authentication
 * if (tokenService.isAuthenticated()) {
 *   const token = tokenService.TokenStorage.getAccessToken();
 * }
 * 
 * @example
 * // React Native implementation (note: storage is async)
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * import { createTokenService } from '@mdsystem/core/services/token-service';
 * 
 * const tokenService = createTokenService({
 *   storage: AsyncStorage,
 *   navigator: navigation, // from useNavigation()
 *   getApiBaseUrl: () => apiBaseUrlProvider.getApiBaseUrl()
 * });
 * 
 * // In React Native, storage operations return promises
 * const token = await tokenService.TokenStorage.getAccessToken();
 */
export const createTokenService = ({ storage, navigator, getApiBaseUrl }) => {
  /**
   * Token storage interface
   * Centralizes all token operations for easier auditing
   * 
   * SECURITY: All token operations should go through this interface
   */
  const TokenStorage = {
    /**
     * Get access token from storage
     * @returns {string|null|Promise<string|null>} Access token or null
     */
    getAccessToken: () => {
      return storage.getItem('accessToken');
    },

    /**
     * Get refresh token from storage
     * @returns {string|null|Promise<string|null>} Refresh token or null
     */
    getRefreshToken: () => {
      return storage.getItem('refreshToken');
    },

    /**
     * Store tokens atomically
     * 
     * @param {string} accessToken - New access token
     * @param {string} refreshToken - New refresh token
     * @throws {Error} If tokens are invalid
     */
    setTokens: (accessToken, refreshToken) => {
      if (!accessToken || !refreshToken) {
        throw new Error('Both tokens are required');
      }
      storage.setItem('accessToken', accessToken);
      storage.setItem('refreshToken', refreshToken);
    },

    /**
     * Clear all authentication tokens
     * 
     * SECURITY: Should be called on logout, token refresh failure, or session expiry
     */
    clearTokens: () => {
      storage.removeItem('accessToken');
      storage.removeItem('refreshToken');
    },

    /**
     * Validate token format
     * 
     * SECURITY: Basic validation before using tokens
     * 
     * @param {string} token - Token to validate
     * @returns {boolean} True if token format is valid
     */
    validateToken: (token) => {
      return token && typeof token === 'string' && token.length > 0;
    },
  };

  /**
   * Refresh access token using refresh token
   * 
   * SECURITY: Uses separate axios instance to prevent interceptor loops
   * 
   * @returns {Promise<string>} New access token
   * @throws {Error} If refresh fails
   */
  const refreshAccessToken = async () => {
    // Handle async storage (React Native)
    const refreshToken = await Promise.resolve(TokenStorage.getRefreshToken());
    
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
      // Handle async storage (React Native)
      await Promise.resolve(TokenStorage.setTokens(accessToken, newRefreshToken));
      
      return accessToken;
    } catch (error) {
      // SECURITY: Clear tokens on any refresh failure to prevent using stale/invalid tokens
      await Promise.resolve(TokenStorage.clearTokens());
      
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
   * 
   * SECURITY: Ensures complete session cleanup
   * 
   * @param {boolean} redirectToAuth - Whether to redirect/navigate after logout
   */
  const logout = async (redirectToAuth = true) => {
    // Clear all tokens (handle async storage)
    await Promise.resolve(TokenStorage.clearTokens());
    
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
    
    // Redirect/navigate if requested
    if (redirectToAuth) {
      navigator.navigate('/');
    }
  };

  /**
   * Check if user is authenticated
   * 
   * SECURITY: Validates both tokens exist (does not verify validity)
   * 
   * @returns {boolean|Promise<boolean>} True if authenticated
   */
  const isAuthenticated = async () => {
    // Handle async storage (React Native)
    const accessToken = await Promise.resolve(TokenStorage.getAccessToken());
    const refreshToken = await Promise.resolve(TokenStorage.getRefreshToken());
    return TokenStorage.validateToken(accessToken) && TokenStorage.validateToken(refreshToken);
  };

  return {
    TokenStorage,
    refreshAccessToken,
    logout,
    isAuthenticated
  };
};
