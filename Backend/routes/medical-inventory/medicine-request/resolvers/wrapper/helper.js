const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

async function hasActiveRequest(patientId, res) {
  const result = await db.query(
    'SELECT id FROM "MedicineRequestLog" WHERE "patientId" = $1 AND status = ' + "'Pending'" + ' LIMIT 1',
    [patientId]
  );
  return result.rows.length > 0;
}

async function validateBatchAvailable(batchId, quantity, res) {
  const result = await db.query(
    'SELECT mb.id, mb."expiryDate", mi.active FROM "MedicineBatch" mb ' +
    'JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId" WHERE mb.id = $1 LIMIT 1',
    [batchId]
  );
  if (result.rows.length === 0) {
    throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
  }
  const batch = result.rows[0];
  if (!batch.active) {
    throwGraphQLError(res).message("Medicine item is inactive").status(400).throw();
  }
  if (new Date(batch.expiryDate) <= new Date()) {
    throwGraphQLError(res).message("Medicine batch has expired").status(400).throw();
  }
  
  // Check available unassigned units
  const availResult = await db.query(
    'SELECT COUNT(*) as count FROM "MedicineEntity" WHERE "batchId" = $1 AND "transactionId" IS NULL',
    [batchId]
  );
  const availableCount = parseInt(availResult.rows[0].count);
  if (availableCount < quantity) {
    throwGraphQLError(res).message(`Only ${availableCount} units available, requested ${quantity}`).status(400).throw();
  }
  
  return batch;
}

async function validateBatchesAvailable(batchIds, res) {
  const placeholders = batchIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await db.query(
    `SELECT mb.id, mb."expiryDate", mi.active FROM "MedicineBatch" mb
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     WHERE mb.id IN (${placeholders})`,
    batchIds,
  );

  const found = new Map(result.rows.map(r => [r.id, r]));
  for (const batchId of batchIds) {
    const batch = found.get(batchId);
    if (!batch) throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
    if (!batch.active) throwGraphQLError(res).message("Medicine item is inactive").status(400).throw();
    if (new Date(batch.expiryDate) <= new Date()) throwGraphQLError(res).message("Medicine batch has expired").status(400).throw();
  }
}

async function validateBatchesWithQuantity(items, location, res) {
  const medicineIds = items.map(i => i.batchId);
  const placeholders = medicineIds.map((_, i) => `$${i + 1}`).join(', ');
  
  // Check if medicine items are valid and active
  const medicineResult = await db.query(
    `SELECT mi.id, mi.active
     FROM "MedicalItems" mi
     WHERE mi.id IN (${placeholders})`,
    medicineIds,
  );

  const medicineMap = new Map(medicineResult.rows.map(r => [r.id, r]));
  
  // Verify each medicine exists and is active
  for (const id of medicineIds) {
    const medicine = medicineMap.get(id);
    if (!medicine) throwGraphQLError(res).message("Medicine item not found").status(404).throw();
    if (!medicine.active) throwGraphQLError(res).message("Medicine item is inactive").status(400).throw();
  }

  // Check available stock for each medicine at the requested location (sum across all valid batches)
  const availabilityResult = await db.query(
    `SELECT mb."medicalItemId", COUNT(me.id) as available
     FROM "MedicineBatch" mb
     LEFT JOIN "MedicineEntity" me ON me."batchId" = mb.id AND me."transactionId" IS NULL
     WHERE mb."medicalItemId" IN (${placeholders}) AND mb."expiryDate" > CURRENT_DATE AND mb.location = $${placeholders.split(',').length + 1}
     GROUP BY mb."medicalItemId"`,
    [...medicineIds, location],
  );

  const availabilityMap = new Map(availabilityResult.rows.map(r => [r.medicalItemId, r]));
  
  for (const { batchId, quantity } of items) {
    const availability = availabilityMap.get(batchId);
    const available = availability ? parseInt(availability.available) : 0;
    if (available < quantity) throwGraphQLError(res).message(`Only ${available} units available, requested ${quantity}`).status(400).throw();
  }
}

async function getPatientIdByRequestId(requestId) {
  const result = await db.query(
    'SELECT "patientId" FROM "MedicineRequestLog" WHERE id = $1',
    [requestId]
  );
  return result.rows[0]?.patientId ?? null;
}

module.exports = { hasActiveRequest, validateBatchAvailable,
   validateBatchesAvailable, validateBatchesWithQuantity, getPatientIdByRequestId };

