const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { validateItemActive } = require("./helper.js");
const logger = require("../../../../../utils/logger.js");
const { bool } = require("joi");

const Query = {
  _getMedicalItems: async (_, { category, active, offset = 0, limit = 20 }, { res }) => {

    const sql = `
      SELECT * FROM "MedicalItems"
      WHERE category = COALESCE($1, category) AND active = COALESCE($2, active)
      ORDER BY item_name ASC
      OFFSET $3 LIMIT $4
    `;

    const result = await db.query(sql, [category, active, offset, limit]);
    return result.rows;
  },

  _getMedicalItem: async (_, { id }, { res }) => {
    const sql = `SELECT * FROM "MedicalItems" WHERE id = $1 LIMIT 1`;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  },

  _getMedicalSupply: async (_, { medicalItemId, location, availableOnly, offset = 0, limit = 20 }, { res }) => {
    if (typeof availableOnly !== "boolean") {
      throwGraphQLError(res)
        .message("Invalid value for availableOnly")
        .status(400)
        .throw();
    }

    const sql = `
      SELECT mb.*, COALESCE(av.available_count, 0) AS "availableQuantity"
      FROM "MedicineBatch" mb
      LEFT JOIN (
        SELECT "batchId", COUNT(*)::int AS available_count
        FROM "MedicineEntity"
        WHERE "transactionId" IS NULL
        GROUP BY "batchId"
      ) av ON av."batchId" = mb.id
      WHERE 
        mb."medicalItemId" = $1 AND
        mb.location = COALESCE($2, mb.location) AND
        ($3::boolean IS NOT TRUE OR mb."expiryDate" > CURRENT_DATE) AND
        ($3::boolean IS NOT TRUE OR COALESCE(av.available_count, 0) > 0)
      ORDER BY mb."expiryDate" ASC
      OFFSET $4 LIMIT $5
    `;

    const result = await db.query(sql, [medicalItemId, location, availableOnly, offset, limit]);
    return result.rows;
  },

  _getSupplyBatches: async (_, { supplyItemId, location, availableOnly, offset = 0, limit = 20 }, { res }) => {

    const sql = `
      SELECT sb.* FROM "SupplyBatch" sb
      WHERE
        sb."supplyItemId" = $1 AND
        sb.location = COALESCE($2, sb.location) AND
        ($3::boolean IS NOT TRUE OR sb."currentQuantity" > 0) AND
        ($3::boolean IS NOT TRUE OR sb.expiry_date IS NULL OR sb.expiry_date > CURRENT_DATE)
      ORDER BY expiry_date ASC
      OFFSET $4 LIMIT $5
    `;

    const result = await db.query(sql, [supplyItemId, location, availableOnly, offset, limit]);
    return result.rows;
  },
};

