const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
const { enqueuePrescriptionNotification } = require("../../../../../services/emailservice.js");
const { findEmailByUserId } = require("../../../../../config/query.js");

const Query = {
  _getAvailableMedicine: async (_, { location, offset = 0, limit = 20 }, { res }) => {
    let sql =
      'SELECT mi.id, mi.item_code, mi.item_name, mi.category, mi.description, ' +
      'mb.id AS "batchId", mb."batchNumber", mb."dosageUnit", ' +
      'mb."dosageValue", mb."expiryDate", mb.location ' +
      'FROM "MedicalItems" mi ' +
      'JOIN "MedicineBatch" mb ON mb."medicalItemId" = mi.id ' +
      'WHERE mi.active = true AND mi.category = ' + "'medicine'" + ' AND mb."expiryDate" > CURRENT_DATE';
    const params = [];
    let idx = 1;

    if (location) {
      sql += ' AND mb.location = $' + idx;
      params.push(location);
      idx++;
    }

    sql += ' ORDER BY mi.item_name, mb."expiryDate" OFFSET $' + idx + ' LIMIT $' + (idx + 1);
    params.push(offset, limit);

    const result = await db.query(sql, params);
    return result.rows;
  },

  _getPatientPrescriptions: async (_, { patientId, offset = 0, limit = 20 }, { res }) => {
    const sql =
      'SELECT mtl.*, ' +
      'COALESCE(json_agg(' +
      'json_build_object(' + "'id'" + ', me.id, ' + "'batchId'" + ', me."batchId", ' + "'transactionId'" + ', me."transactionId")' +
      ') FILTER (WHERE me.id IS NOT NULL), ' + "'[]'" + ') AS items ' +
      'FROM "MedicineTransactionLog" mtl ' +
      'LEFT JOIN "MedicineEntity" me ON me."transactionId" = mtl.id ' +
      'WHERE mtl."patientId" = $1 ' +
      'GROUP BY mtl.id ORDER BY mtl."issuedAt" DESC ' +
      'OFFSET $2 LIMIT $3';
    const result = await db.query(sql, [patientId, offset, limit]);
    return result.rows;
  },
};

const Mutation = {
  _issuePrescription: async (_, { input, issuedBy }, { res }) => {
    const totalQuantity = input.items.reduce(function(sum, item) { return sum + item.quantity; }, 0);

    const txSql =
      'INSERT INTO "MedicineTransactionLog" ("patientId", action, quantity, "issuedBy", notes) ' +
      'VALUES ($1, ' + "'issue'" + ', $2, $3, $4) RETURNING *';

    try {
      const txResult = await db.query(txSql, [
        input.patientId, totalQuantity, issuedBy, input.notes || null
      ]);
      const transaction = txResult.rows[0];

      const items = [];
      for (const item of input.items) {
        const entitySql =
          'INSERT INTO "MedicineEntity" ("batchId", "transactionId") ' +
          'VALUES ($1, $2) RETURNING *';
        const entityResult = await db.query(entitySql, [item.batchId, transaction.id]);
        items.push(entityResult.rows[0]);
      }

      transaction.items = items;

      // Send email notification to patient
      try {
        const patientEmail = await findEmailByUserId(input.patientId);
        if (patientEmail) {
          await enqueuePrescriptionNotification(patientEmail, transaction.id, input.notes);
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