/**
 * Request Logger Service
 * Centralized logging for HTTP requests
 * 
 * Auto-detects environment:
 * - localhost/127.0.0.1: Logging enabled (development)
 * - *.mdsystemtip.space: Logging disabled (production)
 * 
 * Use forceEnabled to override auto-detection in production.
 * 
 * @module console-request-logger
 */

/**
 * Creates a request logger with configuration
 * 
 * @param {Object} config - Logger configuration
 * @param {boolean|undefined} config.forceEnabled - Manual override: true=always log, false=never log, undefined=auto-detect
 * @param {string} config.computedBaseURL - The base URL configured in axios
 * @param {Function} config.getDevSubdomain - Function to get the subdomain/hostname being used
 * 
 * @returns {Object} Logger methods
 * 
 * @example
 * // Auto-detect (logs on localhost only)
 * const logger = createRequestLogger({
 *   computedBaseURL: '',
 *   getDevSubdomain: apiBaseUrlProvider.getDevSubdomain
 * });
 * 
 * @example
 * // Force enable in production (for debugging)
 * const logger = createRequestLogger({
 *   forceEnabled: true,
 *   computedBaseURL: '',
 *   getDevSubdomain: apiBaseUrlProvider.getDevSubdomain
 * });
 */
export const createRequestLogger = ({ forceEnabled = undefined, computedBaseURL = '', getDevSubdomain = null }) => {
  /**
   * Check if logging should be enabled based on environment
   * @returns {boolean}
   */
  const shouldLog = () => {
    // Manual override takes precedence
    if (forceEnabled === true) return true;
    if (forceEnabled === false) return false;
    
    // Auto-detect: only log on localhost
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    
    // Non-browser environment: disable by default
    return false;
  };
  /**
   * Log request details to console for debugging
   * Shows the actual URL that will be hit, including protocol and hostname
   * 
   * @param {Object} config - Axios request config
   */
  const logRequest = (config) => {
    if (!shouldLog()) return;

    // Determine the actual backend being targeted
    let backendURL = 'unknown';
    const base = config.baseURL || '';
    const path = config.url || '';
    
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development: Show proxy target based on X-Forwarded-Host
        const forwardedHost = config.headers?.['X-Forwarded-Host'];
        if (forwardedHost) {
          backendURL = `https://${forwardedHost}${path}`;
        } else {
          backendURL = `${window.location.origin}${path} (no proxy)`;
        }
      } else {
        // Production: Show actual production URL
        backendURL = `https://${hostname}${path}`;
      }
    } else {
      // React Native or non-browser environment
      const subdomain = getDevSubdomain ? getDevSubdomain() : null;
      backendURL = subdomain ? `https://${subdomain}${path}` : base ? `${base}${path}` : path;
    }

    console.log('🔵 Axios Request:', {
      backendURL: backendURL,
      method: config.method?.toUpperCase(),
      path: path,
      data: config.data,
      params: config.params,
    });
  };

  /**
   * Log response details to console for debugging
   * 
   * @param {Object} response - Axios response object
   */
  const logResponse = (response) => {
    if (!shouldLog()) return;

    console.log('🟢 Axios Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      data: response.data,
    });
  };

  /**
   * Log error details to console for debugging
   * 
   * @param {Object} error - Axios error object
   */
  const logError = (error) => {
    if (!shouldLog()) return;

    if (error.response) {
      console.error('🔴 Axios Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error('🔴 Axios Network Error:', {
        message: 'No response received',
        url: error.config?.url,
      });
    } else {
      console.error('🔴 Axios Error:', error.message);
    }
  };

  return {
    logRequest,
    logResponse,
    logError,
  };
};
