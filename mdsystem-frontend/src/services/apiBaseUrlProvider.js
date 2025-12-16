/**
 * API Base URL Provider
 * Provides base URL detection based on subdomain for MDSystem TIP
 * 
 * Domains:
 * - Patient Portal: www.mdsystemtip.space
 * - Staff Portal: staff.mdsystemtip.space
 * 
 * LOCAL DEVELOPMENT:
 * - DEV_PORTAL: Set VITE_DEV_PORTAL in .env.local to 'www' or 'staff'
 */

// 🔧 DEVELOPER SWITCH: Change VITE_DEV_PORTAL in .env.local
const DEV_PORTAL = import.meta.env.VITE_DEV_PORTAL || 'www';

/**
 * Get the API base URL based on current hostname
 * @returns {string} The API base URL
 */
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  // For local development - use empty string to use Vite proxy
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Empty string means relative URLs, which Vite proxy will forward
    return '';
  }
  
  // For production with subdomains (mdsystemtip.space)
  if (hostname.startsWith('staff.')) {
    // Staff Portal: staff.mdsystemtip.space
    return import.meta.env.VITE_STAFF_API_URL || `https://${hostname}`;
  }
  
  // Default to www/patient portal: www.mdsystemtip.space
  return import.meta.env.VITE_PATIENT_API_URL || `https://${hostname}`;
}

/**
 * Get the simulated subdomain for local development
 * Used by backend to detect which portal is being tested
 * @returns {string} Simulated hostname based on DEV_PORTAL setting
 */
export function getDevSubdomain() {
  const hostname = window.location.hostname;
  
  // Only for local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return DEV_PORTAL === 'staff' 
      ? 'staff.mdsystemtip.space' 
      : 'www.mdsystemtip.space';
  }
  
  // Production uses actual hostname
  return null;
}
