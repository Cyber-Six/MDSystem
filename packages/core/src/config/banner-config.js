/**
 * HTTP Status Code Configuration for Banner Notifications
 * 
 * Configure which HTTP status codes should trigger banner notifications
 * and which should be silent.
 * 
 * Add or remove status codes as needed for your application.
 */

/**
 * Status codes that should display SUCCESS banners (green)
 */
export const SUCCESS_STATUS_CODES = [
  200, // OK
  201, // Created
  // Add more success codes here as needed
];

/**
 * Status codes that should display ERROR banners (red)
 */
export const ERROR_STATUS_CODES = [
  400, // Bad Request
  // 401 excluded - handled by token refresh flow, not shown to user
  403, // Forbidden
  404, // Not Found
  409, // Conflict
  422, // Unprocessable Entity
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  // Add more error codes here as needed
];

/**
 * Status codes that should display INFO banners (grey)
 */
export const INFO_STATUS_CODES = [
  // Add info codes here if needed
  // Example: 202, // Accepted (processing)
];

/**
 * Status codes that should NEVER display banners (silent)
 * These are typically handled programmatically or are part of normal flow
 */
export const SILENT_STATUS_CODES = [
  // Token refresh 401 is handled separately in interceptor
  // Add other codes that should be silent
];

/**
 * Check if a status code should display a banner
 * @param {number} statusCode - HTTP status code
 * @returns {boolean} True if banner should be shown
 */
export const shouldShowBanner = (statusCode) => {
  return (
    SUCCESS_STATUS_CODES.includes(statusCode) ||
    ERROR_STATUS_CODES.includes(statusCode) ||
    INFO_STATUS_CODES.includes(statusCode)
  );
};

/**
 * Get banner type based on status code
 * @param {number} statusCode - HTTP status code
 * @returns {'success'|'error'|'info'} Banner type
 */
export const getBannerType = (statusCode) => {
  if (SUCCESS_STATUS_CODES.includes(statusCode)) return 'success';
  if (ERROR_STATUS_CODES.includes(statusCode)) return 'error';
  if (INFO_STATUS_CODES.includes(statusCode)) return 'info';
  return 'info'; // default
};

/**
 * Extract error and message from backend response
 * @param {Object} response - Axios response object
 * @returns {{error: string|null, message: string}} Extracted banner data
 */
export const extractBannerData = (response) => {
  const data = response?.data;
  
  return {
    error: data?.error || null,
    message: data?.message || getDefaultMessage(response?.status),
  };
};

/**
 * Default messages for status codes when backend doesn't provide one
 * @param {number} statusCode - HTTP status code
 * @returns {string} Default message
 */
const getDefaultMessage = (statusCode) => {
  const defaultMessages = {
    200: 'Success',
    201: 'Created successfully',
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    409: 'Conflict occurred',
    422: 'Validation failed',
    429: 'Too many requests',
    500: 'Server error occurred',
    502: 'Bad gateway',
    503: 'Service unavailable',
  };

  return defaultMessages[statusCode] || 'An error occurred';
};
