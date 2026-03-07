const db = require("../../../../config/query.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const {
  enqueueEmail,
  medicineRequestApprovedTemplate,
  medicineRequestRejectedTemplate,
} = require("../../../../services/emailservice.js");
const {
  assertRequestStatus,
  validateStock,
  validateStockWithClient,
  getTransactionClient,
} = require("./helper.js");

// ======================== QUERY WRAPPERS ========================

/**
 * Get a patient's email address from UserCredentials.
 */
async function _getPatientEmail(patientId) {
  const result = await db.query(
    `SELECT email FROM "UserCredentials" WHERE id = $1;`,
    [patientId]
  );
  return result.rows[0]?.email || null;
}

/**
 * Fetch medicine requests for a specific patient.
 */
async function _getPatientRequests(patientId, { offset = 0, limit = 20 }) {
  const result = await db.query(
    `SELECT mrl.*
     FROM "MedicineRequestLog" mrl
     WHERE mrl."patientId" = $1
     ORDER BY mrl.created_at DESC
     LIMIT $2 OFFSET $3;`,
    [patientId, limit, offset]
  );
  return result.rows;
}

/**
 * Fetch a single medicine request by ID, with its items and batch details.
 */
async function _getRequestById(requestId) {
  const reqResult = await db.query(
    `SELECT * FROM "MedicineRequestLog" WHERE id = $1;`,
    [requestId]
  );

  if (reqResult.rows.length === 0) return null;

  const request = reqResult.rows[0];

  // Fetch request entities with batch + item detail
  const itemsResult = await db.query(
    `SELECT mre.id, mre."batchId", mre."requestId", mre.quantity,
            mb."batchNumber", mb."dosageUnit", mb."dosageValue",
            mb."currentQuantity", mb."expiryDate", mb."location",
            mb."medicalItemId",
            mi.item_code, mi.item_name, mi.category, mi.subcategory,
            mi.description AS item_description
     FROM "MedicineRequestEntity" mre
     JOIN "MedicineBatch" mb ON mb.id = mre."batchId"
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     WHERE mre."requestId" = $1;`,
    [requestId]
  );

  request.items = itemsResult.rows.map((row) => ({
    id: row.id,
    batchId: row.batchId,
    requestId: row.requestId,
    quantity: row.quantity,
    batch: {
      id: row.batchId,
      medicalItemId: row.medicalItemId,
      batchNumber: row.batchNumber,
      dosageUnit: row.dosageUnit,
      dosageValue: row.dosageValue,
      currentQuantity: row.currentQuantity,
      expiryDate: row.expiryDate,
      location: row.location,
      item: {
        id: row.medicalItemId,
        item_code: row.item_code,
        item_name: row.item_name,
        category: row.category,
        subcategory: row.subcategory,
        description: row.item_description,
      },
    },
  }));

  return request;
}

/**
 * Fetch all medicine requests (for staff), optionally filtering by status.
 */
async function _getAllRequests({ status, offset = 0, limit = 20 }) {
  let queryText;
  let params;

  if (status) {
    queryText = `SELECT mrl.*
                 FROM "MedicineRequestLog" mrl
                 WHERE mrl.status = $1
                 ORDER BY mrl.created_at DESC
                 LIMIT $2 OFFSET $3;`;
    params = [status, limit, offset];
  } else {
    queryText = `SELECT mrl.*
                 FROM "MedicineRequestLog" mrl
                 ORDER BY mrl.created_at DESC
                 LIMIT $1 OFFSET $2;`;
    params = [limit, offset];
  }

  const result = await db.query(queryText, params);
  return result.rows;
}

/**
 * Fetch active medicine items (category = 'medicine').
 */
async function _getMedicineItems({ offset = 0, limit = 50 }) {
  const result = await db.query(
    `SELECT * FROM "MedicalItems"
     WHERE active = true AND category = 'medicine'
     ORDER BY item_name ASC
     LIMIT $1 OFFSET $2;`,
    [limit, offset]
  );
  return result.rows;
}

/**
 * Fetch available batches for a given medicine item (non-expired, in stock).
 */
async function _getAvailableBatches(medicalItemId) {
  const result = await db.query(
    `SELECT mb.*, mi.item_code, mi.item_name, mi.category,
            mi.subcategory, mi.description AS item_description
     FROM "MedicineBatch" mb
     JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
     WHERE mb."medicalItemId" = $1
       AND mb."currentQuantity" > 0
       AND mb."expiryDate" > NOW()
     ORDER BY mb."expiryDate" ASC;`,
    [medicalItemId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    medicalItemId: row.medicalItemId,
    batchNumber: row.batchNumber,
    dosageUnit: row.dosageUnit,
    dosageValue: row.dosageValue,
    initialQuantity: row.initialQuantity,
    currentQuantity: row.currentQuantity,
    expiryDate: row.expiryDate,
    location: row.location,
    item: {
      id: row.medicalItemId,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      subcategory: row.subcategory,
      description: row.item_description,
    },
  }));
}

