/**
 * API Base URL Provider
 * Provides base URL detection based on subdomain for MDSystem TIP
 * 
 * Domains:
 * - Patient Portal: www.mdsystemtip.space
 * - Staff Portal: staff.mdsystemtip.space
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
  
  // For production with subdomains (mdsystemtip.space)
  if (hostname.startsWith('staff.')) {
    // Staff Portal: staff.mdsystemtip.space
    return import.meta.env.VITE_STAFF_API_URL || `https://${hostname}`;
  }
  
  // Default to www/patient portal: www.mdsystemtip.space
  return import.meta.env.VITE_PATIENT_API_URL || `https://${hostname}`;
}
