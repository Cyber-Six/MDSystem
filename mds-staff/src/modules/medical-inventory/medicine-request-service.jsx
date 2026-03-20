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
  try {
    const response = await axiosRequest.post('/medical-inventory/medicine-request/medical', {
      query,
      variables,
    });

    if (response.data.errors) {
      console.error('❌ GraphQL Error:', response.data.errors);
      throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
    }

    return response.data.data;
  } catch (err) {
    const errorDetails = {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    };
    
    // Log full error details for debugging
    console.error('❌ sendGraphQL error:', errorDetails);
    
    // If HTTP error with response data, log it separately for visibility
    if (err.response?.data) {
      console.error('❌ Full error response:', JSON.stringify(err.response.data, null, 2));
    }
    
    throw err;
  }
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
        purpose
        notes
        approved_by
        created_at
        location
        items {
          id
          medicineId
          requestId
          quantity
          itemName
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
        purpose
        notes
        approved_by
        created_at
        location
        items {
          id
          medicineId
          requestId
          quantity
          itemName
        }
      }
    }`,
    { status, offset, limit },
  );
  return data.getAllMedicineRequests ?? [];
};

/**
 * Fetch one medicine request by ID (includes request items).
 * @param {string|number} requestId
 * @returns {Promise<Object|null>} MedicineRequest
 */
export const fetchMedicineRequestById = async (requestId) => {
  const data = await sendGraphQL(
    `query GetMedicineRequestById($requestId: ID!) {
      getMedicineRequestById(requestId: $requestId) {
        id
        patientId
        status
        purpose
        notes
        approved_by
        created_at
        location
        items {
          id
          medicineId
          requestId
          quantity
          itemName
        }
      }
    }`,
    { requestId },
  );

  return data.getMedicineRequestById ?? null;
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
  console.log('📤 setMedicineRequestStatus called:', { requestId, status, notes });
  const data = await sendGraphQL(
    `mutation SetStatusMedicineRequest($requestId: ID!, $status: RequestStatus!, $notes: String) {
      setStatusMedicineRequest(requestId: $requestId, status: $status, notes: $notes) {
        id
        patientId
        status
        purpose
        notes
        approved_by
        created_at
        location
        items {
          id
          medicineId
          requestId
          quantity
          itemName
          addedByStaff
        }
      }
    }`,
    { requestId, status, notes },
  );
  console.log('✅ setMedicineRequestStatus response:', data.setStatusMedicineRequest);
  return data.setStatusMedicineRequest;
};

/**
 * ✅ PART 2: Add extra medicine to an existing medicine request
 * @param {string|number} requestId
 * @param {Array<{medicineId: number, quantity: number}>} items
 * @returns {Promise<Object>} Updated MedicineRequest
 */
export const addMedicineToRequest = async (requestId, items) => {
  console.log('📤 addMedicineToRequest called:', { requestId, items });
  const data = await sendGraphQL(
    `mutation AddMedicineToRequest($requestId: ID!, $items: [MedicineRequestItemInput!]!) {
      addMedicineToRequest(requestId: $requestId, items: $items) {
        id
        patientId
        status
        purpose
        notes
        approved_by
        created_at
        location
        items {
          id
          medicineId
          requestId
          quantity
          itemName
          addedByStaff
        }
      }
    }`,
    { requestId, items },
  );
  console.log('✅ addMedicineToRequest response:', data.addMedicineToRequest);
  return data.addMedicineToRequest;
};