const Mutation = {
  _createMedicalItems: async (_, { input }, { res }) => {
    const sql = `
      INSERT INTO "MedicalItems" (item_code, item_name, category, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await db.query(sql, [
        input.item_code, input.item_name, input.category, input.description || null,
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
    const allowed = ['item_code', 'item_name', 'category', 'description', 'active'];
    const params = [];
    const sets = [];

    logger.info("_updateMedicalItems called with id:", id, "input:", input);

    // Build SET clauses with explicit parameter indexing
    Object.entries(input)
      .filter(([key, value]) => value !== null && value !== undefined && allowed.includes(key))
      .forEach(([key, value]) => {
        params.push(value);
        sets.push(`"${key}" = $${params.length}`);
      });

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    sets.push('"updated_at" = current_timestamp');
    
    // Parse id to integer, but be safe about it
    const parsedId = Number(id);
    if (isNaN(parsedId)) {
      logger.error("Invalid id provided:", id);
      throwGraphQLError(res).message("Invalid ID format").status(400).throw();
    }
    params.push(parsedId);

    const sql = `
      UPDATE "MedicalItems"
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    try {
      logger.info("_updateMedicalItems - SQL:", sql);
      logger.info("_updateMedicalItems - Params:", params);
      const result = await db.query(sql, params);
      if (result.rows.length === 0) {
        throwGraphQLError(res).message("Medical item not found").status(404).throw();
      }
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throwGraphQLError(res).message("Item code already exists").status(409).throw();
      }
      logger.error("Error in _updateMedicalItems - SQL:", sql);
      logger.error("Error in _updateMedicalItems - Params:", params);
      logger.error("Error in _updateMedicalItems - Full Error:", err.message, err.code, err.detail);
      throwGraphQLError(res).message(`Database error: ${err.message}`).status(500).throw();
    }
  },

  _deleteMedicalItems: async (_, { id }, { res }) => {
    const sql = `
      UPDATE "MedicalItems"
      SET active = false, updated_at = current_timestamp
      WHERE id = $1
      RETURNING id
    `;

    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Medical item not found").status(404).throw();
    }
    return true;
  },

  _addMedicalSupply: async (_, { input, receivedBy }, { res }) => {
    await validateItemActive(input.medicalItemId, res);

    const sql = `
      INSERT INTO "MedicineBatch"
        ("medicalItemId", "supplierName", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location, "receivedBy", notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    try {
      const result = await db.query(sql, [
        input.medicalItemId, input.supplierName || null, input.batchNumber,
        input.dosageUnit, input.dosageValue, input.expiryDate,
        input.location, receivedBy, input.notes || null,
      ]);

      const batch = result.rows[0];
      const quantity = input.quantity || 1;

      // Bulk insert individual MedicineEntity records for each unit
      if (quantity > 0) {
        const placeholders = Array(quantity).fill('($1)').join(', ');
        await db.query(
          `INSERT INTO "MedicineEntity" ("batchId") VALUES ${placeholders}`,
          [batch.id],
        );
      }

      return batch;
    } catch (err) {
      logger.error("Error in _addMedicalSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _addSupplyBatch: async (_, { input, receivedBy }, { res }) => {
    await validateItemActive(input.supplyItemId, res);

    // $3 is used twice: initialQuantity and currentQuantity start equal
    const sql = `
      INSERT INTO "SupplyBatch"
        ("supplyItemId", batch_number, "initialQuantity", "currentQuantity", unit, expiry_date, location, received_at, "receivedBy", supplier_name, notes)
      VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    try {
      const result = await db.query(sql, [
        input.supplyItemId, input.batch_number, input.initialQuantity,
        input.unit, input.expiry_date || null, input.location,
        input.received_at || null, receivedBy, input.supplier_name || null, input.notes || null,
      ]);
      return result.rows[0];
    } catch (err) {
      logger.error("Error in _addSupplyBatch:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _splitMedicalSupply: async (_, { batchId, input }, { res }) => {
    const source = await db.query(
      `SELECT * FROM "SupplyBatch" WHERE id = $1 LIMIT 1`,
      [batchId],
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

    // Deduct from source batch
    await db.query(
      `UPDATE "SupplyBatch" SET "currentQuantity" = "currentQuantity" - $1 WHERE id = $2`,
      [input.quantity, batchId],
    );

    // Create new batch at target location — $3 used twice for initial/current quantity
    const sql = `
      INSERT INTO "SupplyBatch"
        ("supplyItemId", batch_number, "initialQuantity", "currentQuantity", unit, expiry_date, location, "receivedBy", supplier_name, notes)
      VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(sql, [
      batch.supplyItemId, batch.batch_number, input.quantity,
      batch.unit, batch.expiry_date, input.targetLocation,
      batch.receivedBy, batch.supplier_name, input.notes || batch.notes,
    ]);

    return result.rows[0];
  },

  _updateMedicalSupply: async (_, { batchId, input }, { res }) => {
    const params = [];
    const sets = [];

    if (input.expiryDate !== undefined) sets.push(`"expiryDate" = $${params.push(input.expiryDate)}`);
    if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    params.push(batchId);

    const sql = `
      UPDATE "MedicineBatch"
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const result = await db.query(sql, params);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
    }
    return result.rows[0];
  },

  _updateSupplyBatch: async (_, { batchId, input }, { res }) => {
    const params = [];
    const sets = [];

    if (input.expiryDate !== undefined) sets.push(`expiry_date = $${params.push(input.expiryDate)}`);
    if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    params.push(batchId);

    const sql = `
      UPDATE "SupplyBatch"
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const result = await db.query(sql, params);
    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Supply batch not found").status(404).throw();
    }
    return result.rows[0];
  },
};

module.exports = { Query, Mutation };
