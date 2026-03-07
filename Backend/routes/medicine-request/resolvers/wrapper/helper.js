const db = require("../../../../config/query.js");
const pool = require("../../../../config/db.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");

/**
 * Validates that a medicine request belongs to the given patient.
 */
async function assertRequestOwnership(requestId, patientId, res) {
  const result = await db.query(
    `SELECT id, "patientId" FROM "MedicineRequestLog" WHERE id = $1;`,
    [requestId]
  );

  if (result.rows.length === 0) {
    throwGraphQLError(res)
      .status(404)
      .message("Medicine request not found.")
      .throw();
  }

  if (result.rows[0].patientId !== patientId) {
    throwGraphQLError(res)
      .status(403)
      .message("You do not have permission to access this request.")
      .throw();
  }

  return result.rows[0];
}

/**
 * Validates that a medicine request exists and is in the expected status.
 */
async function assertRequestStatus(requestId, expectedStatuses, res) {
  const result = await db.query(
    `SELECT * FROM "MedicineRequestLog" WHERE id = $1;`,
    [requestId]
  );

  if (result.rows.length === 0) {
    throwGraphQLError(res)
      .status(404)
      .message("Medicine request not found.")
      .throw();
  }

  const request = result.rows[0];
  if (!expectedStatuses.includes(request.status)) {
    throwGraphQLError(res)
      .status(400)
      .message(
        `Request is in '${request.status}' status. Expected: ${expectedStatuses.join(", ")}.`
      )
      .throw();
  }

  return request;
}

/**
 * Stock validation core — accepts either db module or a pg Client.
 * When lockRows=true, acquires FOR UPDATE locks (must be inside a transaction).
 * Returns { errors: string[], validated: object[] }.
 */
async function _validateStockInternal(queryRunner, items, lockRows = false) {
  const batchIds = items.map((i) => i.batchId);
  const lockClause = lockRows ? "FOR UPDATE OF mb" : "";

  const result = await queryRunner.query(
    `SELECT mb.id, mb."currentQuantity", mb."batchNumber", mb."expiryDate",
            mi.item_name
     FROM "MedicineBatch" mb
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     WHERE mb.id = ANY($1)
     ${lockClause};`,
    [batchIds]
  );

  const batchMap = new Map(result.rows.map((r) => [r.id, r]));
  const errors = [];
  const validated = [];

  for (const item of items) {
    const batch = batchMap.get(item.batchId);

    if (!batch) {
      errors.push(`Batch ID ${item.batchId} does not exist.`);
      continue;
    }

    if (new Date(batch.expiryDate) < new Date()) {
      errors.push(
        `Batch '${batch.batchNumber}' (${batch.item_name}) has expired.`
      );
      continue;
    }

    if (batch.currentQuantity < item.quantity) {
      errors.push(
        `Insufficient stock for batch '${batch.batchNumber}' (${batch.item_name}). ` +
          `Requested: ${item.quantity}, Available: ${batch.currentQuantity}.`
      );
      continue;
    }

    validated.push({
      batchId: item.batchId,
      requestedQty: item.quantity,
      availableQty: batch.currentQuantity,
      batchNumber: batch.batchNumber,
      itemName: batch.item_name,
    });
  }

  return { errors, validated };
}

/**
 * Pre-validate stock using pool (no row locking).
 * Throws GraphQLError on failure.
 */
async function validateStock(items, res) {
  const { errors, validated } = await _validateStockInternal(db, items, false);
  if (errors.length > 0) {
    throwGraphQLError(res)
      .status(400)
      .message(`Stock validation failed: ${errors.join(" ")}`)
      .throw();
  }
  return validated;
}

/**
 * Validate stock within a transaction client (with FOR UPDATE row locks).
 * Returns raw { errors, validated } — caller handles errors.
 */
async function validateStockWithClient(client, items) {
  return await _validateStockInternal(client, items, true);
}

/**
 * Acquires a pg Client from the pool for transaction use.
 */
async function getTransactionClient() {
  return await pool.connect();
}

module.exports = {
  assertRequestOwnership,
  assertRequestStatus,
  validateStock,
  validateStockWithClient,
  getTransactionClient,
};
