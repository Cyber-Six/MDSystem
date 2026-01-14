/**
 * Email Validation Utilities
 * Platform-agnostic email validation for TIP institutional emails
 * 
 * @module email-validation
 */

/**
 * Validate if email is a student email format
 * Pattern: [mq]{lowercase letters}{optional numbers}@tip.edu.ph
 * Examples: msmith@tip.edu.ph, qjohnson123@tip.edu.ph
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid student email format
 * 
 * @example
 * isStudentEmail('msmith@tip.edu.ph')      // → true
 * isStudentEmail('qjohnson123@tip.edu.ph') // → true
 * isStudentEmail('john.doe@tip.edu.ph')    // → false
 */
export const isStudentEmail = (email) => {
  const regex = /^[mq][a-z]+[0-9]*@tip\.edu\.ph$/;
  return regex.test(email);
};

/**
 * Validate if email is an employee email format
 * Pattern: {lowercase letters}.{lowercase letters}@tip.edu.ph (can have multiple dots)
 * Examples: john.doe@tip.edu.ph, maria.dela.cruz@tip.edu.ph
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid employee email format
 * 
 * @example
 * isEmployeeEmail('john.doe@tip.edu.ph')         // → true
 * isEmployeeEmail('maria.dela.cruz@tip.edu.ph')  // → true
 * isEmployeeEmail('msmith@tip.edu.ph')           // → false
 */
export const isEmployeeEmail = (email) => {
  const regex = /^[a-z]+(\.[a-z]+)+@tip\.edu\.ph$/;
  return regex.test(email);
};

/**
 * Validate if email is a medical staff email format
 * Pattern: {lowercase letters}.{optional more names}.mds@tip.edu.ph
 * Examples: john.mds@tip.edu.ph, maria.dela.cruz.mds@tip.edu.ph
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid medical email format
 * 
 * @example
 * isMedicalEmail('john.mds@tip.edu.ph')              // → true
 * isMedicalEmail('maria.dela.cruz.mds@tip.edu.ph')   // → true
 * isMedicalEmail('john.doe@tip.edu.ph')              // → false
 */
export const isMedicalEmail = (email) => {
  const regex = /^[a-z]+(\.[a-z]+)*\.mds@tip\.edu\.ph$/;
  return regex.test(email);
};

/**
 * Detect role/status from email format
 * 
 * @param {string} email - Email address to check
 * @returns {'Student'|'Employee'|'Medical'|null} Detected role or null if invalid
 * 
 * @example
 * detectRoleFromEmail('msmith@tip.edu.ph')        // → 'Student'
 * detectRoleFromEmail('john.doe@tip.edu.ph')      // → 'Employee'
 * detectRoleFromEmail('doc.mds@tip.edu.ph')       // → 'Medical'
 * detectRoleFromEmail('invalid@example.com')      // → null
 */
export const detectRoleFromEmail = (email) => {
  if (isStudentEmail(email)) return 'Student';
  if (isEmployeeEmail(email)) return 'Employee';
  if (isMedicalEmail(email)) return 'Medical';
  return null;
};

/**
 * Validate if email is a valid TIP institutional email
 * Checks if email ends with @tip.edu.ph
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid TIP email format
 * 
 * @example
 * isValidTipEmail('msmith@tip.edu.ph')      // → true
 * isValidTipEmail('john.doe@tip.edu.ph')    // → true
 * isValidTipEmail('user@example.com')       // → false
 */
export const isValidTipEmail = (email) => {
  const regex = /^[^\s@]+@tip\.edu\.ph$/i;
  return regex.test(email);
};

/**
 * Validate if email format is generally valid (basic check)
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 * 
 * @example
 * isValidEmailFormat('user@example.com')  // → true
 * isValidEmailFormat('invalid-email')     // → false
 * isValidEmailFormat('no@domain')         // → false
 */
export const isValidEmailFormat = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
