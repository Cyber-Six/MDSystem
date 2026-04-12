const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
const { isConnectedAnywhere, emitToUserWithAck, emitToRole, notifyUser } = require("../../../../../config/sockets");
const { enqueueNotificationEmail } = require("../../../../../services/emailservice.js");
const { findEmailByUserId } = require("../../../../../config/query.js");

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
        AND EXISTS (
          SELECT 1
          FROM "MedicineEntity" me
          WHERE me."batchId" = mb.id AND me."transactionId" IS NULL
        )
      ORDER BY mi.item_name, mb."expiryDate"
      OFFSET $${params.push(offset)} LIMIT $${params.push(limit)}
    `;

    const result = await db.query(sql, params);
    return result.rows;
  },

  _getPatientPrescriptions: async (_, { patientId, offset = 0, limit = 20 }, { res }) => {
    const sql = `
      SELECT mtl.*,
        COALESCE(
          json_agg(
            json_build_object('id', me.id, 'batchId', me."batchId", me."transactionId")
          ) FILTER (WHERE me.id IS NOT NULL),
          '[]'
        ) AS items
      FROM "MedicineTransactionLog" mtl
      LEFT JOIN "MedicineEntity" me ON me."transactionId" = mtl.id
      WHERE mtl."patientId" = $1
      GROUP BY mtl.id
      ORDER BY mtl."issuedAt" DESC
      OFFSET $2 LIMIT $3
    `;

    const result = await db.query(sql, [patientId, offset, limit]);
    return result.rows;
  },
};

const Mutation = {
  _issuePrescription: async (_, { input, issuedBy }, { res }) => {
    const mergedItems = Array.from(
      input.items.reduce((acc, item) => {
        acc.set(item.batchId, (acc.get(item.batchId) || 0) + item.quantity);
        return acc;
      }, new Map()).entries()
    ).map(([batchId, quantity]) => ({ batchId, quantity }));

    const totalQuantity = mergedItems.reduce((sum, item) => sum + item.quantity, 0);

    const txSql = `
      INSERT INTO "MedicineTransactionLog" ("patientId", action, quantity, "issuedBy", notes)
      VALUES ($1, 'Issue', $2, $3, $4)
      RETURNING *
    `;

    const client = await db.connect();
    let transaction;

    try {
      await client.query('BEGIN');

      // ✅ PART 1: Stock validation - prevent dispense if quantity exceeds available stock
      for (const item of mergedItems) {
        const batchCheckSql = `
          SELECT COUNT(*) as available_count
          FROM "MedicineEntity"
          WHERE "batchId" = $1 AND "transactionId" IS NULL
        `;
        const batchCheckResult = await client.query(batchCheckSql, [item.batchId]);
        const availableCount = parseInt(batchCheckResult.rows[0].available_count, 10);

        // If trying to dispense more than available, reject
        if (item.quantity > availableCount) {
          throwGraphQLError(res)
            .message(
              `Cannot dispense. Medicine batch ${item.batchId} has only ${availableCount} unit${availableCount !== 1 ? 's' : ''} available. ` +
              `Requested: ${item.quantity} units.`
            )
            .status(400)
            .throw();
        }
      }

      let linkedRequest = null;
      if (input.requestId !== undefined && input.requestId !== null) {
        const requestResult = await client.query(
          `SELECT *
           FROM "MedicineRequestLog"
           WHERE id = $1
           LIMIT 1`,
          [input.requestId],
        );

        if (requestResult.rows.length === 0) {
          throwGraphQLError(res).message('Medicine request not found').status(404).throw();
        }

        linkedRequest = requestResult.rows[0];
        if (Number(linkedRequest.patientId) !== Number(input.patientId)) {
          throwGraphQLError(res).message('Medicine request does not belong to this patient').status(400).throw();
        }
        if (linkedRequest.status !== 'Approved') {
          throwGraphQLError(res).message('Only approved medicine requests can be dispensed').status(400).throw();
        }
        if (linkedRequest.transactionId) {
          throwGraphQLError(res).message('This medicine request has already been dispensed').status(400).throw();
        }
      }

      const txResult = await client.query(txSql, [
        input.patientId, totalQuantity, issuedBy, input.notes || null,
      ]);
      transaction = txResult.rows[0];

      const items = [];
      for (const item of mergedItems) {
        // Assign existing unassigned entities (FEFO: First-Expiry-First-Out)
        const assignSql = `
          WITH selected AS (
            SELECT me.id
            FROM "MedicineEntity" me
            WHERE me."batchId" = $2 AND me."transactionId" IS NULL
            ORDER BY me.id ASC
            LIMIT $3
          )
          UPDATE "MedicineEntity" me
          SET "transactionId" = $1
          FROM selected
          WHERE me.id = selected.id
          RETURNING me.id, me."batchId", me."transactionId"
        `;
        const assignResult = await client.query(assignSql, [transaction.id, item.batchId, item.quantity]);
        if (assignResult.rows.length !== item.quantity) {
          throwGraphQLError(res)
            .message(`Insufficient available units for batch ${item.batchId}`)
            .status(400)
            .throw();
        }
        items.push(...assignResult.rows);
      }

      transaction.items = items;

      if (!linkedRequest) {
        // Health-chat direct prescription — mirror into MedicineRequestLog so it appears in the dispense queue
        const batchIds = mergedItems.map(i => i.batchId);
        const batchInfoResult = await client.query(
          `SELECT id, "medicalItemId", location FROM "MedicineBatch" WHERE id = ANY($1::int[])`,
          [batchIds],
        );
        const batchInfo = new Map(batchInfoResult.rows.map(r => [r.id, r]));
        const prescLocation = batchInfo.get(mergedItems[0].batchId)?.location ?? null;

        const reqInsertResult = await client.query(
          `INSERT INTO "MedicineRequestLog" ("patientId", status, location, purpose, notes, approved_by)
           VALUES ($1, 'Completed', $2, 'Health Chat Prescription', $3, $4)
           RETURNING id`,
          [input.patientId, prescLocation, input.notes || null, issuedBy],
        );
        const newRequestId = reqInsertResult.rows[0].id;

        for (const item of mergedItems) {
          const medItemId = batchInfo.get(item.batchId)?.medicalItemId;
          if (medItemId) {
            await client.query(
              `INSERT INTO "MedicineRequestEntity" ("requestId", "medicineId", quantity) VALUES ($1, $2, $3)`,
              [newRequestId, medItemId, item.quantity],
            );
          }
        }
      }

      if (linkedRequest) {
        await client.query(
          `UPDATE "MedicineRequestLog"
           SET status = 'Completed', approved_by = COALESCE(approved_by, $1), notes = COALESCE($2, notes)
           WHERE id = $3`,
          [issuedBy, input.notes || null, linkedRequest.id],
        );
      }

      await client.query('COMMIT');

      // Notify all medical staff that stock changed (units were dispensed)
      try {
        emitToRole('medical', 'inventory:stock-changed', {
          action: 'dispense',
          patientId: input.patientId,
          totalQuantity,
          summary: `${totalQuantity} unit${totalQuantity !== 1 ? 's' : ''} dispensed to patient #${input.patientId}`,
        });
      } catch (emitErr) {
        logger.warn('[INVENTORY] Failed to emit inventory:stock-changed after dispense:', emitErr.message);
      }

      // Notify patient: uses notifyUser which respects channel preferences
      try {
        await notifyUser(
          input.patientId,
          'medicine:prescription:issued',
          { transactionId: transaction.id },
          {
            email: null,
            title: 'Prescription Issued',
            message: `A prescription <strong>#${transaction.id}</strong> has been <span style="color:green;font-weight:bold;">issued</span> for you by the medical staff. Please visit the clinic to collect your prescribed medicine.`,
            notes: input.notes ?? null,
          },
        );
      } catch (notifErr) {
        logger.error("Failed to send prescription notification:", notifErr);
      }

      return transaction;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _issuePrescription:", err);
      if (err?.extensions?.http?.status) {
        throw err;
      }
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },
};

module.exports = { Query, Mutation };
