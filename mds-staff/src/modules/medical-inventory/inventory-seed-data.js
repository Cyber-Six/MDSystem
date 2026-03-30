/**
 * Temporary seed data for inventory UI visualization.
 * DELETE THIS FILE when real backend integration is done.
 */

export const LOCATIONS = ['Casal', 'Arlegui', 'QuezonCity'];

export const CATEGORIES = [
  { value: 'medicine', label: 'Medicine' },
  { value: 'supply', label: 'Supply' },
];

// Note: Equipment and Vaccine categories kept internally but hidden from UI
const ALL_CATEGORIES = [
  { value: 'medicine', label: 'Medicine' },
  { value: 'supply', label: 'Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'vaccine', label: 'Vaccine' },
];

export const CATEGORY_COLORS = {
  medicine: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
  supply: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  equipment: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400',
  vaccine: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
};

export const STATUS_BADGES = {
  InProgress: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Pending: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Approved: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Rejected: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  Completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Expired: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
};

// Helper: days until expiry
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
};

export const getExpiryStatus = (expiryDate) => {
  const days = daysUntil(expiryDate);
  if (days === null) return { label: 'No Expiry', color: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400' };
  if (days < 0) return { label: 'Expired', color: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400' };
  if (days <= 30) return { label: `${days}d left`, color: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' };
  if (days <= 90) return { label: `${days}d left`, color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' };
  return { label: 'Good', color: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400' };
};

/* ── Seed: Medical Items ─────────────────────────────────────────────── */

export const SEED_ITEMS = [
  { id: 1001, item_code: 'MED-001', item_name: 'Paracetamol 500mg', category: 'medicine', subcategory: 'Analgesic', description: 'For pain relief and fever', reorder_level: 50, active: true },
  { id: 1002, item_code: 'MED-002', item_name: 'Amoxicillin 250mg', category: 'medicine', subcategory: 'Antibiotic', description: 'Broad-spectrum antibiotic', reorder_level: 30, active: true },
  { id: 1003, item_code: 'MED-003', item_name: 'Ibuprofen 200mg', category: 'medicine', subcategory: 'NSAID', description: 'Anti-inflammatory pain reliever', reorder_level: 40, active: true },
  { id: 1004, item_code: 'MED-004', item_name: 'Cetirizine 10mg', category: 'medicine', subcategory: 'Antihistamine', description: 'For allergy symptoms', reorder_level: 20, active: true },
  { id: 1005, item_code: 'MED-005', item_name: 'Mefenamic Acid 500mg', category: 'medicine', subcategory: 'Analgesic', description: 'Pain relief for dysmenorrhea', reorder_level: 25, active: true },
  { id: 1006, item_code: 'SUP-001', item_name: 'Sterile Gauze Pad 4x4', category: 'supply', subcategory: 'Wound Care', description: 'Sterile gauze for wound dressing', reorder_level: 100, active: true },
  { id: 1007, item_code: 'SUP-002', item_name: 'Adhesive Bandage (Box)', category: 'supply', subcategory: 'Wound Care', description: 'Assorted adhesive bandages', reorder_level: 20, active: true },
  { id: 1008, item_code: 'SUP-003', item_name: 'Disposable Gloves (Box)', category: 'supply', subcategory: 'PPE', description: 'Latex-free examination gloves', reorder_level: 10, active: true },
  { id: 1009, item_code: 'VAC-001', item_name: 'Flu Vaccine 2026', category: 'vaccine', subcategory: 'Immunization', description: 'Seasonal influenza vaccine', reorder_level: 15, active: true },
  { id: 1010, item_code: 'EQP-001', item_name: 'Digital Thermometer', category: 'equipment', subcategory: 'Diagnostic', description: 'Non-contact infrared thermometer', reorder_level: 3, active: true },
];

/* ── Seed: Batches (Medicine + Supply) ───────────────────────────────── */

export const SEED_BATCHES = [
  // Paracetamol — Casal batches
  { id: 5001, medicalItemId: 1001, batchNumber: 'CAS-PAR-001', initialQuantity: 200, currentQuantity: 145, expiryDate: '2026-04-15', location: 'Casal', receivedAt: '2025-12-10', supplierName: 'PharmaCo Manila', notes: '' },
  { id: 5002, medicalItemId: 1001, batchNumber: 'CAS-PAR-002', initialQuantity: 100, currentQuantity: 100, expiryDate: '2026-12-31', location: 'Casal', receivedAt: '2026-02-20', supplierName: 'PharmaCo Manila', notes: '' },
  // Paracetamol — Arlegui batch
  { id: 5003, medicalItemId: 1001, batchNumber: 'ARL-PAR-001', initialQuantity: 150, currentQuantity: 80, expiryDate: '2026-08-20', location: 'Arlegui', receivedAt: '2026-01-05', supplierName: 'MedSupply Inc', notes: '' },

  // Amoxicillin — Casal (one expired)
  { id: 5004, medicalItemId: 1002, batchNumber: 'CAS-AMX-001', initialQuantity: 120, currentQuantity: 5, expiryDate: '2026-02-28', location: 'Casal', receivedAt: '2025-08-15', supplierName: 'GenericPharma', notes: 'Near depletion' },
  { id: 5005, medicalItemId: 1002, batchNumber: 'CAS-AMX-002', initialQuantity: 80, currentQuantity: 80, expiryDate: '2027-01-15', location: 'Casal', receivedAt: '2026-03-01', supplierName: 'PharmaCo Manila', notes: '' },
  // Amoxicillin — Arlegui
  { id: 5006, medicalItemId: 1002, batchNumber: 'ARL-AMX-001', initialQuantity: 60, currentQuantity: 32, expiryDate: '2026-09-30', location: 'Arlegui', receivedAt: '2026-01-20', supplierName: 'MedSupply Inc', notes: '' },

  // Ibuprofen
  { id: 5007, medicalItemId: 1003, batchNumber: 'CAS-IBU-001', initialQuantity: 100, currentQuantity: 67, expiryDate: '2026-07-10', location: 'Casal', receivedAt: '2025-11-01', supplierName: 'PharmaCo Manila', notes: '' },
  { id: 5008, medicalItemId: 1003, batchNumber: 'ARL-IBU-001', initialQuantity: 50, currentQuantity: 12, expiryDate: '2026-05-01', location: 'Arlegui', receivedAt: '2025-10-15', supplierName: 'GenericPharma', notes: '' },

  // Cetirizine
  { id: 5009, medicalItemId: 1004, batchNumber: 'CAS-CET-001', initialQuantity: 80, currentQuantity: 55, expiryDate: '2027-03-20', location: 'Casal', receivedAt: '2026-02-01', supplierName: 'AllergyMed Co', notes: '' },

  // Mefenamic Acid
  { id: 5010, medicalItemId: 1005, batchNumber: 'CAS-MEF-001', initialQuantity: 60, currentQuantity: 18, expiryDate: '2026-06-15', location: 'Casal', receivedAt: '2025-12-20', supplierName: 'PharmaCo Manila', notes: '' },
  { id: 5011, medicalItemId: 1005, batchNumber: 'ARL-MEF-001', initialQuantity: 40, currentQuantity: 40, expiryDate: '2027-02-28', location: 'Arlegui', receivedAt: '2026-03-05', supplierName: 'GenericPharma', notes: '' },

  // Gauze
  { id: 5012, medicalItemId: 1006, batchNumber: 'CAS-GAU-001', initialQuantity: 500, currentQuantity: 310, expiryDate: '2028-01-01', location: 'Casal', receivedAt: '2026-01-10', supplierName: 'MedSupply Inc', notes: '' },
  { id: 5013, medicalItemId: 1006, batchNumber: 'ARL-GAU-001', initialQuantity: 200, currentQuantity: 88, expiryDate: '2027-06-30', location: 'Arlegui', receivedAt: '2025-12-01', supplierName: 'MedSupply Inc', notes: '' },

  // Adhesive Bandage
  { id: 5014, medicalItemId: 1007, batchNumber: 'CAS-BND-001', initialQuantity: 50, currentQuantity: 35, expiryDate: null, location: 'Casal', receivedAt: '2026-02-15', supplierName: 'MedSupply Inc', notes: '' },

  // Disposable Gloves
  { id: 5015, medicalItemId: 1008, batchNumber: 'CAS-GLV-001', initialQuantity: 30, currentQuantity: 8, expiryDate: '2027-12-31', location: 'Casal', receivedAt: '2026-01-20', supplierName: 'SafeHand Corp', notes: '' },
  { id: 5016, medicalItemId: 1008, batchNumber: 'ARL-GLV-001', initialQuantity: 20, currentQuantity: 14, expiryDate: '2027-11-15', location: 'Arlegui', receivedAt: '2026-02-05', supplierName: 'SafeHand Corp', notes: '' },

  // Flu Vaccine
  { id: 5017, medicalItemId: 1009, batchNumber: 'CAS-FLU-001', initialQuantity: 25, currentQuantity: 10, expiryDate: '2026-06-30', location: 'Casal', receivedAt: '2026-02-01', supplierName: 'VaccinePhil', notes: 'Store at 2-8°C' },

  // Digital Thermometer (no expiry, equipment)
  { id: 5018, medicalItemId: 1010, batchNumber: 'CAS-THR-001', initialQuantity: 5, currentQuantity: 5, expiryDate: null, location: 'Casal', receivedAt: '2025-06-01', supplierName: 'MedEquip PH', notes: '' },
  { id: 5019, medicalItemId: 1010, batchNumber: 'ARL-THR-001', initialQuantity: 3, currentQuantity: 2, expiryDate: null, location: 'Arlegui', receivedAt: '2025-07-15', supplierName: 'MedEquip PH', notes: '' },
];

/* ── Seed: Dispense Requests ─────────────────────────────────────────── */

export const SEED_REQUESTS = [
  { id: 7001, patientId: 9001, patientName: 'Juan Dela Cruz', patientType: 'Student', status: 'InProgress', transactionId: null, purpose: 'Headache and fever', approved_by: null, created_at: '2026-03-08T08:30:00Z',
    items: [
      { id: 70011, batchId: null, requestId: 7001, itemId: 1001, itemName: 'Paracetamol 500mg', quantity: null },
    ],
  },
  { id: 7002, patientId: 9002, patientName: 'Maria Santos', patientType: 'Employee', status: 'InProgress', transactionId: null, purpose: 'Sore throat', approved_by: null, created_at: '2026-03-08T09:15:00Z',
    items: [
      { id: 70021, batchId: null, requestId: 7002, itemId: 1002, itemName: 'Amoxicillin 250mg', quantity: 14 },
    ],
  },
  { id: 7003, patientId: 9003, patientName: 'Carlos Reyes', patientType: 'Student', status: 'InProgress', transactionId: null, purpose: 'Muscle pain from PE class', approved_by: null, created_at: '2026-03-08T09:45:00Z',
    items: [
      { id: 70031, batchId: null, requestId: 7003, itemId: 1003, itemName: 'Ibuprofen 200mg', quantity: null },
    ],
  },
  { id: 7004, patientId: 9004, patientName: 'Ana Lim', patientType: 'Student', status: 'InProgress', transactionId: null, purpose: 'Allergic rhinitis', approved_by: null, created_at: '2026-03-08T10:00:00Z',
    items: [
      { id: 70041, batchId: null, requestId: 7004, itemId: 1004, itemName: 'Cetirizine 10mg', quantity: null },
    ],
  },
  { id: 7005, patientId: 9005, patientName: 'Patricia Garcia', patientType: 'Employee', status: 'Approved', transactionId: 6301, purpose: 'Dysmenorrhea', approved_by: 101, created_at: '2026-03-07T14:20:00Z',
    items: [
      { id: 70051, batchId: 5010, requestId: 7005, itemId: 1005, itemName: 'Mefenamic Acid 500mg', quantity: 6 },
    ],
  },
  { id: 7006, patientId: 9006, patientName: 'Rico Mendoza', patientType: 'Student', status: 'Approved', transactionId: 6302, purpose: 'Wound on left knee', approved_by: 101, created_at: '2026-03-07T15:10:00Z',
    items: [
      { id: 70061, batchId: 5012, requestId: 7006, itemId: 1006, itemName: 'Sterile Gauze Pad 4x4', quantity: 5 },
      { id: 70062, batchId: 5014, requestId: 7006, itemId: 1007, itemName: 'Adhesive Bandage (Box)', quantity: 1 },
    ],
  },
];

/* ── Seed: Recent Transactions ───────────────────────────────────────── */

export const SEED_TRANSACTIONS = [
  { id: 6301, patientId: 9005, patientName: 'Patricia Garcia', action: 'issue', quantity: 6, issuedBy: 101, issuedByName: 'Dr. Rivera', issuedAt: '2026-03-07T14:25:00Z', notes: 'Dispensed Mefenamic Acid 500mg', itemName: 'Mefenamic Acid 500mg', batchNumber: 'CAS-MEF-001' },
  { id: 6302, patientId: 9006, patientName: 'Rico Mendoza', action: 'issue', quantity: 5, issuedBy: 101, issuedByName: 'Dr. Rivera', issuedAt: '2026-03-07T15:15:00Z', notes: 'Dispensed Sterile Gauze Pad 4x4', itemName: 'Sterile Gauze Pad 4x4', batchNumber: 'CAS-GAU-001' },
  { id: 6303, patientId: null, patientName: null, action: 'receive', quantity: 80, issuedBy: 102, issuedByName: 'Nurse Santos', issuedAt: '2026-03-01T10:00:00Z', notes: 'Received new Amoxicillin batch', itemName: 'Amoxicillin 250mg', batchNumber: 'CAS-AMX-002' },
  { id: 6304, patientId: null, patientName: null, action: 'adjust', quantity: -3, issuedBy: 102, issuedByName: 'Nurse Santos', issuedAt: '2026-02-28T16:00:00Z', notes: 'Discarded 3 expired units', itemName: 'Amoxicillin 250mg', batchNumber: 'CAS-AMX-001' },
  { id: 6305, patientId: null, patientName: null, action: 'transfer', quantity: 40, issuedBy: 102, issuedByName: 'Nurse Santos', issuedAt: '2026-03-05T09:00:00Z', notes: 'Split from CAS-MEF-001 → Arlegui', itemName: 'Mefenamic Acid 500mg', batchNumber: 'ARL-MEF-001' },
];

/* ── Computed helpers for dashboard stats ─────────────────────────────── */

export const computeItemStats = (items, batches) => {
  const REORDER_THRESHOLD = 10;

  return items.map((item) => {
    const rawItemBatches = batches.filter((b) => String(b.medicalItemId) === String(item.id));

    // Deduplicate: merge entries sharing the same batchNumber + location (safety guard)
    const batchMap = new Map();
    for (const batch of rawItemBatches) {
      const key = `${batch.batchNumber}__${batch.location}`;
      if (batchMap.has(key)) {
        const existing = batchMap.get(key);
        const mergedQty = (existing.availableQuantity ?? existing.currentQuantity ?? 0) +
                          (batch.availableQuantity ?? batch.currentQuantity ?? 0);
        batchMap.set(key, { ...existing, currentQuantity: mergedQty, availableQuantity: mergedQty });
      } else {
        batchMap.set(key, { ...batch });
      }
    }
    const itemBatches = Array.from(batchMap.values());

    const casalBatches = itemBatches.filter((b) => b.location === 'Casal');
    const arleguiBatches = itemBatches.filter((b) => b.location === 'Arlegui');
    const quezonCityBatches = itemBatches.filter((b) => b.location === 'QuezonCity');
    const getStock = (b) => b.availableQuantity ?? b.currentQuantity ?? 0;
    const totalStock = itemBatches.reduce((sum, b) => sum + getStock(b), 0);
    const casalStock = casalBatches.reduce((sum, b) => sum + getStock(b), 0);
    const arlegui = arleguiBatches.reduce((sum, b) => sum + getStock(b), 0);
    const quezonCity = quezonCityBatches.reduce((sum, b) => sum + getStock(b), 0);
    // Low stock is per-branch: triggered if any branch that carries this item has stock ≤ threshold
    const branchStockMap = { Casal: casalStock, Arlegui: arlegui, QuezonCity: quezonCity };
    const lowStockBranches = Object.entries(branchStockMap)
      .filter(([loc, qty]) => itemBatches.some((b) => b.location === loc) && qty <= REORDER_THRESHOLD)
      .map(([location, stock]) => ({ location, stock }));
    const isLowStock = lowStockBranches.length > 0;
    const hasExpired = itemBatches.some((b) => b.expiryDate && new Date(b.expiryDate) < new Date());
    const hasExpiringSoon = itemBatches.some((b) => {
      if (!b.expiryDate) return false;
      const days = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    });
    
    // Ensure category is normalized to lowercase
    const category = item.category ? item.category.toLowerCase() : 'supply';
    
    return {
      ...item,
      category, // Override with normalized lowercase version
      reorder_level: REORDER_THRESHOLD,
      batches: itemBatches,
      totalStock,
      casalStock,
      arlegui,
      quezonCity,
      isLowStock,
      lowStockBranches,
      hasExpired,
      hasExpiringSoon,
      batchCount: itemBatches.length
    };
  });
};
