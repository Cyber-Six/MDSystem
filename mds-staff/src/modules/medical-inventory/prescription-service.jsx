/**
 * Prescription Service
 * Handles all GraphQL queries and mutations for the prescription/dispensing system.
 * Endpoint: POST /medical-inventory/prescription/medical (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

const INVENTORY_BATCH_QUERY_CHUNK = 25;

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

const normalizeInventoryItemIds = (ids = []) => {
  const normalized = ids
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [...new Set(normalized)];
};

const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let index = 0; index < array.length; index += chunkSize) {
    chunks.push(array.slice(index, index + chunkSize));
  }
  return chunks;
};

const fetchBatchAvailabilityMap = async (itemIds = [], location = null) => {
  const normalizedItemIds = normalizeInventoryItemIds(itemIds);
  if (normalizedItemIds.length === 0) {
    return new Map();
  }

  const availabilityByBatchId = new Map();
  const itemChunks = chunkArray(normalizedItemIds, INVENTORY_BATCH_QUERY_CHUNK);

  for (const chunk of itemChunks) {
    const fields = chunk
      .map((itemId) => (
        `item_${itemId}: getMedicalSupply(medicalItemId: ${itemId}, location: $location) {
          id
          availableQuantity
        }`
      ))
      .join('\n');

    const query = `query BatchMedicalSupply($location: LocationDesignation) {
      ${fields}
    }`;

    const response = await axiosRequest.post('/medical-inventory/medical', {
      query,
      variables: { location },
    });

    if (Array.isArray(response.data?.errors) && response.data.errors.length > 0) {
      // Keep partial success payload and continue instead of failing all rows.
      console.warn('[Prescription] Partial GraphQL errors in batched supply fetch:', response.data.errors.map((error) => error.message));
    }

    const data = response.data?.data || {};
    for (const itemId of chunk) {
      const key = `item_${itemId}`;
      const batches = Array.isArray(data[key]) ? data[key] : [];
      batches.forEach((batch) => {
        const batchId = String(batch?.id || '').trim();
        if (!batchId) return;

        availabilityByBatchId.set(batchId, Number(batch?.availableQuantity) || 0);
      });
    }
  }

  return availabilityByBatchId;
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

/**
 * Get available medicines with exact quantities from inventory.
 * Enriches prescription medicines with batch quantity details.
 * @param {string|null} [location] - LocationDesignation: 'Arlegui' | 'Casal' | 'QuezonCity'
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} AvailableMedicine[] with availableQuantity
 */
export const fetchAvailableMedicineWithQuantities = async (location = null, offset = 0, limit = 50) => {
  try {
    // Location is required to prevent unauthorized access errors
    if (!location) {
      console.warn('fetchAvailableMedicineWithQuantities: location is required');
      return [];
    }

    // Fetch available medicines from prescription endpoint
    const medicines = await fetchAvailableMedicine(location, offset, limit);
    
    const uniqueItemIds = normalizeInventoryItemIds(medicines.map((medicine) => medicine?.id));
    const availabilityByBatchId = await fetchBatchAvailabilityMap(uniqueItemIds, location);

    return medicines.map((medicine) => {
      const batchId = String(medicine?.batchId || '').trim();
      return {
        ...medicine,
        availableQuantity: batchId ? (availabilityByBatchId.get(batchId) || 0) : 0,
      };
    });
  } catch (err) {
    console.error('Error fetching medicines with quantities:', err);
    // Fallback to medicines without quantities
    return await fetchAvailableMedicine(location, offset, limit);
  }
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
