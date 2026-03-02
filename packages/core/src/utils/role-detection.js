/**
 * Role Detection Utility
 * Platform-agnostic role detection based on hostname
 * 
 * Extracts pure business logic for role determination from hostname patterns.
 * 
 * @module role-detection
 */

/**
 * Valid subdomains for each portal type
 */
export const PATIENT_SUBDOMAINS = ['www', 'www2'];
export const MEDICAL_SUBDOMAINS = ['staff', 'staff2'];

/**
 * Detect user role from hostname
 * 
 * Logic:
 * - Hostname starting with "staff." or "staff2." → medical role
 * - Hostname starting with "www." or "www2." → patient role
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
 * detectRoleFromHostname('staff.mdsystemtip.space')   // → 'medical'
 * detectRoleFromHostname('staff2.mdsystemtip.space')  // → 'medical'
 * detectRoleFromHostname('STAFF.mdsystemtip.space')   // → 'medical' (case-insensitive)
 * detectRoleFromHostname('www.mdsystemtip.space')     // → 'patient'
 * detectRoleFromHostname('www2.mdsystemtip.space')    // → 'patient'
 * detectRoleFromHostname('mdsystemtip.space')         // → 'patient'
 * detectRoleFromHostname('localhost')                 // → 'patient'
 */
export const detectRoleFromHostname = (hostname) => {
  if (!hostname || typeof hostname !== 'string') {
    return 'patient'; // Default to patient role for invalid input
  }

  // Normalize to lowercase for case-insensitive comparison
  const lowerHostname = hostname.toLowerCase();
  
  // Check if hostname starts with any medical subdomain
  if (MEDICAL_SUBDOMAINS.some(subdomain => lowerHostname.startsWith(`${subdomain}.`))) {
    return 'medical';
  }
  
  // Default to patient role (www, www2, root domain, localhost, etc.)
  return 'patient';
};
