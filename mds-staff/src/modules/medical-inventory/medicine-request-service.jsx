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
    console.error('❌ sendGraphQL error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
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
        location
        created_at
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
 * Fetch all medicine requests (optionally filtered by status and location).
 * @param {'Pending'|'Approved'|'Rejected'|'Cancelled'|'InProgress'|'Completed'|'Revision'|'RevisionSubmitted'|'Expired'} [status]
 * @param {string|null} [location] - LocationDesignation: 'Arlegui' | 'Casal' | 'QuezonCity'
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} MedicineRequest[]
 */
export const fetchAllMedicineRequests = async (status = null, location = null, offset = 0, limit = 50) => {
  // Build variables object, only including non-null values
  const variables = { offset, limit };
  if (status !== null) variables.status = status;
  if (location !== null) variables.location = location;

  const data = await sendGraphQL(
    `query GetAllMedicineRequests($status: RequestStatus, $location: LocationDesignation, $offset: Int, $limit: Int) {
      getAllMedicineRequests(status: $status, location: $location, offset: $offset, limit: $limit) {
        id
        patientId
        status
        purpose
        notes
        approved_by
        location
        created_at
        items {
          id
          medicineId
          requestId
          quantity
          itemName
        }
      }
    }`,
    variables,
  );
  return data.getAllMedicineRequests ?? [];
};

/**
 * Fetch all medicine requests for every supplied location in ONE GraphQL
 * request using field aliases, then merge and deduplicate by ID.
 *
 * Replaces the previous pattern of one fetchAllMedicineRequests() call per
 * location, reducing N_locations HTTP requests to 1.
 *
 * @param {string[]} locations — LocationDesignation values e.g. ['Arlegui','Casal']
 * @returns {Promise<Array>} Deduplicated MedicineRequest[]
 */
export const fetchAllMedicineRequestsByLocations = async (locations) => {
  if (locations.length === 0) return [];

  const reqFields = `id patientId status purpose notes approved_by location created_at items { id medicineId requestId quantity itemName }`;

  // Build one query with one alias per location
  const aliasParts = locations.map(
    (loc) => `${loc}: getAllMedicineRequests(location: ${loc}) { ${reqFields} }`,
  );

  let data;
  try {
    const response = await axiosRequest.post('/medical-inventory/medicine-request/medical', {
      query: `{ ${aliasParts.join('\n')} }`,
    });
    if (response.data.errors) {
      console.warn('⚠️ Partial errors in batched medicine requests:', response.data.errors.map((e) => e.message));
    }
    data = response.data.data ?? {};
  } catch (err) {
    console.error('❌ fetchAllMedicineRequestsByLocations error:', err.message);
    return [];
  }

  // Merge all location arrays and deduplicate by request id
  const all = locations.flatMap((loc) => data[loc] ?? []);
  return Array.from(new Map(all.map((r) => [r.id, r])).values());
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
        location
        created_at
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
        items {
          id
          medicineId
          requestId
          quantity
          itemName
        }
      }
    }`,
    { requestId, status, notes },
  );
  console.log('✅ setMedicineRequestStatus response:', data.setStatusMedicineRequest);
  return data.setStatusMedicineRequest;
};