// ======================== MUTATION WRAPPERS ========================

/**
 * Create a new medicine request for a patient.
 * Inserts MedicineRequestLog + MedicineRequestEntity rows atomically.
 */
async function _createMedicineRequest(patientId, { purpose, items }, res) {
  // Pre-validate stock (courtesy check — real deduction happens at approval)
  await validateStock(items, res);

  const client = await getTransactionClient();
  try {
    await client.query("BEGIN");

    // Insert the request log
    const reqResult = await client.query(
      `INSERT INTO "MedicineRequestLog" ("patientId", "status", "purpose", "created_at")
       VALUES ($1, 'Pending', $2, $3)
       RETURNING *;`,
      [patientId, purpose, Math.floor(Date.now() / 1000)]
    );
    const request = reqResult.rows[0];

    // Insert request entities (batch items)
    const insertedItems = [];
    for (const item of items) {
      const entityResult = await client.query(
        `INSERT INTO "MedicineRequestEntity" ("batchId", "requestId", "quantity")
         VALUES ($1, $2, $3)
         RETURNING *;`,
        [item.batchId, request.id, item.quantity]
      );
      insertedItems.push(entityResult.rows[0]);
    }

    await client.query("COMMIT");

    request.items = insertedItems;
    logger.info(`Medicine request ${request.id} created by patient ${patientId}`);
    return request;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`Failed to create medicine request for patient ${patientId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel a pending medicine request.
 */
async function _cancelMedicineRequest(requestId, res) {
  const request = await assertRequestStatus(requestId, ["Pending"], res);

  await db.query(
    `UPDATE "MedicineRequestLog" SET status = 'Cancelled' WHERE id = $1;`,
    [requestId]
  );

  request.status = "Cancelled";
  logger.info(`Medicine request ${requestId} cancelled.`);
  return request;
}

/**
 * Staff: Update request data (reassign batches/quantities before approval).
 * Deletes old entities and re-inserts new ones atomically.
 */
async function _updateMedicineRequestData(requestId, items, res) {
  // Validate request is still pending
  await assertRequestStatus(requestId, ["Pending"], res);

  // Pre-validate stock
  await validateStock(items, res);

  const client = await getTransactionClient();
  try {
    await client.query("BEGIN");

    // Delete existing entities
    await client.query(
      `DELETE FROM "MedicineRequestEntity" WHERE "requestId" = $1;`,
      [requestId]
    );

    // Insert updated entities
    for (const item of items) {
      await client.query(
        `INSERT INTO "MedicineRequestEntity" ("batchId", "requestId", "quantity")
         VALUES ($1, $2, $3);`,
        [item.batchId, requestId, item.quantity]
      );
    }

    await client.query("COMMIT");
    logger.info(`Medicine request ${requestId} data updated.`);
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`Failed to update medicine request ${requestId}:`, err);
    throw err;
  } finally {
    client.release();
  }

  // Return full request with updated items
  return await _getRequestById(requestId);
}

/**
 * Staff: Approve a medicine request.
 * Uses a deferred-constraint transaction for the FK on MedicineTransactionLog.
 * Creates MedicineTransactionLog, MedicineEntity entries, deducts stock,
 * and updates the request status — all atomically.
 */
async function _approveMedicineRequest(requestId, staffId, notes, res) {
  const client = await getTransactionClient();

  try {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");

    // 1. Lock and validate the request row
    const reqResult = await client.query(
      `SELECT * FROM "MedicineRequestLog" WHERE id = $1 FOR UPDATE;`,
      [requestId]
    );
    if (reqResult.rows.length === 0) {
      throwGraphQLError(res)
        .status(404)
        .message("Medicine request not found.")
        .throw();
    }
    const request = reqResult.rows[0];
    if (request.status !== "Pending") {
      throwGraphQLError(res)
        .status(400)
        .message(`Request is in '${request.status}' status. Expected: Pending.`)
        .throw();
    }

    // 2. Fetch request items
    const itemsResult = await client.query(
      `SELECT * FROM "MedicineRequestEntity" WHERE "requestId" = $1;`,
      [requestId]
    );
    if (itemsResult.rows.length === 0) {
      throwGraphQLError(res)
        .status(400)
        .message("Cannot approve a request with no items.")
        .throw();
    }
    const items = itemsResult.rows;

    // 3. Lock batches (FOR UPDATE) and validate stock
    const batchItems = items.map((i) => ({
      batchId: i.batchId,
      quantity: i.quantity,
    }));
    const { errors } = await validateStockWithClient(client, batchItems);
    if (errors.length > 0) {
      throwGraphQLError(res)
        .status(400)
        .message(`Stock validation failed: ${errors.join(" ")}`)
        .throw();
    }

    // 4. Calculate total quantity
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    // 5. Insert transaction log (FK is deferred — MedicineRequestLog.transactionId checked at COMMIT)
    const txResult = await client.query(
      `INSERT INTO "MedicineTransactionLog"
        ("patientId", "action", "quantity", "issuedBy", "notes")
       VALUES ($1, 'issue', $2, $3, $4)
       RETURNING *;`,
      [request.patientId, totalQuantity, staffId, notes || null]
    );
    const transaction = txResult.rows[0];

    // 6. Update request — sets transactionId to satisfy the deferred FK
    await client.query(
      `UPDATE "MedicineRequestLog"
       SET status = 'Approved', "transactionId" = $1, "approved_by" = $2
       WHERE id = $3;`,
      [transaction.id, staffId, requestId]
    );

    // 7. Create MedicineEntity entries (linking each batch to the transaction)
    for (const item of items) {
      await client.query(
        `INSERT INTO "MedicineEntity" ("batchId", "transactionId")
         VALUES ($1, $2);`,
        [item.batchId, transaction.id]
      );
    }

    // 8. Deduct stock from batches (verified with RETURNING to catch race conditions)
    for (const item of items) {
      const deductResult = await client.query(
        `UPDATE "MedicineBatch"
         SET "currentQuantity" = "currentQuantity" - $1
         WHERE id = $2 AND "currentQuantity" >= $1
         RETURNING id;`,
        [item.quantity, item.batchId]
      );
      if (deductResult.rows.length === 0) {
        throwGraphQLError(res)
          .status(400)
          .message(`Failed to deduct stock for batch ID ${item.batchId}. Concurrent modification detected.`)
          .throw();
      }
    }

    // 9. Commit — all deferred constraints are checked here
    await client.query("COMMIT");
    logger.info(
      `Medicine request ${requestId} approved by staff ${staffId}. Transaction: ${transaction.id}`
    );

    // 10. Notify patient (non-blocking)
    try {
      const patientEmail = await _getPatientEmail(request.patientId);
      if (patientEmail) {
        await enqueueEmail(
          patientEmail,
          `Medicine Request #${requestId} Approved`,
          medicineRequestApprovedTemplate(requestId, notes)
        );
      }
    } catch (notifyErr) {
      logger.warn(`Failed to enqueue approval notification for request ${requestId}: ${notifyErr.message}`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    // Re-throw after rollback (GraphQLError or unexpected error)
    throw err;
  } finally {
    client.release();
  }

  // Return the fully populated request (after transaction committed)
  return await _getRequestById(requestId);
}

