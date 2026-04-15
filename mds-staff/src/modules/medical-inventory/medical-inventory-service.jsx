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

// Map legacy/lowercase category values to GraphQL enum casing.
const normalizeItemCategory = (category) => {
  if (!category || typeof category !== 'string') return undefined;
  const normalized = category.trim().toLowerCase();
  if (normalized === 'medicine') return ITEM_CATEGORY.MEDICINE;
  if (normalized === 'supply') return ITEM_CATEGORY.SUPPLY;
  return undefined;
};

// Helper to display location name
export const getDisplayLocation = (location) => {
  return LOCATION_DISPLAY[location] || location;
};

// ── Batch Display Utilities ──────────────────────────────────────────────────

/**
 * Format date for display (remove time portion)
 * @param {string|number|Date|null} dateValue
 * @returns {string} Formatted date (e.g., "May 2026") or "N/A"
 */
export const formatDateDisplay = (dateValue) => {
  if (!dateValue && dateValue !== 0) return 'N/A';
  try {
    let date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
    } else if (typeof dateValue === 'number') {
      date = dateValue > 10000000000 ? new Date(dateValue) : new Date(dateValue * 1000);
      if (isNaN(date.getTime())) return 'N/A';
    } else if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return 'N/A';
      date = dateValue;
    } else {
      return 'N/A';
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return 'N/A';
  }
};

/**
 * Format batch information in consistent format.
 * Format: "Batch #123 — 47 available — Expires: May 2026"
 * @param {Object} batch - Batch object with batchNumber, availableQuantity|currentQuantity, expiryDate
 * @param {Object} options - { compact?: boolean, showUnit?: boolean }
 * @returns {string} Formatted batch display string
 */
export const formatBatchDisplay = (batch, options = {}) => {
  if (!batch) return 'N/A';
  
  const { compact = false, showUnit = true } = options;
  const batchNum = batch.batchNumber || batch.id || 'Unknown';
  const quantity = batch.availableQuantity ?? batch.currentQuantity ?? 0;
  const unit = showUnit ? ' units' : '';
  const expiryStr = formatDateDisplay(batch.expiryDate);
  
  if (compact) {
    // Compact: "Batch #123 (47 units, Exp: May 2026)"
    return `Batch #${batchNum} (${quantity}${unit}, Exp: ${expiryStr})`;
  }
  
  // Full format: "Batch #123 — 47 available — Expires: May 2026"
  return `Batch #${batchNum} — ${quantity} available — Expires: ${expiryStr}`;
};

/**
 * Get batch summary for dropdowns/selects
 * Format: "#123 (Exp: May 2026) — 47 avail"
 * @param {Object} batch
 * @returns {string}
 */
