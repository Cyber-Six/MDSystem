/**
 * Medical Inventory Service
 * Handles all GraphQL queries and mutations for the medical inventory endpoint.
 * Endpoint: POST /medical-inventory/medical (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── Constants ────────────────────────────────────────────────────────────────

export const ITEM_CATEGORY = {
  MEDICINE: 'Medicine',
  SUPPLY: 'Supply',
};

export const LOCATION = {
  ARLEGUI: 'Arlegui',
  CASAL: 'Casal',
  QUEZON_CITY: 'QuezonCity',
};

// Display mapping: convert backend values to UI display text
export const LOCATION_DISPLAY = {
  'Arlegui': 'Arlegui',
  'Casal': 'Casal',
  'QuezonCity': 'Quezon City',
};

export const ALL_CATEGORIES = Object.values(ITEM_CATEGORY);
export const ALL_LOCATIONS = Object.values(LOCATION);

// Helper to display location name
export const getDisplayLocation = (location) => {
  return LOCATION_DISPLAY[location] || location;
};

// ── Internal helper ──────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/medical-inventory/medical', {
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
 * Fetch all medical items (paginated, optional category filter).
 * @param {string|null} [category] - ItemCategory enum: 'Medicine' | 'Supply'
 * @param {number} [offset=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} MedicalItem[]
 */
export const fetchMedicalItems = async (category = null, offset = 0, limit = 20) => {
  const data = await sendGraphQL(
    `query GetMedicalItems($category: ItemCategory, $offset: Int, $limit: Int) {
      getMedicalItems(category: $category, offset: $offset, limit: $limit) {
        id
        item_code
        item_name
        category
        description
        active
        created_at
        updated_at
      }
    }`,
    { category, offset, limit },
  );
  return data.getMedicalItems ?? [];
};

/**
 * Fetch a single medical item by ID.
 * @param {string|number} id
 * @returns {Promise<Object|null>} MedicalItem
 */
export const fetchMedicalItem = async (id) => {
  const data = await sendGraphQL(
    `query GetMedicalItem($id: ID!) {
      getMedicalItem(id: $id) {
        id
        item_code
        item_name
        category
        description
        active
        created_at
        updated_at
      }
    }`,
    { id },
  );
  return data.getMedicalItem ?? null;
};

// ── Mutations ────────────────────────────────────────────────────────────────

const MEDICAL_ITEM_FIELDS = `
        id
        item_code
        item_name
        category
        description
        active
        created_at
        updated_at`;

/**
 * Create a new medical item.
 * @param {{ item_code: string, item_name: string, category: string, description?: string }} input
 * @returns {Promise<Object>} Created MedicalItem
 */
export const createMedicalItem = async (input) => {
  const data = await sendGraphQL(
    `mutation CreateMedicalItem($input: MedicalItemInput!) {
      createMedicalItems(input: $input) {${MEDICAL_ITEM_FIELDS}
      }
    }`,
    { input },
  );
  return data.createMedicalItems;
};

/**
 * Update an existing medical item.
 * @param {string|number} id
 * @param {{ item_code?: string, item_name?: string, category?: string, description?: string, active?: boolean }} input
 * @returns {Promise<Object>} Updated MedicalItem
 */
export const updateMedicalItem = async (id, input) => {
  const data = await sendGraphQL(
    `mutation UpdateMedicalItem($id: ID!, $input: MedicalItemUpdateInput!) {
      updateMedicalItems(id: $id, input: $input) {${MEDICAL_ITEM_FIELDS}
      }
    }`,
    { id, input },
  );
  return data.updateMedicalItems;
};

/**
 * Soft-delete (deactivate) a medical item.
 * @param {string|number} id
 * @returns {Promise<boolean>}
 */
export const deleteMedicalItem = async (id) => {
  const data = await sendGraphQL(
    `mutation DeleteMedicalItem($id: ID!) {
      deleteMedicalItems(id: $id)
    }`,
    { id },
  );
  return data.deleteMedicalItems;
};