/**
 * Staff: Reject a medicine request.
 */
async function _rejectMedicineRequest(requestId, staffId, reason, res) {
  const request = await assertRequestStatus(requestId, ["Pending"], res);

  await db.query(
    `UPDATE "MedicineRequestLog"
     SET status = 'Rejected', "approved_by" = $1, "rejection_reason" = $2
     WHERE id = $3;`,
    [staffId, reason || null, requestId]
  );

  request.status = "Rejected";
  request.approved_by = staffId;
  request.rejection_reason = reason || null;
  logger.info(
    `Medicine request ${requestId} rejected by staff ${staffId}. Reason: ${reason || "N/A"}`
  );

  // Notify patient (non-blocking)
  try {
    const patientEmail = await _getPatientEmail(request.patientId);
    if (patientEmail) {
      await enqueueEmail(
        patientEmail,
        `Medicine Request #${requestId} Rejected`,
        medicineRequestRejectedTemplate(requestId, reason)
      );
    }
  } catch (notifyErr) {
    logger.warn(`Failed to enqueue rejection notification for request ${requestId}: ${notifyErr.message}`);
  }

  return request;
}

module.exports = {
  // Queries
  _getPatientRequests,
  _getRequestById,
  _getAllRequests,
  _getMedicineItems,
  _getAvailableBatches,
  // Mutations
  _createMedicineRequest,
  _cancelMedicineRequest,
  _updateMedicineRequestData,
  _approveMedicineRequest,
  _rejectMedicineRequest,
};
