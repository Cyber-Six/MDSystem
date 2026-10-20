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
 * @param {string} [dependencies.tokenNamespace] - Optional namespace prefix for storage keys
 *                                                   (e.g. 'patient' → 'patient_accessToken')
 *                                                   Omit for backward-compatible bare keys.
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
export const createTokenService = ({ storage, navigator, getApiBaseUrl, tokenNamespace }) => {
  // Derive namespaced storage keys (e.g. 'patient_accessToken') or fall back to bare keys
  const accessTokenKey  = tokenNamespace ? `${tokenNamespace}_accessToken`  : 'accessToken';
  const refreshTokenKey = tokenNamespace ? `${tokenNamespace}_refreshToken` : 'refreshToken';

  let sessionRevision = 0;
  let refreshInFlight = null;
  let storageMutation = Promise.resolve();
  const mutateStorage = (operation) => {
    const result = storageMutation.then(operation);
    storageMutation = result.catch(() => {});
    return result;
  };
  const removeStoredTokens = async () => {
    // Attempt both removals even if one storage operation fails.
    const results = await Promise.allSettled([
      Promise.resolve().then(() => storage.removeItem(accessTokenKey)),
      Promise.resolve().then(() => storage.removeItem(refreshTokenKey)),
    ]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  };
  const storeTokens = (accessToken, refreshToken) => mutateStorage(async () => {
    try {
      await storage.setItem(accessTokenKey, accessToken);
      await storage.setItem(refreshTokenKey, refreshToken);
    } catch (error) {
      await removeStoredTokens();
      throw error;
    }
  });
  const sessionChangedError = () => Object.assign(new Error('Authentication session changed during refresh'), {
    code: 'AUTH_SESSION_CHANGED',
  });

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
      return storage.getItem(accessTokenKey);
    },

    /**
     * Get refresh token from storage
     * @returns {string|null|Promise<string|null>} Refresh token or null
     */
    getRefreshToken: () => {
      return storage.getItem(refreshTokenKey);
    },

    /**
     * Store a validated token pair; clear partial writes on failure.
     * 
     * @param {string} accessToken - New access token
     * @param {string} refreshToken - New refresh token
     * @throws {Error} If tokens are invalid
     * @returns {Promise<void>} Resolves when both tokens are stored
     */
    setTokens: async (accessToken, refreshToken) => {
      if (!TokenStorage.validateToken(accessToken) || !TokenStorage.validateRefreshToken(refreshToken)) {
        throw new Error('Invalid token pair');
      }
      sessionRevision += 1;
      return storeTokens(accessToken, refreshToken);
    },

    /**
     * Clear all authentication tokens
     * 
     * SECURITY: Should be called on logout, token refresh failure, or session expiry
     * @returns {Promise<void>} Resolves when both tokens are removed
     */
    clearTokens: async () => {
      sessionRevision += 1;
      return mutateStorage(removeStoredTokens);
    },

    /**
     * Validate access token format (JWT: three non-empty base64url segments).
     *
     * SECURITY: Checks structural integrity of the access token before use.
     * Signature verification happens server-side — this prevents obviously
     * malformed values (empty string, wrong type, non-JWT) from being stored.
     *
     * @param {string} token - Access token to validate
     * @returns {boolean} True if token looks like a well-structured JWT
     */
    validateToken: (token) => {
      if (!token || typeof token !== 'string') return false;
      return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
    },

    /**
     * Validate refresh token format (userId:deviceId:rawToken).
     *
     * SECURITY: Enforces the expected three-segment colon-delimited structure
     * for refresh tokens. Prevents malformed tokens from being sent to the
     * refresh endpoint or used to derive storage keys.
     *
     * @param {string} token - Refresh token to validate
     * @returns {boolean} True if token matches userId:deviceId:rawToken format
     */
    validateRefreshToken: (token) => {
      if (!token || typeof token !== 'string') return false;
      const parts = token.split(':');
      return parts.length === 3 && parts.every((p) => p.length > 0);
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
  const performRefresh = async (revision) => {
    try {
      await storageMutation;
      const refreshToken = await TokenStorage.getRefreshToken();
      if (sessionRevision !== revision) throw sessionChangedError();
      if (!refreshToken) throw new Error('No refresh token available');
      if (!TokenStorage.validateRefreshToken(refreshToken)) throw new Error('Invalid refresh token format');

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
      
      // SECURITY: Validate both token structures before storing
      if (!TokenStorage.validateToken(accessToken) || !TokenStorage.validateRefreshToken(newRefreshToken)) {
        throw new Error('Invalid tokens received from server');
      }
      
      // Logout or a new login invalidates this response, including its error cleanup.
      if (sessionRevision !== revision) throw sessionChangedError();
      await storeTokens(accessToken, newRefreshToken);
      if (sessionRevision !== revision) throw sessionChangedError();
      
      return accessToken;
    } catch (error) {
      if (sessionRevision !== revision) throw sessionChangedError();
      // SECURITY: Clear tokens on any refresh failure to prevent using stale/invalid tokens
      const cleanupRevision = sessionRevision + 1;
      await TokenStorage.clearTokens();
      if (sessionRevision !== cleanupRevision) throw sessionChangedError();
      
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

  // Share refreshes across HTTP, route guards, and socket services, since tokens rotate.
  const refreshAccessToken = () => {
    if (refreshInFlight?.revision === sessionRevision) return refreshInFlight.promise;
    const revision = sessionRevision;
    const promise = performRefresh(revision).finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    });
    refreshInFlight = { revision, promise };
    return promise;
  };

  /**
   * Check if the access token JWT is expired (client-side decode, no signature verification)
   * 
   * This avoids unnecessary refresh calls when the access token is still valid.
   * 
   * @param {number} bufferSeconds - Treat token as expired this many seconds before actual expiry (default: 60)
   * @returns {Promise<boolean>} True if token is expired, missing, or invalid
   */
  const isAccessTokenExpired = async (bufferSeconds = 60) => {
    try {
      const token = await Promise.resolve(TokenStorage.getAccessToken());
      if (!token) return true;

      const parts = token.split('.');
      if (parts.length !== 3) return true;

      // Decode base64url payload → JSON
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));

      if (!Number.isFinite(payload.exp)) return true;

      const now = Math.floor(Date.now() / 1000);
      return now >= (payload.exp - bufferSeconds);
    } catch {
      return true; // If decoding fails, treat as expired
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
    // Invalidate an in-flight refresh before even awaiting asynchronous storage reads.
    const revision = ++sessionRevision;
    let accessToken;
    let refreshToken;
    // Capture and clear the old pair in one queued operation. A subsequent login
    // is queued after this cleanup and cannot be erased by the old logout.
    await mutateStorage(async () => {
      try {
        accessToken = await TokenStorage.getAccessToken();
        refreshToken = await TokenStorage.getRefreshToken();
      } finally {
        await removeStoredTokens();
      }
    });

    // Best-effort server-side revocation for the current refresh session.
    if (TokenStorage.validateRefreshToken(refreshToken)) {
      const headers = {};
      if (TokenStorage.validateToken(accessToken)) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      try {
        await axios.post(
          `${getApiBaseUrl()}/auth/logout`,
          { refreshToken },
          {
            withCredentials: true,
            timeout: 5000,
            headers,
          }
        );
      } catch {
        // Ignore revocation failures — local logout has already completed.
      }
    }
    
    // Redirect/navigate if requested
    if (redirectToAuth && sessionRevision === revision) {
      navigator.navigate('/auth');
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
    return TokenStorage.validateToken(accessToken) && TokenStorage.validateRefreshToken(refreshToken);
  };

  return {
    TokenStorage,
    refreshAccessToken,
    isAccessTokenExpired,
    logout,
    isAuthenticated
  };
};
