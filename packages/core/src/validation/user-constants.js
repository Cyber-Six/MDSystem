/**
 * User Status/Role Constants
 * Platform-agnostic user role definitions
 * 
 * @module user-constants
 */

/**
 * Valid user status types
 */
export const USER_STATUS = {
  STUDENT: 'Student',
  EMPLOYEE: 'Employee',
  MEDICAL: 'Medical',
};

/**
 * Valid user status values as array
 */
export const USER_STATUS_VALUES = Object.values(USER_STATUS);

/**
 * Check if user is medical staff
 * 
 * @param {string} status - User status to check
 * @returns {boolean} True if user is medical staff
 * 
 * @example
 * isUserStaff('Medical')   // → true
 * isUserStaff('Student')   // → false
 */
export const isUserStaff = (status) => {
  return status === USER_STATUS.MEDICAL;
};

/**
 * Check if status is valid
 * 
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid status
 * 
 * @example
 * isValidStatus('Student')   // → true
 * isValidStatus('Invalid')   // → false
 */
export const isValidStatus = (status) => {
  return USER_STATUS_VALUES.includes(status);
};