export const getBatchDropdownText = (batch) => {
  if (!batch) return 'No batch';
  const batchNum = batch.batchNumber || batch.id || '?';
  const expiry = formatDateDisplay(batch.expiryDate);
  const qty = batch.availableQuantity ?? batch.currentQuantity ?? 0;
  return `#${batchNum} (Exp: ${expiry}) — ${qty} avail`;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

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

/**
 * Like sendGraphQL but tolerates partial field errors — returns whatever data
 * the server resolved, only logs any field-level errors rather than throwing.
 * Used for batched alias queries where one item failing shouldn't abort the rest.
 */
const sendGraphQLPartial = async (query, variables = {}) => {
  const response = await axiosRequest.post('/medical-inventory/medical', {
    query,
    variables,
  });
  if (response.data.errors) {
    console.warn('[Inventory] Partial GraphQL errors in batched batch fetch:', response.data.errors.map((e) => e.message));
  }
  return response.data.data ?? {};
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
  const payload = {
    ...input,
    category: normalizeItemCategory(input?.category),
  };

  const data = await sendGraphQL(
    `mutation CreateMedicalItem($input: MedicalItemInput!) {
      createMedicalItems(input: $input) {${MEDICAL_ITEM_FIELDS}
      }
    }`,
    { input: payload },
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
  const payload = { ...input };
  if (Object.prototype.hasOwnProperty.call(payload, 'category')) {
    const normalizedCategory = normalizeItemCategory(payload.category);
    if (normalizedCategory) {
      payload.category = normalizedCategory;
    } else {
      delete payload.category;
    }
  }

  const data = await sendGraphQL(
    `mutation UpdateMedicalItem($id: ID!, $input: MedicalItemUpdateInput!) {
      updateMedicalItems(id: $id, input: $input) {${MEDICAL_ITEM_FIELDS}
      }
    }`,
    { id, input: payload },
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
        batchNumber
        currentQuantity
        unit
        expiryDate
        location
        receivedBy
        supplierName
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

/**
 * Fetch medicine batches for a medical item.
 * @param {number} medicalItemId - ID of the medical item
 * @param {string|null} [location] - LocationDesignation: 'Arlegui' | 'Casal' | 'QuezonCity'
 * @param {boolean|null} [availableOnly] - Filter to only batches with available quantity > 0
 * @param {number} [offset] - Pagination offset
 * @param {number} [limit] - Pagination limit
 * @returns {Promise<Array>} MedicineBatch[]
 */
export const fetchMedicineBatches = async (medicalItemId, location = null, availableOnly = null, offset = null, limit = null) => {
  // Build variables object, only including non-null values
  const variables = { medicalItemId };
  if (location !== null) variables.location = location;
  if (availableOnly !== null) variables.availableOnly = availableOnly;
  if (offset !== null) variables.offset = offset;
  if (limit !== null) variables.limit = limit;

  const data = await sendGraphQL(
    `query GetMedicalSupply($medicalItemId: Int!, $location: LocationDesignation, $availableOnly: Boolean, $offset: Int, $limit: Int) {
      getMedicalSupply(medicalItemId: $medicalItemId, location: $location, availableOnly: $availableOnly, offset: $offset, limit: $limit) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    variables,
  );
  return data.getMedicalSupply ?? [];
};

/**
 * Fetch supply batches for a supply item.
 * @param {number} supplyItemId - ID of the supply item
 * @param {string|null} [location] - LocationDesignation: 'Arlegui' | 'Casal' | 'QuezonCity'
 * @param {boolean|null} [availableOnly] - Filter to only batches with available quantity > 0
 * @param {number} [offset] - Pagination offset
 * @param {number} [limit] - Pagination limit
 * @returns {Promise<Array>} SupplyBatch[]
 */
export const fetchSupplyBatches = async (supplyItemId, location = null, availableOnly = null, offset = null, limit = null) => {
  // Build variables object, only including non-null values
  const variables = { supplyItemId };
  if (location !== null) variables.location = location;
  if (availableOnly !== null) variables.availableOnly = availableOnly;
  if (offset !== null) variables.offset = offset;
  if (limit !== null) variables.limit = limit;

  const data = await sendGraphQL(
    `query GetSupplyBatches($supplyItemId: Int!, $location: LocationDesignation, $availableOnly: Boolean, $offset: Int, $limit: Int) {
      getSupplyBatches(supplyItemId: $supplyItemId, location: $location, availableOnly: $availableOnly, offset: $offset, limit: $limit) {${SUPPLY_BATCH_FIELDS}
      }
    }`,
    variables,
  );
  return data.getSupplyBatches ?? [];
};

// ── Batched Batch Fetcher ─────────────────────────────────────────────────────

/**
 * Fetch batches for ALL items at ALL locations in ONE GraphQL request using
 * field aliases.  Replaces the previous N×M individual fetch loop.
 *
 * Each alias is named:
 *   `med_{itemId}_{location}` → getMedicalSupply (medicine items)
 *   `sup_{itemId}_{location}` → getSupplyBatches  (supply items)
 *
 * Returns normalised batch objects ready for state (same shape as the old
 * per-item fetch loop produced).
 *
 * @param {Array<{id: string|number, category: string}>} items
 * @param {string[]} locations  — subset of LocationDesignation enum values
 * @returns {Promise<Array>} Normalised batch objects
 */
export const fetchAllBatchesForItems = async (items, locations) => {
  if (items.length === 0 || locations.length === 0) return [];

  // Inline field lists (no variables needed — all values are inlined as literals)
  const medF = `id medicalItemId supplierName batchNumber dosageUnit dosageValue availableQuantity expiryDate location receivedBy notes created_at`;
  const supF = `id supplyItemId batchNumber currentQuantity unit expiryDate location receivedBy supplierName notes created_at`;

  const aliasParts = [];
  for (const item of items) {
    const isMedicine = item.category?.toLowerCase() === 'medicine';
    const numId = Number(item.id);
    for (const loc of locations) {
      if (isMedicine) {
        aliasParts.push(
          `med_${numId}_${loc}: getMedicalSupply(medicalItemId: ${numId}, location: ${loc}) { ${medF} }`,
        );
      } else {
        aliasParts.push(
          `sup_${numId}_${loc}: getSupplyBatches(supplyItemId: ${numId}, location: ${loc}) { ${supF} }`,
        );
      }
    }
  }

  const query = `{ ${aliasParts.join('\n')} }`;
  const data = await sendGraphQLPartial(query);

  // Collect and normalise results
  const result = [];
  for (const item of items) {
    const isMedicine = item.category?.toLowerCase() === 'medicine';
    const numId = Number(item.id);
    for (const loc of locations) {
      const alias = isMedicine ? `med_${numId}_${loc}` : `sup_${numId}_${loc}`;
      const raw = data[alias];
      if (!Array.isArray(raw)) continue;
      for (const b of raw) {
        if (isMedicine) {
          result.push({
            id: b.id,
            medicalItemId: Number(b.medicalItemId),
            batchNumber: b.batchNumber,
            currentQuantity: Number(b.availableQuantity ?? 0),
            availableQuantity: Number(b.availableQuantity ?? 0),
            initialQuantity: Number(b.availableQuantity ?? 0),
            dosageValue: Number(b.dosageValue ?? 0),
            dosageUnit: b.dosageUnit,
            expiryDate: b.expiryDate,
            location: b.location,
            supplierName: b.supplierName,
            notes: b.notes,
          });
        } else {
          result.push({
            id: b.id,
            medicalItemId: Number(b.supplyItemId),
            batchNumber: b.batchNumber,
            currentQuantity: Number(b.currentQuantity ?? 0),
            availableQuantity: Number(b.currentQuantity ?? 0),
            unit: b.unit,
            expiryDate: b.expiryDate,
            location: b.location,
            supplierName: b.supplierName,
            notes: b.notes,
          });
        }
      }
    }
  }
  return result;
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

/**
 * Update a supply batch (currentQuantity, expiryDate, notes).
 * @param {string|number} batchId - ID of the batch to update
 * @param {{ currentQuantity?: number, expiryDate?: string, notes?: string }} input
 * @returns {Promise<Object>} Updated SupplyBatch
 */
export const updateSupplyBatch = async (batchId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateSupplyBatch($batchId: ID!, $input: SupplyBatchUpdateInput!) {
      updateSupplyBatch(batchId: $batchId, input: $input) {${SUPPLY_BATCH_FIELDS}
      }
    }`,
    { batchId, input },
  );
  return data.updateSupplyBatch;
};

/**
 * Update a medicine batch (availableQuantity, expiryDate, notes).
 * @param {string|number} batchId - ID of the batch to update
 * @param {{ currentQuantity?: number, expiryDate?: string, notes?: string }} input
 * @returns {Promise<Object>} Updated MedicineBatch
 */
export const updateMedicineBatch = async (batchId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateMedicalSupply($batchId: ID!, $input: MedicalSupplyUpdateInput!) {
      updateMedicalSupply(batchId: $batchId, input: $input) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    { batchId, input },
  );
  return data.updateMedicalSupply;
};
