const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

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

async function validateBatchesWithQuantity(items, res) {
  if (!Array.isArray(items) || items.length === 0) {
    throwGraphQLError(res).message("At least one medicine item is required").status(400).throw();
  }

  const batchIds = items.map(i => i.batchId);
  const placeholders = batchIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await db.query(
    `SELECT mb.id, mb."expiryDate", mi.active,
            COUNT(me.id) FILTER (WHERE me."transactionId" IS NULL) AS available
     FROM "MedicineBatch" mb
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     LEFT JOIN "MedicineEntity" me ON me."batchId" = mb.id
     WHERE mb.id IN (${placeholders})
     GROUP BY mb.id, mb."expiryDate", mi.active`,
    batchIds,
  );

  const found = new Map(result.rows.map(r => [r.id, r]));
  for (const { batchId, quantity } of items) {
    const batch = found.get(batchId);
    if (!batch) throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
    if (!batch.active) throwGraphQLError(res).message("Medicine item is inactive").status(400).throw();
    if (new Date(batch.expiryDate) <= new Date()) throwGraphQLError(res).message("Medicine batch has expired").status(400).throw();
    const available = parseInt(batch.available, 10);
    if (available < quantity) {
      throwGraphQLError(res).message(`Only ${available} units available, requested ${quantity}`).status(400).throw();
    }
  }
}

module.exports = { validateBatchAvailable, validateBatchesWithQuantity };