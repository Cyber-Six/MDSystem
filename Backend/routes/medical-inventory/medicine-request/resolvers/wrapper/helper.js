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

async function validateBatchesWithQuantity(items, res) {
  const medicineIds = items.map(i => i.batchId);
  const placeholders = medicineIds.map((_, i) => `$${i + 1}`).join(', ');
  
  // First, get the latest batch for each medicine (treating batchId as medicineId)
  const batchResult = await db.query(
    `SELECT DISTINCT ON (mb."medicalItemId") mb.id, mb."medicalItemId", mb."expiryDate", mi.active
     FROM "MedicineBatch" mb
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     WHERE mb."medicalItemId" IN (${placeholders}) AND mb."expiryDate" > CURRENT_DATE
     ORDER BY mb."medicalItemId", mb.created_at DESC`,
    medicineIds,
  );

  // Now check available stock for each batch
  const validBatches = batchResult.rows;
  const batchIds = validBatches.map(b => b.id);
  const batchPlaceholders = batchIds.map((_, i) => `$${i + 1}`).join(', ');
  
  let availabilityResult = { rows: [] };
  if (batchIds.length > 0) {
    availabilityResult = await db.query(
      `SELECT mb.id, mb."expiryDate", mi.active, mb."medicalItemId",
              COUNT(me.id) FILTER (WHERE me."transactionId" IS NULL) AS available
       FROM "MedicineBatch" mb
       JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
       LEFT JOIN "MedicineEntity" me ON me."batchId" = mb.id
       WHERE mb.id IN (${batchPlaceholders})
       GROUP BY mb.id, mb."expiryDate", mi.active, mb."medicalItemId"`,
      batchIds,
    );
  }

  const found = new Map(availabilityResult.rows.map(r => [r.medicalItemId, r]));
  for (const { batchId, quantity } of items) {
    const batch = found.get(batchId);
    if (!batch) throwGraphQLError(res).message("No available batches for this medicine").status(404).throw();
    if (!batch.active) throwGraphQLError(res).message("Medicine item is inactive").status(400).throw();
    if (new Date(batch.expiryDate) <= new Date()) throwGraphQLError(res).message("Medicine batch has expired").status(400).throw();
    const available = parseInt(batch.available);
    if (available < quantity) throwGraphQLError(res).message(`Only ${available} units available, requested ${quantity}`).status(400).throw();
  }
}

module.exports = { hasActiveRequest, validateBatchAvailable, validateBatchesAvailable, validateBatchesWithQuantity };