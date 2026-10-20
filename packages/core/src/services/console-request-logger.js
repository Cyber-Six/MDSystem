/**
 * Request Logger Service
 * Centralized transport-metadata logging for HTTP requests.
 * Never logs bodies, parameters, credentials, or server error messages.
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
  const hasBrowserLocation = () => {
    return (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.hostname === 'string'
    );
  };

  /**
   * Determine logging state once at creation time (hostname doesn't change at runtime)
   * @type {boolean}
   */
  const _loggingEnabled = (() => {
    // Manual override takes precedence
    if (forceEnabled === true) return true;
    if (forceEnabled === false) return false;
    
    // Auto-detect: only log on localhost
    if (hasBrowserLocation()) {
      const hostname = window.location.hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    
    // Non-browser environment: disable by default
    return false;
  })();

  /**
   * Check if logging should be enabled (cached result)
   * @returns {boolean}
   */
  const shouldLog = () => _loggingEnabled;
  /**
   * Log request details to console for debugging
   * Records method and path without query strings or fragments.
   * 
   * @param {Object} config - Axios request config
   */
  // Payloads, query strings, and server error messages may contain credentials or
  // patient information. Keep diagnostics to transport metadata, even when forced on.
  const requestPath = (config) => {
    try {
      return new URL(config?.url || '/', 'https://logger.invalid').pathname;
    } catch {
      return '[invalid URL]';
    }
  };

  const logRequest = (config) => {
    if (!shouldLog()) return;
    console.log('🔵 Axios Request:', {
      method: config.method?.toUpperCase(),
      path: requestPath(config),
    });
  };

  const logResponse = (response) => {
    if (!shouldLog()) return;
    console.log('🟢 Axios Response:', {
      status: response.status,
      path: requestPath(response.config),
    });
  };

  const logError = (error) => {
    if (!shouldLog()) return;
    console.error('🔴 Axios Error:', {
      status: error.response?.status,
      path: requestPath(error.config),
      networkError: Boolean(error.request && !error.response),
      graphQLErrorCount: Array.isArray(error.response?.data?.errors)
        ? error.response.data.errors.length
        : 0,
    });
  };

  return {
    logRequest,
    logResponse,
    logError,
  };
};
