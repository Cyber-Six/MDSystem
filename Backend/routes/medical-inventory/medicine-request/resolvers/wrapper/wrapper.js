const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");

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
    return result.rows;
  },

  _getMedicineRequestById: async (_, { requestId }, { res }) => {
    const sql = `
      SELECT mrl.*, ${ITEMS_AGG}
      FROM "MedicineRequestLog" mrl
      LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
      WHERE mrl.id = $1
      GROUP BY mrl.id
      LIMIT 1
    `;

    const result = await db.query(sql, [requestId]);
    return result.rows[0] || null;
  },

  _getMedicineRequests: async (_, { patientId, offset = 0, limit = 20 }, { res }) => {
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
    return result.rows;
  },

  _getAllMedicineRequests: async (_, { location, status, offset = 0, limit = 50 }, { res }) => {
    const sql = `
      SELECT mrl.*, ${ITEMS_AGG}
      FROM "MedicineRequestLog" mrl
      LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
      WHERE 
        location = COALESCE($1, location) AND 
        status = COALESCE($2, status)
      GROUP BY mrl.id
      ORDER BY mrl.created_at DESC
      OFFSET $3 LIMIT $4
    `;

    const result = await db.query(sql, [location, status, offset, limit]);
    return result.rows;
  },
};

const Mutation = {
  _createMedicineRequest: async (_, { patientId, input }, { res }) => {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throwGraphQLError(res).message("At least one medicine item is required").status(400).throw();
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

      request.items = entityQuery.rows;
      await client.query('COMMIT');
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
    const validStatuses = ["Approved", "Rejected", "Cancelled"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res).message("Invalid status. Must be Approved, Rejected, or Cancelled").status(400).throw();
    }

    const current = await db.query(
      `SELECT * FROM "MedicineRequestLog" WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    if (current.rows.length === 0) {
      throwGraphQLError(res).message("Medicine request not found").status(404).throw();
    }
    if (current.rows[0].status !== "Pending") {
      throwGraphQLError(res).message("Only pending requests can be updated").status(400).throw();
    }

    let result;

    if (status === "Approved") {
      const itemsResult = await db.query(
        `SELECT id, "requestId", "medicineId" AS "batchId", quantity
         FROM "MedicineRequestEntity"
         WHERE "requestId" = $1`,
        [requestId],
      );

      if (itemsResult.rows.length === 0) {
        throwGraphQLError(res).message("Medicine request has no items").status(400).throw();
      }

      const totalQuantity = itemsResult.rows.reduce((sum, item) => sum + item.quantity, 0);
      
      // Validate available units for each batch before approval
      const { validateBatchesWithQuantity } = require('./helper.js');
      await validateBatchesWithQuantity(itemsResult.rows.map(r => ({ batchId: r.batchId, quantity: r.quantity })), res);

      // Dedicated client so BEGIN/COMMIT/ROLLBACK stay on the same connection.
      // SET CONSTRAINTS ALL DEFERRED resolves the circular FK between
      // MedicineTransactionLog and MedicineRequestLog (DEFERRABLE INITIALLY IMMEDIATE).
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET CONSTRAINTS ALL DEFERRED');

        const txSql = `
          INSERT INTO "MedicineTransactionLog" ("patientId", action, quantity, "issuedBy", notes)
          VALUES ($1, 'Issue', $2, $3, $4)
          RETURNING *
        `;
        const txResult = await client.query(txSql, [
          current.rows[0].patientId, totalQuantity, approvedBy, notes || null,
        ]);
        const transactionId = txResult.rows[0].id;

        // Assign existing unassigned entities instead of creating new ones (FEFO)
        // Single UPDATE using a window function to rank unassigned units per batch
        // by expiry date (ASC) and assign only the requested quantity for each batch.
        const batchParams = itemsResult.rows.flatMap(item => [item.batchId, item.quantity]);
        const valuesList = itemsResult.rows
          .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
          .join(', ');
        await client.query(
          `WITH batch_requests(batch_id, qty) AS (
             VALUES ${valuesList}
           ),
           ranked AS (
             SELECT me.id, br.qty,
               ROW_NUMBER() OVER (PARTITION BY me."batchId" ORDER BY mb."expiryDate" ASC) AS rn
             FROM "MedicineEntity" me
             JOIN "MedicineBatch" mb ON mb.id = me."batchId"
             JOIN batch_requests br ON br.batch_id = me."batchId"
             WHERE me."transactionId" IS NULL
           )
           UPDATE "MedicineEntity" SET "transactionId" = $${batchParams.length + 1}
           WHERE id IN (SELECT id FROM ranked WHERE rn <= qty)`,
          [...batchParams, transactionId],
        );

        const updateSql = `
          UPDATE "MedicineRequestLog"
          SET status = $1, approved_by = $2, "transactionId" = $3, notes = COALESCE($4, notes)
          WHERE id = $5
          RETURNING *
        `;
        result = await client.query(updateSql, [status, approvedBy, transactionId, notes, requestId]);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error("Error in _setStatusMedicineRequest approval:", err);
        throwGraphQLError(res).message("Database error").status(500).throw();
      } finally {
        client.release();
      }
    } else {
      const updateSql = `
        UPDATE "MedicineRequestLog"
        SET status = $1, approved_by = $2, notes = COALESCE($3, notes)
        WHERE id = $4
        RETURNING *
      `;
      result = await db.query(updateSql, [status, approvedBy, notes, requestId]);
    }

    const items = await db.query(
      `SELECT id, "requestId", "medicineId" AS "batchId", "medicineId", quantity
       FROM "MedicineRequestEntity"
       WHERE "requestId" = $1`,
      [requestId],
    );
    result.rows[0].items = items.rows; 

    return result.rows[0];
  },
};

module.exports = { Query, Mutation };
