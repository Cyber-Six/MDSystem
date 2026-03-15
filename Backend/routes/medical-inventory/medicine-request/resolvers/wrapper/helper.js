const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

async function hasActiveRequest(patientId, res) {
  const result = await db.query(
    'SELECT id FROM "MedicineRequestLog" WHERE "patientId" = $1 AND status = ' + "'Pending'" + ' LIMIT 1',
    [patientId]
  );
  return result.rows.length > 0;
}

async function validateBatchAvailable(batchId, res) {
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

module.exports = { hasActiveRequest, validateBatchAvailable, validateBatchesAvailable };