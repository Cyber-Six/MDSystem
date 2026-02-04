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
   * - staff.* or staff2.* subdomain: Returns staff API URL (staff.)
   * - www.* or www2.* subdomain: Returns patient API URL (www.)
   * - Default: Returns patient/www API URL
   * 
   * Note: Backend only accepts www. and staff., so www2/staff2 are mapped accordingly
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
    // Map staff2 → staff for backend compatibility
    if (hostname.startsWith('staff.') || hostname.startsWith('staff2.')) {
      // Staff Portal: Always use staff.mdsystemtip.space for API
      return getEnv('STAFF_API_URL') || 'https://staff.mdsystemtip.space';
    }
    
    // Map www2 → www for backend compatibility
    // Default to www/patient portal: Always use www.mdsystemtip.space for API
    return getEnv('PATIENT_API_URL') || 'https://www.mdsystemtip.space';
  };

  /**
   * Get the simulated subdomain for local development
   * Used by backend to detect which portal is being tested
   * 
   * Maps www2/staff2 to www/staff for backend compatibility
   * 
   * @returns {string|null} Simulated hostname for dev, null for production
   */
  const getDevSubdomain = () => {
    const hostname = getHostname();
    
    // Only for local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const devPortal = getEnv('DEV_PORTAL') || 'www';
      // Map www2 → www, staff2 → staff for backend compatibility
      const normalizedPortal = devPortal.replace(/2$/, ''); // Remove trailing '2'
      return normalizedPortal === 'staff' 
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
