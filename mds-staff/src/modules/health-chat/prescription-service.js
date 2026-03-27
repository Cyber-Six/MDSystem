/**
 * Prescription Service – Staff Health Chat
 *
 * GraphQL calls for issuing prescriptions from within the health-chat module.
 * Endpoint: /medical-inventory/prescription/medical
 */

import { axiosRequest } from '../../packages-core-adapter';

const ENDPOINT = '/medical-inventory/prescription/medical';

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post(ENDPOINT, { query, variables });
  if (response.data.errors) {
    const error = new Error(response.data.errors[0]?.message || 'GraphQL error');
    error.graphQLErrors = response.data.errors;
    throw error;
  }
  return response.data.data;
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
