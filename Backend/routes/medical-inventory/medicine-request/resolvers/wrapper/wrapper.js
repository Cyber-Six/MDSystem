const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
const { enqueueNotificationEmail } = require("../../../../../services/emailservice.js");
const { findEmailByUserId } = require("../../../../../config/query.js");

// Reused in all request list queries: aggregates request line items as a JSON array
const ITEMS_AGG = `
  COALESCE(
    json_agg(
      json_build_object('id', mre.id, 'batchId', mre."batchId", 'requestId', mre."requestId", 'quantity', mre.quantity)
    ) FILTER (WHERE mre.id IS NOT NULL),
    '[]'
  ) AS items`.trim();

const Query = {
  _getAvailableMedicine: async (_, { location, offset = 0, limit = 20 }, { res }) => {
    const params = [];
    const conditions = [
      `mi.active = true`,
      `mi.category = 'Medicine'`,
      `mb."expiryDate" > CURRENT_DATE`,
    ];

    if (location) conditions.push(`mb.location = $${params.push(location)}`);

    const sql = `
      SELECT
        mi.id, mi.item_code, mi.item_name, mi.category, mi.description,
        mb.id AS "batchId", mb."batchNumber", mb."dosageUnit", mb."dosageValue", mb."expiryDate", mb.location
      FROM "MedicalItems" mi
      JOIN "MedicineBatch" mb ON mb."medicalItemId" = mi.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mi.item_name, mb."expiryDate"
      OFFSET $${params.push(offset)} LIMIT $${params.push(limit)}
    `;

    const result = await db.query(sql, params);
    return result.rows;
  },

  _getMedicineStatus: async (_, { patientId }, { res }) => {
    const sql = `
      SELECT mrl.*, ${ITEMS_AGG}
      FROM "MedicineRequestLog" mrl
      LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
      WHERE mrl."patientId" = $1
      GROUP BY mrl.id
      ORDER BY mrl.created_at DESC
    `;

    const result = await db.query(sql, [patientId]);
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

  _getAllMedicineRequests: async (_, { status, offset = 0, limit = 50 }, { res }) => {
    const params = [];
    const where = status ? `WHERE mrl.status = $${params.push(status)}` : '';

    const sql = `
      SELECT mrl.*, ${ITEMS_AGG}
      FROM "MedicineRequestLog" mrl
      LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
      ${where}
      GROUP BY mrl.id
      ORDER BY mrl.created_at DESC
      OFFSET $${params.push(offset)} LIMIT $${params.push(limit)}
    `;

    const result = await db.query(sql, params);
    return result.rows;
  },
};

const Mutation = {
  _createMedicineRequest: async (_, { patientId, input }, { res }) => {
    const logSql = `
      INSERT INTO "MedicineRequestLog" ("patientId", status, purpose, created_at)
      VALUES ($1, 'Pending', $2, $3)
      RETURNING *
    `;

    const entitySql = `
      INSERT INTO "MedicineRequestEntity" ("batchId", "requestId", quantity)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    try {
      const logResult = await db.query(logSql, [
        patientId, input.purpose, Math.floor(Date.now() / 1000),
      ]);
      const request = logResult.rows[0];

      const items = [];
      for (const item of input.items) {
        const entityResult = await db.query(entitySql, [item.batchId, request.id, item.quantity]);
        items.push(entityResult.rows[0]);
      }

      request.items = items;
      return request;
    } catch (err) {
      logger.error("Error in _createMedicineRequest:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
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
        `SELECT * FROM "MedicineRequestEntity" WHERE "requestId" = $1`,
        [requestId],
      );
      const totalQuantity = itemsResult.rows.reduce((sum, item) => sum + item.quantity, 0);
      
      // Validate available units for each batch before approval
      const { validateBatchAvailable } = require('./helper.js');
      for (const item of itemsResult.rows) {
        await validateBatchAvailable(item.batchId, item.quantity, res);
      }

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
        for (const item of itemsResult.rows) {
          const assignSql = `
            UPDATE "MedicineEntity" SET "transactionId" = $1 
            WHERE id IN (
              SELECT me.id 
              FROM "MedicineEntity" me
              JOIN "MedicineBatch" mb ON mb.id = me."batchId"
              WHERE me."batchId" = $2 AND me."transactionId" IS NULL
              ORDER BY mb."expiryDate" ASC
              LIMIT $3
            )
          `;
          await client.query(assignSql, [transactionId, item.batchId, item.quantity]);
        }

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
      `SELECT * FROM "MedicineRequestEntity" WHERE "requestId" = $1`,
      [requestId],
    );
    result.rows[0].items = items.rows;

    // Email notification on approval or rejection
    if (status === "Approved" || status === "Rejected") {
      try {
        const patientEmail = await findEmailByUserId(current.rows[0].patientId);
        if (patientEmail) {
          const approved = status === 'Approved';
          await enqueueNotificationEmail(
            patientEmail,
            approved ? 'Medicine Request Approved' : 'Medicine Request Rejected',
            approved
              ? `Your medicine request <strong>#${requestId}</strong> has been <span style="color:green;font-weight:bold;">approved</span> by the medical staff. You may now proceed to the clinic to collect your medicine.`
              : `Your medicine request <strong>#${requestId}</strong> has been <span style="color:red;font-weight:bold;">rejected</span> by the medical staff. Please contact the clinic if you believe this is an error or to submit a new request.`,
            notes ?? null,
          );
        }
      } catch (emailErr) {
        logger.error("Failed to enqueue medicine request email:", emailErr);
      }
    }

    return result.rows[0];
  },
};

module.exports = { Query, Mutation };
