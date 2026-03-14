/**
 * Prescription Service
 * Handles all GraphQL queries and mutations for the prescription/dispensing system.
 * Endpoint: POST /medical-inventory/prescription/medical (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── Helper ──────────────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/medical-inventory/prescription/medical', {
    query,
    variables,
  });

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }

  return response.data.data;
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get all available medicines grouped by batch.
 * @param {string|null} [location] - LocationDesignation: 'Arlegui' | 'Casal' | 'QuezonCity'
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} AvailableMedicine[]
 */
export const fetchAvailableMedicine = async (location = null, offset = 0, limit = 50) => {
  const data = await sendGraphQL(
    `query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
      getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
        id
        item_code
        item_name
        category
        description
        batchId
        batchNumber
        dosageUnit
        dosageValue
        expiryDate
        location
      }
    }`,
    { location, offset, limit },
  );
  return data.getAvailableMedicine ?? [];
};

/**
 * Get patient's prescription history.
 * @param {string|number} patientId
 * @param {number} [offset=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} PrescriptionTransaction[]
 */
export const fetchPatientPrescriptions = async (patientId, offset = 0, limit = 20) => {
  const data = await sendGraphQL(
    `query GetPatientPrescriptions($patientId: ID!, $offset: Int, $limit: Int) {
      getPatientPrescriptions(patientId: $patientId, offset: $offset, limit: $limit) {
        id
        patientId
        action
        quantity
        issuedBy
        issuedAt
        notes
        items {
          id
          batchId
          transactionId
        }
      }
    }`,
    { patientId, offset, limit },
  );
  return data.getPatientPrescriptions ?? [];
};

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Issue a prescription (dispense medicine to patient).
 * Creates MedicineEntity assignments and PrescriptionTransaction record.
 * @param {{ patientId: number, items: Array<{batchId: number, quantity: number}>, notes?: string }} input
 * @returns {Promise<Object>} PrescriptionTransaction with items
 */
export const issuePrescription = async (input) => {
  const data = await sendGraphQL(
    `mutation IssuePrescription($input: IssuePrescriptionInput!) {
      issuePrescription(input: $input) {
        id
        patientId
        action
        quantity
        issuedBy
        issuedAt
        notes
        items {
          id
          batchId
          transactionId
        }
      }
    }`,
    { input },
  );
  return data.issuePrescription;
};
