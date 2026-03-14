/**
 * Staff Medicine Request Service
 * Handles GraphQL calls to the staff medicine request endpoint.
 * Endpoint: POST /medical-inventory/medicine-request/medical (JWT guard: medical)
 *
 * NOTE: The backend must register this endpoint in server.js:
 *   const { initMedicalMedicineRequestGraphQL } = require('./routes/medical-inventory/medicine-request/graphql.js');
 *   initMedicalMedicineRequestGraphQL(app);
 */

import { axiosRequest } from '../../packages-core-adapter';

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/medical-inventory/medicine-request/medical', {
    query,
    variables,
  });

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }

  return response.data.data;
};

/**
 * Fetch all medicine requests for a specific patient.
 * @param {string|number} patientId
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} MedicineRequest[]
 */
export const fetchPatientMedicineRequests = async (patientId, offset = 0, limit = 50) => {
  const data = await sendGraphQL(
    `query GetMedicineRequests($patientId: ID!, $offset: Int, $limit: Int) {
      getMedicineRequests(patientId: $patientId, offset: $offset, limit: $limit) {
        id
        patientId
        status
        transactionId
        purpose
        notes
        approved_by
        created_at
        items {
          id
          batchId
          requestId
          quantity
        }
      }
    }`,
    { patientId, offset, limit },
  );
  return data.getMedicineRequests ?? [];
};

/**
 * Fetch all medicine requests (optionally filtered by status).
 * @param {'Pending'|'Approved'|'Rejected'|'Cancelled'} [status]
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} MedicineRequest[]
 */
export const fetchAllMedicineRequests = async (status = null, offset = 0, limit = 50) => {
  const data = await sendGraphQL(
    `query GetAllMedicineRequests($status: RequestStatus, $offset: Int, $limit: Int) {
      getAllMedicineRequests(status: $status, offset: $offset, limit: $limit) {
        id
        patientId
        status
        transactionId
        purpose
        notes
        approved_by
        created_at
        items {
          id
          batchId
          requestId
          quantity
        }
      }
    }`,
    { status, offset, limit },
  );
  return data.getAllMedicineRequests ?? [];
};

/**
 * Approve, reject, or cancel a medicine request.
 * Only requests with status "Pending" can be updated.
 * @param {string|number} requestId
 * @param {'Approved'|'Rejected'|'Cancelled'} status
 * @param {string|null} [notes]
 * @returns {Promise<Object>} Updated MedicineRequest
 */
export const setMedicineRequestStatus = async (requestId, status, notes = null) => {
  const data = await sendGraphQL(
    `mutation SetStatusMedicineRequest($requestId: ID!, $status: RequestStatus!, $notes: String) {
      setStatusMedicineRequest(requestId: $requestId, status: $status, notes: $notes) {
        id
        patientId
        status
        transactionId
        purpose
        notes
        approved_by
        created_at
        items {
          id
          batchId
          requestId
          quantity
        }
      }
    }`,
    { requestId, status, notes },
  );
  return data.setStatusMedicineRequest;
};
