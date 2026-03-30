const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");

// Enhanced aggregation: includes medicine name by joining with MedicalItems
// Note: mre."medicineId" stores the MedicalItems.id (the medicine item, not the batch)
const getItemsWithNames = async (requestId) => {
  const result = await db.query(`
    SELECT
      mre.id,
      mre."medicineId",
      mre."requestId",
      mre.quantity,
      COALESCE(mi.item_name, 'Unknown Medicine') AS "itemName"
    FROM "MedicineRequestEntity" mre
    LEFT JOIN "MedicalItems" mi ON mi.id = mre."medicineId"
    WHERE mre."requestId" = $1
  `, [requestId]);
  return result.rows;
};

// Reused in all request list queries: aggregates request line items as a JSON array
const ITEMS_AGG = `
  COALESCE(
    json_agg(
      json_build_object('id', mre.id, 'batchId', mre."medicineId", 'medicineId', mre."medicineId", 'requestId', mre."requestId", 'quantity', mre.quantity)
    ) FILTER (WHERE mre.id IS NOT NULL),
    '[]'
  ) AS items`.trim();

const Query = {
  _getAvailableMedicine: async (_, { location, offset = 0, limit = 20 }, { res }) => {
    const sql = `
      SELECT
        mi.id, mi.item_code, mi.item_name, mi.category, mi.description,
        mb.id AS "batchId", mb."batchNumber", mb."dosageUnit", mb."dosageValue", mb."expiryDate", mb.location
      FROM "MedicalItems" mi
      JOIN "MedicineBatch" mb ON mb."medicalItemId" = mi.id
      WHERE 
        mi.active = true AND
        mi.category = 'Medicine' AND
        mb."expiryDate" > CURRENT_DATE AND
        mb.location = COALESCE($1, mb.location) AND
        EXISTS (
          SELECT 1
          FROM "MedicineEntity" me
          WHERE me."batchId" = mb.id AND me."transactionId" IS NULL
        )
      ORDER BY mi.item_name, mb."expiryDate"
      OFFSET $2 LIMIT $3
    `;

    const result = await db.query(sql, [location, offset, limit]);
    return result.rows;
  },

  _getMedicineStatus: async (_, { patientId, offset = 0, limit = 20 }, { res }) => {
    try {
      const sql = `
        SELECT mrl.*, ${ITEMS_AGG}
        FROM "MedicineRequestLog" mrl
        LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
        WHERE mrl."patientId" = $1
        GROUP BY mrl.id
        ORDER BY mrl.created_at DESC
        OFFSET $2 LIMIT $3
      `;

      const result = await db.query(sql, [patientId, offset, limit]);
      // Fetch items with names for each request
      for (const request of result.rows) {
        request.items = await getItemsWithNames(request.id);
      }
      return result.rows;
    } catch (error) {
      logger.error("Error in _getMedicineStatus:", error);
      throw error;
    }
  },

  _getMedicineRequestById: async (_, { requestId }, { res }) => {
    try {
      const sql = `
        SELECT mrl.*, ${ITEMS_AGG}
        FROM "MedicineRequestLog" mrl
        LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
        WHERE mrl.id = $1
        GROUP BY mrl.id
        LIMIT 1
      `;

      const result = await db.query(sql, [requestId]);
      if (result.rows.length === 0) return null;
      
      const request = result.rows[0];
      // Fetch items with medicine names
      request.items = await getItemsWithNames(requestId);
      return request;
    } catch (error) {
      logger.error("Error in _getMedicineRequestById:", error);
      throw error;
    }
  },

  _getMedicineRequests: async (_, { patientId, offset = 0, limit = 20 }, { res }) => {
    try {
      const sql = `
        SELECT mrl.*, ${ITEMS_AGG}
        FROM "MedicineRequestLog" mrl
        LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
        WHERE mrl."patientId" = $1
        GROUP BY mrl.id
        ORDER BY mrl.created_at DESC
        OFFSET $2 LIMIT $3
      `;

      const result = await db.query(sql, [patientId, offset, limit]);
      // Fetch items with names for each request
      for (const request of result.rows) {
        request.items = await getItemsWithNames(request.id);
      }
      return result.rows;
    } catch (error) {
      logger.error("Error in _getMedicineRequests:", error);
      throw error;
    }
  },

  _getAllMedicineRequests: async (_, { location, status, offset = 0, limit = 50 }, { res }) => {
    try {
      const sql = `
        SELECT mrl.*, ${ITEMS_AGG}
        FROM "MedicineRequestLog" mrl
        LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
        WHERE 
          mrl.location = COALESCE($1, mrl.location) AND 
          mrl.status = COALESCE($2, mrl.status)
        GROUP BY mrl.id
        ORDER BY mrl.created_at DESC
        OFFSET $3 LIMIT $4
      `;

      const result = await db.query(sql, [location, status, offset, limit]);
      // Fetch items with names for each request
      for (const request of result.rows) {
        request.items = await getItemsWithNames(request.id);
      }
      return result.rows;
    } catch (error) {
      logger.error("Error in _getAllMedicineRequests:", error);
      throw error;
    }
  },
};

