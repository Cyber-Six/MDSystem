/**
 * API Base URL Provider Factory
 * Platform-agnostic API URL detection based on hostname and environment
 * 
 * Supports both web (window.location) and React Native (config-based) platforms
 * through dependency injection.
 * 
 * @module api-base-url-provider
 */

/**
 * Creates an API base URL provider with platform-specific dependencies
 * 
 * @param {Object} dependencies - Platform-specific dependencies
 * @param {Function} dependencies.getHostname - Function that returns current hostname
 *                                               Web: () => window.location.hostname
 *                                               RN: () => Config.HOSTNAME
 * @param {Function} dependencies.getEnv - Function that returns environment variable
 *                                          Web: (key) => import.meta.env[`VITE_${key}`]
 *                                          RN: (key) => Config[key]
 * 
 * @returns {Object} API base URL provider methods
 * 
 * @example
 * // Web implementation
 * import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
 * 
 * const apiBaseUrlProvider = createApiBaseUrlProvider({
 *   getHostname: () => window.location.hostname,
 *   getEnv: (key) => import.meta.env[`VITE_${key}`]
 * });
 * 
 * const baseUrl = apiBaseUrlProvider.getApiBaseUrl();
 * 
 * @example
 * // React Native implementation
 * import Config from 'react-native-config';
 * import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
 * 
 * const apiBaseUrlProvider = createApiBaseUrlProvider({
 *   getHostname: () => Config.HOSTNAME || 'www.mdsystemtip.space',
 *   getEnv: (key) => Config[key]
 * });
 * 
 * const baseUrl = apiBaseUrlProvider.getApiBaseUrl();
 */
export const createApiBaseUrlProvider = ({ getHostname, getEnv }) => {
  /**
   * Get the API base URL based on current hostname
   * 
   * Logic:
   * - localhost/127.0.0.1: Returns empty string (for proxy/relative URLs)
   * - staff.* subdomain: Returns staff API URL
   * - Default: Returns patient/www API URL
   * 
   * @returns {string} The API base URL
   */
  const getApiBaseUrl = () => {
    const hostname = getHostname();
    
    // For local development - use empty string to use proxy or relative URLs
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    
    // For production with subdomains (mdsystemtip.space)
    if (hostname.startsWith('staff.')) {
      // Staff Portal: staff.mdsystemtip.space
      return getEnv('STAFF_API_URL') || `https://${hostname}`;
    }
    
    // Default to www/patient portal: www.mdsystemtip.space
    return getEnv('PATIENT_API_URL') || `https://${hostname}`;
  };

  /**
   * Get the simulated subdomain for local development
   * Used by backend to detect which portal is being tested
   * 
   * @returns {string|null} Simulated hostname for dev, null for production
   */
  const getDevSubdomain = () => {
    const hostname = getHostname();
    
    // Only for local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const devPortal = getEnv('DEV_PORTAL') || 'www';
      return devPortal === 'staff' 
        ? 'staff.mdsystemtip.space' 
        : 'www.mdsystemtip.space';
    }
    
    // Production uses actual hostname (no simulation needed)
    return null;
  };

  return {
    getApiBaseUrl,
    getDevSubdomain
  };
};
