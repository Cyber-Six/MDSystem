/**
 * Role Detection Utility
 * Platform-agnostic role detection based on hostname
 * 
 * Extracts pure business logic for role determination from hostname patterns.
 * 
 * @module role-detection
 */

/**
 * Detect user role from hostname
 * 
 * Logic:
 * - Hostname starting with "staff." → medical role
 * - All other hostnames → patient role (default)
 * 
 * @param {string} hostname - The hostname to check (e.g., "staff.mdsystemtip.space", "www.mdsystemtip.space")
 * @returns {'medical'|'patient'} The detected role
 * 
 * @example
 * import { detectRoleFromHostname } from '@mdsystem/core/utils/role-detection';
 * 
 * // Web
 * const role = detectRoleFromHostname(window.location.hostname);
 * 
 * // React Native
 * import Config from 'react-native-config';
 * const role = detectRoleFromHostname(Config.HOSTNAME);
 * 
 * @example
 * // Test cases
 * detectRoleFromHostname('staff.mdsystemtip.space')  // → 'medical'
 * detectRoleFromHostname('STAFF.mdsystemtip.space')  // → 'medical' (case-insensitive)
 * detectRoleFromHostname('www.mdsystemtip.space')    // → 'patient'
 * detectRoleFromHostname('mdsystemtip.space')        // → 'patient'
 * detectRoleFromHostname('localhost')                // → 'patient'
 */
export const detectRoleFromHostname = (hostname) => {
  // Normalize to lowercase for case-insensitive comparison
  const lowerHostname = hostname.toLowerCase();
  
  // Staff subdomain → medical role
  if (lowerHostname.startsWith('staff.')) {
    return 'medical';
  }
  
  // Default to patient role (www, root domain, localhost, etc.)
  return 'patient';
};