// ── Batch Mutations ──────────────────────────────────────────────────────────

const MEDICINE_BATCH_FIELDS = `
        id
        medicalItemId
        supplierName
        batchNumber
        dosageUnit
        dosageValue
        availableQuantity
        expiryDate
        location
        receivedBy
        notes
        created_at`;

const SUPPLY_BATCH_FIELDS = `
        id
        supplyItemId
        batch_number
        initialQuantity
        currentQuantity
        unit
        expiry_date
        location
        received_at
        receivedBy
        supplier_name
        notes
        created_at`;

/**
 * Add a medicine batch (supply for medicine items).
 * @param {{ medicalItemId: number, batchNumber: string, dosageUnit: string, dosageValue: number, expiryDate?: string, location: string, supplierName?: string, notes?: string }} input
 * @returns {Promise<Object>} Created MedicineBatch
 */
export const addMedicineSupply = async (input) => {
  const data = await sendGraphQL(
    `mutation AddMedicalSupply($input: MedicineBatchInput!) {
      addMedicalSupply(input: $input) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    { input },
  );
  return data.addMedicalSupply;
};

/**
 * Add a supply batch (supply for supply items).
 * @param {{ supplyItemId: number, batch_number: string, initialQuantity: number, unit: string, expiry_date?: string, location: string, received_at?: string, supplier_name?: string, notes?: string }} input
 * @returns {Promise<Object>} Created SupplyBatch
 */
export const addSupplyBatch = async (input) => {
  const data = await sendGraphQL(
    `mutation AddSupplyBatch($input: SupplyBatchInput!) {
      addSupplyBatch(input: $input) {${SUPPLY_BATCH_FIELDS}
      }
    }`,
    { input },
  );
  return data.addSupplyBatch;
};

// ── Batch Queries ─────────────────────────────────────────────────────────────

export const fetchMedicineBatches = async (medicalItemId) => {
  const data = await sendGraphQL(
    `query GetMedicalSupply($medicalItemId: Int!) {
      getMedicalSupply(medicalItemId: $medicalItemId) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    { medicalItemId },
  );
  return data.getMedicalSupply ?? [];
};

export const fetchSupplyBatches = async (supplyItemId) => {
  const data = await sendGraphQL(
    `query GetSupplyBatches($supplyItemId: Int!) {
      getSupplyBatches(supplyItemId: $supplyItemId) {${SUPPLY_BATCH_FIELDS}
      }
    }`,
    { supplyItemId },
  );
  return data.getSupplyBatches ?? [];
};

// ── Split Mutations ──────────────────────────────────────────────────────────

/**
 * Split a medicine batch (move units to a new batch at target location).
 * @param {string|number} batchId - ID of the batch to split
 * @param {{ quantity: number, targetLocation: string, notes?: string }} input
 * @returns {Promise<Object>} New MedicineBatch
 */
export const splitMedicineSupply = async (batchId, input) => {
  const data = await sendGraphQL(
    `mutation SplitMedicineSupply($batchId: ID!, $input: SplitMedicalSupplyInput!) {
      splitMedicineSupply(batchId: $batchId, input: $input) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    { batchId, input },
  );
  return data.splitMedicineSupply;
};

/**
 * Split a supply batch (move units to a new batch at target location).
 * @param {string|number} batchId - ID of the batch to split
 * @param {{ quantity: number, targetLocation: string, notes?: string }} input
 * @returns {Promise<Object>} New SupplyBatch
 */
export const splitMedicalSupply = async (batchId, input) => {
  const data = await sendGraphQL(
    `mutation SplitMedicalSupply($batchId: ID!, $input: SplitMedicalSupplyInput!) {
      splitMedicalSupply(batchId: $batchId, input: $input) {${SUPPLY_BATCH_FIELDS}
      }
    }`,
    { batchId, input },
  );
  return data.splitMedicalSupply;
};
