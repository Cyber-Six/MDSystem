const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
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
            json_build_object('id', me.id, 'batchId', me."batchId", 'transactionId', me."transactionId")
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
    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);

    const txSql = `
      INSERT INTO "MedicineTransactionLog" ("patientId", action, quantity, "issuedBy", notes)
      VALUES ($1, 'Issue', $2, $3, $4)
      RETURNING *
    `;

    const entitySql = `
      INSERT INTO "MedicineEntity" ("batchId", "transactionId")
      VALUES ($1, $2)
      RETURNING *
    `;

    try {
      const txResult = await db.query(txSql, [
        input.patientId, totalQuantity, issuedBy, input.notes || null,
      ]);
      const transaction = txResult.rows[0];

      const items = [];
      for (const item of input.items) {
        // Assign existing unassigned entities (FEFO: First-Expiry-First-Out)
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
          RETURNING *
        `;
        const assignResult = await db.query(assignSql, [transaction.id, item.batchId, item.quantity]);
        items.push(...assignResult.rows);
      }

      transaction.items = items;

      // Send email notification to patient
      try {
        const patientEmail = await findEmailByUserId(input.patientId);
        if (patientEmail) {
          await enqueueNotificationEmail(
            patientEmail,
            'Prescription Issued',
            `A prescription <strong>#${transaction.id}</strong> has been <span style="color:green;font-weight:bold;">issued</span> for you by the medical staff. Please visit the clinic to collect your prescribed medicine.`,
            input.notes ?? null,
          );
        }
      } catch (emailErr) {
        logger.error("Failed to enqueue prescription email:", emailErr);
      }

      return transaction;
    } catch (err) {
      logger.error("Error in _issuePrescription:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },
};

module.exports = { Query, Mutation };
