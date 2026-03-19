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

    const updateSql = `
      UPDATE "MedicineRequestLog"
      SET status = $1, approved_by = $2, notes = COALESCE($3, notes)
      WHERE id = $4
      RETURNING *
    `;
    const result = await db.query(updateSql, [status, approvedBy, notes, requestId]);
    
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
