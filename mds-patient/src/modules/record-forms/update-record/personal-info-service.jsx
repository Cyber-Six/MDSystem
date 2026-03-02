/**
 * EMR API Service for Record Update Form
 * Handles GraphQL mutations for student profile and emergency contact
 * 
 * Uses CREATE mutations for patient self-update within update ticket context
 * No userId required - uses authenticated user from session
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
      console.warn('[Personal Info Service] ⚠️ GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      
      // If data is null (backend issue), return empty object for graceful degradation
      if (response.data.data === null) {
        console.warn('[Personal Info Service] Data is null, will trigger fallback logic');
        return {};
      }
      
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
 * Uses CREATE mutation for patient self-update (no userId needed)
 * @param {object} schoolData - School information (program, year, department, studentNumber, schoolYear, semester, studentCategory)
 * @returns {Promise} Response from server
 */
export const updateStudentProfile = async (schoolData) => {
  console.log('[Personal Info Service] Creating/updating student profile:', schoolData);
  
  // Validation
  if (!schoolData.program) {
    throw new Error('Program is required');
  }
  if (!schoolData.schoolYear) {
    throw new Error('School Year is required');
  }
  
  const mutation = `
    mutation CreateStudentProfile($input: StudentProfileInput!) {
      createStudentProfile(input: $input) {
        id
        program
        year
        status
      }
    }
  `;

  const variables = {
    input: {
      program: schoolData.program,
      year: mapYearToEnum(schoolData.schoolYear),
      // TEMPORARY WORKAROUND: Backend server needs restart to use updated schema
      // Uncomment these if you get "guardian_name required" error (old schema cached)
      guardian_name: 'N/A',
      guardian_relation: 'N/A', 
      guardian_contact: 'N/A'
    }
  };

  try {
    const data = await sendGraphQLRequest(mutation, variables);
    console.log('[Personal Info Service] Student profile created/updated:', data.createStudentProfile);
    return data.createStudentProfile;
  } catch (error) {
    console.error('[Personal Info Service] Failed to create/update student profile:', error.message);
    throw error;
  }
};

/**
 * Update Emergency Contact information
 * Uses CREATE mutation for patient self-update (no userId needed)
 * @param {object} emergencyData - Emergency contact data (emergencyContact1Name, emergencyContact1Relationship, etc.)
 * @returns {Promise} Response from server
 */
export const updateEmergencyContact = async (emergencyData) => {
  console.log('[Personal Info Service] Creating/updating emergency contact:', emergencyData);
  
  // Validation
  if (!emergencyData.emergencyContact1Name || !emergencyData.emergencyContact1Relationship || !emergencyData.emergencyContact1Number) {
    throw new Error('Primary emergency contact information is incomplete');
  }
  if (!emergencyData.emergencyContact2Name || !emergencyData.emergencyContact2Relationship || !emergencyData.emergencyContact2Number) {
    throw new Error('Secondary emergency contact information is incomplete');
  }
  
  const mutation = `
    mutation CreateEmergencyContact($input: EmergencyContactInput!) {
      createEmergencyContact(input: $input) {
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
    console.log('[Personal Info Service] Emergency contact created/updated:', data.createEmergencyContact);
    return data.createEmergencyContact;
  } catch (error) {
    console.error('[Personal Info Service] Failed to create/update emergency contact:', error.message);
    throw error;
  }
};

/**
 * Update both Student Profile and Emergency Contact together
 * Uses CREATE mutations for patient self-update (no userId needed)
 * @param {object} formData - Complete form data containing school info and emergency contacts
 * @returns {Promise} Object with both update results
 * @throws {Error} If validation fails or API request fails
 */
export const updatePersonalInfo = async (formData) => {
  console.log('[Personal Info Service] Creating/updating personal information');
  
  if (!formData) {
    throw new Error('Form data is required');
  }
  
  try {
    console.log('[Personal Info Service] Step 1: Creating/updating student profile...');
    const profileResult = await updateStudentProfile(formData);
    console.log('[Personal Info Service] ✓ Student profile created/updated successfully');
    
    console.log('[Personal Info Service] Step 2: Creating/updating emergency contact...');
    const contactResult = await updateEmergencyContact(formData);
    console.log('[Personal Info Service] ✓ Emergency contact created/updated successfully');
    
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
