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

/**
 * Update a medicine batch (currentQuantity, expiryDate, notes).
 * Note: The response field is 'availableQuantity' but the input field is 'currentQuantity'
 * @param {string|number} batchId - ID of the batch to update
 * @param {{ currentQuantity?: number, expiryDate?: string, notes?: string }} input
 * @returns {Promise<Object>} Updated MedicineBatch
 */
export const updateMedicalSupply = async (batchId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateMedicalSupply($batchId: ID!, $input: MedicalSupplyUpdateInput!) {
      updateMedicalSupply(batchId: $batchId, input: $input) {${MEDICINE_BATCH_FIELDS}
      }
    }`,
    { batchId, input },
  );
  return data.updateMedicalSupply;
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

// ── Audit Trail & History ────────────────────────────────────────────────────

/**
 * Create an audit trail record for stock adjustment.
 * This creates a structured audit entry with all details needed for tracking.
 * @param {Object} adjustmentData - Complete adjustment details
 * @returns {Object} Formatted audit record
 */
export const createAuditRecord = ({
  batchId,
  itemId,
  itemName,
  category,
  batchNumber,
  location,
  previousQuantity,
  newQuantity,
  adjustmentType, // 'add' or 'subtract'
  quantity,
  reason,
  userId,
  userName,
}) => {
  const adjustmentAmount = adjustmentType === 'add' ? quantity : -quantity;
  
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action: 'adjust',
    category: category?.toLowerCase() || 'supply',
    itemId: Number(itemId),
    itemName: itemName || 'Unknown Item',
    batchId: Number(batchId),
    batchNumber: batchNumber || 'Unknown',
    location: location || 'Unknown',
    previousQuantity: Number(previousQuantity),
    newQuantity: Number(newQuantity),
    adjustmentAmount: adjustmentAmount,
    adjustmentType: adjustmentType,
    quantity: Number(quantity),
    reason: reason || 'No reason provided',
    userId: userId || null,
    userName: userName || 'System User',
    createdAt: new Date().toISOString(),
    // Metadata for audit compliance
    metadata: {
      isAdjustment: true,
      source: 'medical-inventory-adjustment',
      systemVersion: '1.0',
    },
  };
};

/**
 * Format audit record for display in history table.
 * @param {Object} record - Raw audit record
 * @returns {Object} Formatted for UI display
 */
export const formatAuditRecordForDisplay = (record) => {
  return {
    id: record.id,
    action: 'adjust',
    itemName: record.itemName,
    category: record.category === 'medicine' ? 'Medicine' : 'Medical Supply',
    batchNumber: record.batchNumber,
    location: record.location,
    type: record.adjustmentType === 'add' ? 'Stock Increase' : 'Stock Decrease',
    previousQuantity: record.previousQuantity,
    newQuantity: record.newQuantity,
    adjustmentAmount: Math.abs(record.adjustmentAmount),
    quantity: record.quantity,
    reason: record.reason,
    notes: `${record.adjustmentType === 'add' ? 'Increased' : 'Decreased'} by ${record.quantity} units - ${record.reason}`,
    issuedBy: record.userId,
    issuedByName: record.userName,
    issuedAt: record.createdAt,
    timestamp: record.createdAt,
    // Additional details
    details: {
      previousQty: record.previousQuantity,
      newQty: record.newQuantity,
      delta: record.adjustmentAmount,
      reason: record.reason,
      category: record.category,
    },
  };
};

/**
 * Store audit records in local storage for persistence (backup method)
 * @param {Object} auditRecord - The audit record to store
 */
export const storeAuditRecordLocally = (auditRecord) => {
  try {
    const existing = localStorage.getItem('inventory_audit_trail') || '[]';
    const records = JSON.parse(existing);
    records.push(auditRecord);
    // Keep only last 500 records to prevent storage bloat
    if (records.length > 500) {
      records.shift();
    }
    localStorage.setItem('inventory_audit_trail', JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to store audit record locally:', err);
  }
};

/**
 * Retrieve audit records from local storage (backup method)
 * @param {Object} filters - Optional filters { itemName, batchNumber, action }
 * @returns {Array} Array of audit records
 */
export const getLocalAuditRecords = (filters = {}) => {
  try {
    const audits = JSON.parse(localStorage.getItem('inventory_audit_trail') || '[]');
    
    if (!filters || Object.keys(filters).length === 0) {
      return audits;
    }
    
    return audits.filter(record => {
      if (filters.itemName && record.itemName !== filters.itemName) return false;
      if (filters.batchNumber && record.batchNumber !== filters.batchNumber) return false;
      if (filters.action && record.action !== filters.action) return false;
      if (filters.category && record.category !== filters.category?.toLowerCase()) return false;
      return true;
    });
  } catch (err) {
    console.warn('Failed to retrieve audit records:', err);
    return [];
  }
};

/**
 * Clear audit records from local storage
 */
export const clearLocalAuditRecords = () => {
  try {
    localStorage.removeItem('inventory_audit_trail');
  } catch (err) {
    console.warn('Failed to clear audit records:', err);
  }
};
