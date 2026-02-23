/**
 * Data Transformer Utilities
 * Transforms form data into backend-compatible formats
 */

/**
 * Validates and logs the form data structure
 */
export const validateFormData = (formData) => {
  console.log('[Data Transformer] Validating form data structure...');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check personal info
  if (!formData.personalInfo) {
    validation.errors.push('Missing personalInfo section');
    validation.isValid = false;
  } else {
    if (!formData.personalInfo.surname) validation.errors.push('Missing surname');
    if (!formData.personalInfo.firstName) validation.errors.push('Missing firstName');
    if (!formData.personalInfo.birthday) validation.errors.push('Missing birthday');
    if (!formData.personalInfo.gender) validation.errors.push('Missing gender');
  }

  // Check emergency contacts
  if (!formData.personalInfo?.emergencyContacts || formData.personalInfo.emergencyContacts.length < 2) {
    validation.errors.push('Need at least 2 emergency contacts');
    validation.isValid = false;
  }

  // Check medical history
  if (!formData.medicalHistory) {
    validation.warnings.push('Missing medicalHistory section');
  }

  // Check medical background
  if (!formData.medicalBackground) {
    validation.warnings.push('Missing medicalBackground section');
  }

  // Check dental history
  if (!formData.dentalHistory) {
    validation.warnings.push('Missing dentalHistory section');
  }

  console.log('[Data Transformer] Validation result:', validation);
  
  return validation;
};

/**
 * Sanitizes and prepares data for submission
 */
export const sanitizeFormData = (formData) => {
  console.log('[Data Transformer] Sanitizing form data...');
  
  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(formData));

  // Ensure all required fields have values (even if empty)
  if (!sanitized.personalInfo) sanitized.personalInfo = {};
  if (!sanitized.medicalHistory) sanitized.medicalHistory = { self: {}, family: {} };
  if (!sanitized.medicalBackground) sanitized.medicalBackground = {};
  if (!sanitized.dentalHistory) sanitized.dentalHistory = {};
  if (!sanitized.obgyne) sanitized.obgyne = {};
  if (!sanitized.certification) sanitized.certification = {};

  // Ensure emergency contacts array exists
  if (!sanitized.personalInfo.emergencyContacts) {
    sanitized.personalInfo.emergencyContacts = [
      { name: '', relationship: '', contactNumber: '', address: '' },
      { name: '', relationship: '', contactNumber: '', address: '' }
    ];
  }

  // Convert string booleans to actual booleans
  if (sanitized.medicalBackground.smoker === 'yes' || sanitized.medicalBackground.smoker === true) {
    sanitized.medicalBackground.smoker = 'yes';
  } else {
    sanitized.medicalBackground.smoker = 'no';
  }

  if (sanitized.medicalBackground.alcoholDrinker === 'yes' || sanitized.medicalBackground.alcoholDrinker === true) {
    sanitized.medicalBackground.alcoholDrinker = 'yes';
  } else {
    sanitized.medicalBackground.alcoholDrinker = 'no';
  }

  console.log('[Data Transformer] Sanitized data:', sanitized);
  
  return sanitized;
};

/**
 * Formats dates to ISO format
 */
export const formatDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('[Data Transformer] Invalid date:', dateString);
      return null;
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('[Data Transformer] Error formatting date:', dateString, error);
    return null;
  }
};

/**
 * Debug helper to log the complete data structure
 */
export const logDataStructure = (data, label = 'Data Structure') => {
  console.group(`[Data Transformer] ${label}`);
  console.log('Type:', typeof data);
  console.log('Keys:', Object.keys(data));
  console.log('Full Object:', data);
  console.groupEnd();
};

export default {
  validateFormData,
  sanitizeFormData,
  formatDate,
  logDataStructure
};
