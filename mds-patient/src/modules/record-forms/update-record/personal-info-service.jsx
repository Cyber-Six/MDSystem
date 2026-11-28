/**
 * EMR API Service for Record Update Form
 * Handles GraphQL mutations for student profile and emergency contact
 * 
 * Uses CREATE mutations for patient self-update within update ticket context
 * No userId required - uses authenticated user from session
 */

import { axiosRequest } from '../../../packages-core-adapter';

// Form values are already STUDENT_YEAR enum values (Freshman, Sophomore, etc.)
const mapYearToEnum = (year) => year || 'Freshman';

/**
 * Send a GraphQL request to the EMR endpoint
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - Variables for the GraphQL operation
 * @returns {Promise} Response from the server
 */
const sendGraphQLRequest = async (query, variables = {}) => {

  try {
    const response = await axiosRequest.post('/emr/patient', {
      query,
      variables
    });

    if (response.data.errors) {

      // If data is null (backend issue), return empty object for graceful degradation
      if (response.data.data === null) {

        return {};
      }

      throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
    }

    return response.data.data;
  } catch (error) {

    throw error;
  }
};

/**
 * Update Student Profile with school information
 * Uses CREATE mutation for patient self-update (no userId needed)
 * @param {object} schoolData - School information (program, year, studentNumber, schoolYear, semester, studentCategory)
 * @returns {Promise} Response from server
 */
export const updateStudentProfile = async (schoolData) => {

  // Validation
  if (!schoolData.programId) {
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
      programId: schoolData.programId,
      year: mapYearToEnum(schoolData.schoolYear)
    }
  };

  try {
    const data = await sendGraphQLRequest(mutation, variables);

    return data.createStudentProfile;
  } catch (error) {

    throw error;
  }
};

export const updateEmployeeProfile = async (employeeData) => {
  if (!employeeData.employeeDepartment || !employeeData.employeeRole) {
    throw new Error('Department and employment category are required');
  }
  if (employeeData.employeeRole === 'Other' && !employeeData.employeeCategoryOther) {
    throw new Error('Specify the employment category');
  }
  const mutation = `
    mutation CreateEmployeeProfile($input: EmployeeProfileInput!) {
      createEmployeeProfile(input: $input) {
        id department role position status
      }
    }
  `;
  const data = await sendGraphQLRequest(mutation, {
    input: {
      department: employeeData.employeeDepartment,
      role: employeeData.employeeRole,
      position: employeeData.employeePosition || '',
      employmentCategoryOther: employeeData.employeeRole === 'Other' ? employeeData.employeeCategoryOther : null,
    },
  });
  return data.createEmployeeProfile;
};

/**
 * Update Emergency Contact information
 * Uses CREATE mutation for patient self-update (no userId needed)
 * @param {object} emergencyData - Emergency contact data (emergencyContact1Name, emergencyContact1Relationship, etc.)
 * @returns {Promise} Response from server
 */
export const updateEmergencyContact = async (emergencyData) => {

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
        address: emergencyData.emergencyContact1Address || null,
        isVerified: false
      },
      secondContact: {
        contactName: emergencyData.emergencyContact2Name,
        relationship: emergencyData.emergencyContact2Relationship,
        contactNumber: emergencyData.emergencyContact2Number,
        address: emergencyData.emergencyContact2Address || null,
        isVerified: false
      }
    }
  };

  try {
    const data = await sendGraphQLRequest(mutation, variables);

    return data.createEmergencyContact;
  } catch (error) {

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

  if (!formData) {
    throw new Error('Form data is required');
  }

  try {

    const profileResult = formData.profileType === 'Employee'
      ? await updateEmployeeProfile(formData)
      : await updateStudentProfile(formData);

    const contactResult = await updateEmergencyContact(formData);

    return {
      success: true,
      profile: profileResult,
      contact: contactResult
    };
  } catch (error) {

    throw new Error(`Personal information update failed: ${error.message}`);
  }
};
