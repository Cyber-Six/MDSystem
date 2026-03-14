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
   * - Production (any subdomain): Returns empty string (uses relative URLs to avoid CORS)
   * 
   * Note: In production, we use relative URLs so requests go to the same origin.
   * This prevents CORS issues when accessing via www2/staff2 but backend is at www/staff.
   * The backend must handle requests from all subdomains (www, www2, staff, staff2).
   * 
   * @returns {string} The API base URL (empty for relative URLs in both dev and prod)
   */
  const getApiBaseUrl = () => {
    // Always use relative URLs (empty string) for both dev and production
    // This ensures requests go to the same origin, avoiding CORS issues
    return '';
  };

  /**
   * Get the simulated subdomain for local development
   * Used by backend to detect which portal is being tested via X-Forwarded-Host header
   * 
   * In production, returns the actual hostname so backend can detect the portal type.
   * Maps www2 → www, staff2 → staff for backend compatibility.
   * 
   * @returns {string|null} Hostname to send in X-Forwarded-Host header
   */
  const getDevSubdomain = () => {
    const rawHostname = getHostname();
    const hostname = typeof rawHostname === 'string' ? rawHostname : '';
    
    // For local development - simulate subdomain
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const devPortal = getEnv('DEV_PORTAL') || 'www';
      // Map www2 → www, staff2 → staff for backend compatibility
      const normalizedPortal = devPortal.replace(/2$/, ''); // Remove trailing '2'
      return normalizedPortal === 'staff' 
        ? 'staff.mdsystemtip.space' 
        : 'www.mdsystemtip.space';
    }
    
    // Production: Send normalized hostname (map www2→www, staff2→staff)
    // This tells the backend which portal type is being accessed
    if (hostname.startsWith('staff2.')) {
      return hostname.replace('staff2.', 'staff.');
    }
    if (hostname.startsWith('www2.')) {
      return hostname.replace('www2.', 'www.');
    }
    
    // For www. or staff., return as-is
    return hostname;
  };

  return {
    getApiBaseUrl,
    getDevSubdomain
  };
};
