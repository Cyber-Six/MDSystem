/**
 * EMR API Service for Record Update Form
 * Handles GraphQL mutations for student profile and emergency contact
 * 
 * EMERGENCY FIX 1: userId is hardcoded to "1"
 * LOCATION: Lines 54, 104, 154 - Search for userId = '1' to find all instances
 * TODO: Replace with actual user ID from authentication token when token system is integrated
 * 
 * To test currently:
 * 1. Change userId = '1' to a valid userId from your test database
 * 2. Or ask backend team what test userId to use
 */

import { axiosRequest } from '../../../packages-core-adapter';

// Map form year values to GraphQL STUDENT_YEAR enum
const mapYearToEnum = (year) => {
  const yearMap = {
    '1st Year': 'Freshman',
    '2nd Year': 'Sophomore',
    '3rd Year': 'Junior',
    '4th Year': 'Senior',
    '5th Year': 'Senior' // Map 5th year to Senior as backend doesn't have 5th Year
  };
  return yearMap[year] || year;
};

/**
 * Send a GraphQL request to the EMR endpoint
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - Variables for the GraphQL operation
 * @returns {Promise} Response from the server
 */
const sendGraphQLRequest = async (query, variables = {}) => {
  console.log('[Personal Info Service] Sending GraphQL request:', {
    query: query,
    variables: JSON.stringify(variables, null, 2)
  });

  try {
    const response = await axiosRequest.post('/emr/patient', {
      query,
      variables
    });

    console.log('[Personal Info Service] GraphQL response received:', response.data);
    
    if (response.data.errors) {
      console.error('[Personal Info Service] GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
    }

    return response.data.data;
  } catch (error) {
    console.error('[Personal Info Service] Request failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

/**
 * Update Student Profile with school information
 * @param {object} schoolData - School information (program, year, department, studentNumber, schoolYear, semester, studentCategory)
 * @param {string} userId - User ID (EMERGENCY FIX 1: Line 54 - currently hardcoded to '1')
 * @returns {Promise} Response from server
 */
export const updateStudentProfile = async (schoolData, userId = '1') => {
  console.log('[Personal Info Service] Updating student profile:', schoolData);
  
  // Validation
  if (!schoolData.program) {
    throw new Error('Program is required');
  }
  if (!schoolData.schoolYear) {
    throw new Error('School Year is required');
  }
  
  const mutation = `
    mutation UpdateStudentProfile($userId: ID!, $input: StudentProfileUpdateInput!) {
      updateStudentProfile(userId: $userId, input: $input) {
        id
        program
        year
        status
      }
    }
  `;

  const variables = {
    userId,
    input: {
      program: schoolData.program,
      year: mapYearToEnum(schoolData.schoolYear)
    }
  };

  try {
    const data = await sendGraphQLRequest(mutation, variables);
    console.log('[Personal Info Service] Student profile updated:', data.updateStudentProfile);
    return data.updateStudentProfile;
  } catch (error) {
    console.error('[Personal Info Service] Failed to update student profile:', error.message);
    throw error;
  }
};

/**
 * Update Emergency Contact information
 * @param {object} emergencyData - Emergency contact data (emergencyContact1Name, emergencyContact1Relationship, etc.)
 * @param {string} userId - User ID (EMERGENCY FIX 1: Line 104 - currently hardcoded to '1')
 * @returns {Promise} Response from server
 */
export const updateEmergencyContact = async (emergencyData, userId = '1') => {
  console.log('[Personal Info Service] Updating emergency contact:', emergencyData);
  
  // Validation
  if (!emergencyData.emergencyContact1Name || !emergencyData.emergencyContact1Relationship || !emergencyData.emergencyContact1Number) {
    throw new Error('Primary emergency contact information is incomplete');
  }
  if (!emergencyData.emergencyContact2Name || !emergencyData.emergencyContact2Relationship || !emergencyData.emergencyContact2Number) {
    throw new Error('Secondary emergency contact information is incomplete');
  }
  
  const mutation = `
    mutation UpdateEmergencyContact($userId: ID!, $input: EmergencyContactInput!) {
      updateEmergencyContact(userId: $userId, input: $input) {
        id
        firstContact {
          contactName
          relationship
          contactNumber
          isVerified
        }
        secondContact {
          contactName
          relationship
          contactNumber
          isVerified
        }
      }
    }
  `;

  const variables = {
    userId,
    input: {
      firstContact: {
        contactName: emergencyData.emergencyContact1Name,
        relationship: emergencyData.emergencyContact1Relationship,
        contactNumber: emergencyData.emergencyContact1Number,
        isVerified: false
      },
      secondContact: {
        contactName: emergencyData.emergencyContact2Name,
        relationship: emergencyData.emergencyContact2Relationship,
        contactNumber: emergencyData.emergencyContact2Number,
        isVerified: false
      }
    }
  };

  try {
    const data = await sendGraphQLRequest(mutation, variables);
    console.log('[Personal Info Service] Emergency contact updated:', data.updateEmergencyContact);
    return data.updateEmergencyContact;
  } catch (error) {
    console.error('[Personal Info Service] Failed to update emergency contact:', error.message);
    throw error;
  }
};

/**
 * Update both Student Profile and Emergency Contact together
 * @param {object} formData - Complete form data containing school info and emergency contacts
 * @param {string} userId - User ID (EMERGENCY FIX 1: Line 154 - currently hardcoded to '1')
 * @returns {Promise} Object with both update results
 * @throws {Error} If validation fails or API request fails
 */
export const updatePersonalInfo = async (formData, userId = '1') => {
  console.log('[Personal Info Service] Updating personal information for userId:', userId);
  
  if (!formData) {
    throw new Error('Form data is required');
  }
  
  try {
    console.log('[Personal Info Service] Step 1: Updating student profile...');
    const profileResult = await updateStudentProfile(formData, userId);
    console.log('[Personal Info Service] ✓ Student profile updated successfully');
    
    console.log('[Personal Info Service] Step 2: Updating emergency contact...');
    const contactResult = await updateEmergencyContact(formData, userId);
    console.log('[Personal Info Service] ✓ Emergency contact updated successfully');
    
    console.log('[Personal Info Service] ✓ All personal information updated successfully');
    return {
      success: true,
      profile: profileResult,
      contact: contactResult
    };
  } catch (error) {
    console.error('[Personal Info Service] ✗ Failed to update personal information:', error.message);
    throw new Error(`Personal information update failed: ${error.message}`);
  }
};
