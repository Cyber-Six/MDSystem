/**
 * Password Validation Utilities
 * Platform-agnostic password validation rules
 * 
 * @module password-validation
 */

/**
 * Password validation constants
 */
export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 64,
};

/**
 * Validate password meets requirements
 * 
 * Requirements:
 * - Must be a string
 * - Must be between 8 and 64 characters
 * 
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is valid
 * 
 * @example
 * validatePassword('short')              // → false (too short)
 * validatePassword('validPassword123')   // → true
 * validatePassword(12345678)             // → false (not a string)
 */
export const validatePassword = (password) => {
  if (typeof password !== 'string') return false;

  // Check length rules
  if (password.length < PASSWORD_RULES.MIN_LENGTH || password.length > PASSWORD_RULES.MAX_LENGTH) {
    return false;
  }

  return true;
};

/**
 * Get password validation error message
 * 
 * @param {string} password - Password to check
 * @returns {string|null} Error message or null if valid
 * 
 * @example
 * getPasswordError('short')              // → 'Password must be at least 8 characters long.'
 * getPasswordError('validPassword123')   // → null
 */
export const getPasswordError = (password) => {
  if (typeof password !== 'string') {
    return 'Password must be a valid string.';
  }

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters long.`;
  }

  if (password.length > PASSWORD_RULES.MAX_LENGTH) {
    return `Password must not exceed ${PASSWORD_RULES.MAX_LENGTH} characters.`;
  }

  return null;
};

/**
 * Validate that two passwords match
 * 
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {boolean} True if passwords match
 * 
 * @example
 * passwordsMatch('password123', 'password123')  // → true
 * passwordsMatch('password123', 'different')    // → false
 */
export const passwordsMatch = (password, confirmPassword) => {
  return password === confirmPassword;
};
