/**
 * API Utility Functions
 * Provides base URL detection based on subdomain
 */

/**
 * Get the API base URL based on current hostname
 * @returns {string} The API base URL with correct subdomain
 */
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  // For local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }
  
  // For production with subdomains
  if (hostname.startsWith('staff.')) {
    return import.meta.env.VITE_STAFF_API_URL || `https://staff.${hostname.replace('staff.', '')}/api`;
  }
  
  // Default to www/patient portal
  return import.meta.env.VITE_PATIENT_API_URL || `https://www.${hostname.replace('www.', '')}/api`;
}
