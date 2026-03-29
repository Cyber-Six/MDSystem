/**
 * Prescription Service – Staff Health Chat
 *
 * Functions for generating prescription PDFs and issuing prescriptions from
 * within the health-chat module.
 */

import { axiosRequest } from '../../packages-core-adapter';

const INVENTORY_ENDPOINT = '/medical-inventory/prescription/medical';
const PRESCRIPTION_PDF_ENDPOINT = '/documents/prescription';

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post(INVENTORY_ENDPOINT, { query, variables });
  if (response.data.errors) {
    const error = new Error(response.data.errors[0]?.message || 'GraphQL error');
    error.graphQLErrors = response.data.errors;
    throw error;
  }
  return response.data.data;
};

/**
 * Generate a prescription PDF via the document service.
 *
 * @param {Object} data
 * @param {string} data.patient_name
 * @param {string} data.patient_age
 * @param {string} data.patient_sex
 * @param {Array}  data.medications - [{ name, dosage, frequency, duration, quantity, instructions }]
 * @param {string} [data.notes]
 * @returns {Promise<Blob>} PDF blob
 */
export const generatePrescriptionPdf = async (data) => {
  const response = await axiosRequest.post(PRESCRIPTION_PDF_ENDPOINT, data, {
    responseType: 'blob',
  });
  return response.data;
};

export const getAvailableMedicine = async (location = null, offset = 0, limit = 200) => {
  const data = await sendGraphQL(
    `query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
      getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
        id
        item_code
        item_name
        batchId
        batchNumber
        dosageUnit
        dosageValue
        expiryDate
        location
      }
    }`,
    { location, offset, limit }
  );
  return data.getAvailableMedicine;
};

export const issuePrescription = async (input) => {
  const data = await sendGraphQL(
    `mutation IssuePrescription($input: IssuePrescriptionInput!) {
      issuePrescription(input: $input) {
        id
        patientId
        quantity
        issuedAt
        notes
      }
    }`,
    { input }
  );
  return data.issuePrescription;
};
