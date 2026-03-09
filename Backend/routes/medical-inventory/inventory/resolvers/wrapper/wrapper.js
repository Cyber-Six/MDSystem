const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { validateItemActive } = require("./helper.js");
const logger = require("../../../../../utils/logger.js");

const Query = {
  _getMedicalItems: async (_, { category, offset = 0, limit = 20 }, { res }) => {
    let sql = 'SELECT * FROM "MedicalItems" WHERE 1=1';
    const params = [];
    let idx = 1;

    if (category) {
      sql += ' AND category = $' + idx;
      params.push(category);
      idx++;
    }

    sql += ' ORDER BY item_name ASC OFFSET $' + idx + ' LIMIT $' + (idx + 1);
    params.push(offset, limit);

    const result = await db.query(sql, params);
    return result.rows;
  },

  _getMedicalItem: async (_, { id }, { res }) => {
    const result = await db.query(
      'SELECT * FROM "MedicalItems" WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
  },

  _getMedicalSupply: async (_, { medicalItemId, location, offset = 0, limit = 20 }, { res }) => {
    let sql = 'SELECT * FROM "MedicineBatch" WHERE "medicalItemId" = $1';
    const params = [medicalItemId];
    let idx = 2;

    if (location) {
      sql += ' AND location = $' + idx;
      params.push(location);
      idx++;
    }

    sql += ' ORDER BY "expiryDate" ASC OFFSET $' + idx + ' LIMIT $' + (idx + 1);
    params.push(offset, limit);

    const result = await db.query(sql, params);
    return result.rows;
  },

  _getSupplyBatches: async (_, { supplyItemId, location, offset = 0, limit = 20 }, { res }) => {
    let sql = 'SELECT * FROM "SupplyBatch" WHERE "supplyItemId" = $1';
    const params = [supplyItemId];
    let idx = 2;

    if (location) {
      sql += ' AND location = $' + idx;
      params.push(location);
      idx++;
    }

    sql += ' ORDER BY expiry_date ASC OFFSET $' + idx + ' LIMIT $' + (idx + 1);
    params.push(offset, limit);

    const result = await db.query(sql, params);
    return result.rows;
  },
};

const Mutation = {
  _createMedicalItems: async (_, { input }, { res }) => {
    const sql =
      'INSERT INTO "MedicalItems" (item_code, item_name, category, description) ' +
      'VALUES ($1, $2, $3, $4) RETURNING *';

    try {
      const result = await db.query(sql, [
        input.item_code, input.item_name, input.category, input.description || null
      ]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throwGraphQLError(res).message("Item code already exists").status(409).throw();
      }
      logger.error("Error in _createMedicalItems:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _updateMedicalItems: async (_, { id, input }, { res }) => {
    const allowedFields = ["item_code", "item_name", "category", "description", "active"];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined && allowedFields.includes(key)) {
        fields.push('"' + key + '" = $' + idx);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    fields.push('"updated_at" = current_timestamp');
    values.push(id);

    const sql = 'UPDATE "MedicalItems" SET ' + fields.join(", ") + ' WHERE id = $' + idx + ' RETURNING *';

    try {
      const result = await db.query(sql, values);
      if (result.rows.length === 0) {
        throwGraphQLError(res).message("Medical item not found").status(404).throw();
      }
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throwGraphQLError(res).message("Item code already exists").status(409).throw();
      }
      logger.error("Error in _updateMedicalItems:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _deleteMedicalItems: async (_, { id }, { res }) => {
    const sql = 'UPDATE "MedicalItems" SET active = false, updated_at = current_timestamp WHERE id = $1 RETURNING id';
    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Medical item not found").status(404).throw();
    }
    return true;
  },

  _addMedicalSupply: async (_, { input, receivedBy }, { res }) => {
    await validateItemActive(input.medicalItemId, res);

    const sql =
      'INSERT INTO "MedicineBatch" ("medicalItemId", "supplierName", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location, "receivedBy", notes) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';

    try {
      const result = await db.query(sql, [
        input.medicalItemId, input.supplierName || null, input.batchNumber,
        input.dosageUnit, input.dosageValue, input.expiryDate,
        input.location, receivedBy, input.notes || null
      ]);
      return result.rows[0];
    } catch (err) {
      logger.error("Error in _addMedicalSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _addSupplyBatch: async (_, { input, receivedBy }, { res }) => {
    await validateItemActive(input.supplyItemId, res);

    const sql =
      'INSERT INTO "SupplyBatch" ("supplyItemId", batch_number, "initialQuantity", "currentQuantity", unit, expiry_date, location, received_at, "receivedBy", supplier_name, notes) ' +
      'VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *';

    try {
      const result = await db.query(sql, [
        input.supplyItemId, input.batch_number, input.initialQuantity,
        input.unit, input.expiry_date || null, input.location,
        input.received_at || null, receivedBy, input.supplier_name || null, input.notes || null
      ]);
      return result.rows[0];
    } catch (err) {
      logger.error("Error in _addSupplyBatch:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _splitMedicalSupply: async (_, { batchId, input }, { res }) => {
    const source = await db.query(
      'SELECT * FROM "SupplyBatch" WHERE id = $1 LIMIT 1',
      [batchId]
    );

    if (source.rows.length === 0) {
      throwGraphQLError(res).message("Supply batch not found").status(404).throw();
    }

    const batch = source.rows[0];

    if (batch.currentQuantity < input.quantity) {
      throwGraphQLError(res).message("Insufficient quantity to split").status(400).throw();
    }

    if (batch.location === input.targetLocation) {
      throwGraphQLError(res).message("Target location must differ from source").status(400).throw();
    }

    // Reduce source quantity
    await db.query(
      'UPDATE "SupplyBatch" SET "currentQuantity" = "currentQuantity" - $1 WHERE id = $2',
      [input.quantity, batchId]
    );

    // Create new batch at target location
    const sql =
      'INSERT INTO "SupplyBatch" ("supplyItemId", batch_number, "initialQuantity", "currentQuantity", unit, expiry_date, location, "receivedBy", supplier_name, notes) ' +
      'VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9) RETURNING *';

    const result = await db.query(sql, [
      batch.supplyItemId, batch.batch_number, input.quantity,
      batch.unit, batch.expiry_date, input.targetLocation,
      batch.receivedBy, batch.supplier_name, input.notes || batch.notes
    ]);

    return result.rows[0];
  },

  _updateMedicalSupply: async (_, { batchId, input }, { res }) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (input.expiryDate !== undefined) {
      fields.push('"expiryDate" = $' + idx);
      values.push(input.expiryDate);
      idx++;
    }
    if (input.notes !== undefined) {
      fields.push('notes = $' + idx);
      values.push(input.notes);
      idx++;
    }

    if (fields.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    values.push(batchId);
    const sql = 'UPDATE "MedicineBatch" SET ' + fields.join(", ") + ' WHERE id = $' + idx + ' RETURNING *';

    const result = await db.query(sql, values);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
    }
    return result.rows[0];
  },

  _updateSupplyBatch: async (_, { batchId, input }, { res }) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (input.expiryDate !== undefined) {
      fields.push('expiry_date = $' + idx);
      values.push(input.expiryDate);
      idx++;
    }
    if (input.notes !== undefined) {
      fields.push('notes = $' + idx);
      values.push(input.notes);
      idx++;
    }

    if (fields.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    values.push(batchId);
    const sql = 'UPDATE "SupplyBatch" SET ' + fields.join(", ") + ' WHERE id = $' + idx + ' RETURNING *';

    const result = await db.query(sql, values);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Supply batch not found").status(404).throw();
    }
    return result.rows[0];
  },
};

module.exports = { Query, Mutation };