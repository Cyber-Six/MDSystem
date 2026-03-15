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

module.exports = { hasActiveRequest, validateBatchAvailable };