const Mutation = {
  _createMedicineRequest: async (_, { patientId, input }, { res }) => {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throwGraphQLError(res).message("At least one medicine item is required").status(400).throw();
    }

    const userBranch = await db.getUserBranch(patientId);
    const valid =
      (userBranch === "Manila" && ["Arlegui", "Casal"].includes(input.location)) ||
      (userBranch === "QuezonCity" && input.location === "QuezonCity") ||
      (userBranch === "Both");

    if (!valid) {
      throwGraphQLError(res).message(`Invalid location outside your scope "${input.location}".`).status(400).throw();
    }


    const query = `
      INSERT INTO "MedicineRequestLog" ("patientId", status, location, purpose, notes)
      VALUES ($1, 'Pending', $2, $3, $4)
      RETURNING *
    `;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(query, [
        patientId, 
        input.location, 
        input.purpose, 
        input.notes || null,
      ]);
      const request = result.rows[0];

      const values = input.items
        .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');
      const params = [
        request.id,
        ...input.items.flatMap((item) => [item.batchId ?? item.medicineId, item.quantity]),
      ];

      const entityQuery = await client.query(
        `INSERT INTO "MedicineRequestEntity" ("requestId", "medicineId", quantity)
         VALUES ${values}
         RETURNING id, "requestId", "medicineId" AS "batchId", "medicineId", quantity`,
        params
      );

      await client.query('COMMIT');
      
      // Fetch items with medicine names
      request.items = await getItemsWithNames(request.id);
      return request;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _createMedicineRequest:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _setStatusMedicineRequest: async (_, { requestId, status, approvedBy, notes }, { res }) => {
    const validStatuses = ["Approved", "Rejected", "Cancelled", "Completed"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res).message("Invalid status. Must be Approved, Rejected, Cancelled, or Completed").status(400).throw();
    }

    const current = await db.query(
      `SELECT * FROM "MedicineRequestLog" WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    if (current.rows.length === 0) {
      throwGraphQLError(res).message("Medicine request not found").status(404).throw();
    }
    
    // Allow transitions: Pending -> Approved/Rejected/Cancelled, Approved -> Completed
    const currentStatus = current.rows[0].status;
    const allowedTransitions = {
      "Pending": ["Approved", "Rejected", "Cancelled"],
      "Approved": ["Completed", "Rejected"],
    };
    
    if (!allowedTransitions[currentStatus]?.includes(status)) {
      throwGraphQLError(res).message(`Cannot transition from ${currentStatus} to ${status}`).status(400).throw();
    }

    // Build update query based on whether approvedBy is provided
    let updateSql;
    let params;
    
    if (approvedBy !== null && approvedBy !== undefined) {
      // Update with approvedBy
      updateSql = `
        UPDATE "MedicineRequestLog"
        SET status = $1, approved_by = $2, notes = COALESCE($3, notes)
        WHERE id = $4
        RETURNING *
      `;
      params = [status, approvedBy, notes, requestId];
    } else {
      // Update without approvedBy (for patient self-cancellation)
      updateSql = `
        UPDATE "MedicineRequestLog"
        SET status = $1, notes = COALESCE($2, notes)
        WHERE id = $3
        RETURNING *
      `;
      params = [status, notes, requestId];
    }
    
    const result = await db.query(updateSql, params);
    
    // Fetch items with medicine names
    result.rows[0].items = await getItemsWithNames(requestId);

    return result.rows[0];
  },

  // ✅ PART 2: Add medicine to existing request
  _addMedicineToRequest: async (_, { requestId, items }, { res }) => {
    if (!Array.isArray(items) || items.length === 0) {
      throwGraphQLError(res).message("At least one medicine item is required").status(400).throw();
    }

    // Fetch current request
    const requestResult = await db.query(
      `SELECT * FROM "MedicineRequestLog" WHERE id = $1 LIMIT 1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throwGraphQLError(res).message("Medicine request not found").status(404).throw();
    }

    const currentRequest = requestResult.rows[0];

    // Only allow adding medicines to Pending requests
    if (currentRequest.status !== 'Pending') {
      throwGraphQLError(res)
        .message(`Cannot add medicines to ${currentRequest.status} request. Only Pending requests can be modified.`)
        .status(400)
        .throw();
    }

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Insert new medicine request entities
      for (const item of items) {
        const insertSql = `
          INSERT INTO "MedicineRequestEntity" ("requestId", "medicineId", quantity)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
        await client.query(insertSql, [
          requestId,
          item.medicineId || item.batchId,
          item.quantity || 1
        ]);
      }

      await client.query('COMMIT');

      // Fetch and return updated request with all items
      const updatedRequest = await client.query(
        `SELECT * FROM "MedicineRequestLog" WHERE id = $1`,
        [requestId]
      );

      if (updatedRequest.rows.length > 0) {
        updatedRequest.rows[0].items = await getItemsWithNames(requestId);
      }

      return updatedRequest.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _addMedicineToRequest:", err);
      throwGraphQLError(res).message("Failed to add medicine to request").status(500).throw();
    } finally {
      client.release();
    }
  },
};

module.exports = { Query, Mutation };
