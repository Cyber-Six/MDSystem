/**
 * API Base URL Provider
 * Provides base URL detection based on subdomain for MDSystem TIP
 * 
 * Domains:
 * - Patient Portal: www.mdsystemtip.space
 * - Staff Portal: staff.mdsystemtip.space
 * 
 * LOCAL DEVELOPMENT PORTAL SWITCH:
 * Change DEV_PORTAL to switch between portals when testing on localhost
 * - 'www' for patient portal
 * - 'staff' for staff portal
 */

// 🔧 DEVELOPER SWITCH: Change this to 'www' or 'staff' for local testing
const DEV_PORTAL = 'staff';  // Options: 'www' | 'staff'

/**
 * Get the API base URL based on current hostname
 * @returns {string} The API base URL with correct subdomain
 */
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  // For local development - use production URLs based on DEV_PORTAL
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (DEV_PORTAL === 'staff') {
      return import.meta.env.VITE_STAFF_API_URL || 'https://staff.mdsystemtip.space';
    }
    return import.meta.env.VITE_PATIENT_API_URL || 'https://www.mdsystemtip.space';
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
