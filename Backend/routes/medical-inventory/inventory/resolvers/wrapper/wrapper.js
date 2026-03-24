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
      SELECT sb.*, COALESCE(av.available_count, 0) AS "currentQuantity"
      FROM "SupplyBatch" sb
      LEFT JOIN (
        SELECT "batchId", COUNT(*)::int AS available_count
        FROM "SupplyEntity"
        WHERE "transactionId" IS NULL
        GROUP BY "batchId"
      ) av ON av."batchId" = sb.id
      WHERE
        sb."supplyItemId" = $1 AND
        sb.location = COALESCE($2, sb.location) AND
        ($3::boolean IS NOT TRUE OR COALESCE(av.available_count, 0) > 0) AND
        ($3::boolean IS NOT TRUE OR sb."expiryDate" IS NULL OR sb."expiryDate" > CURRENT_DATE)
      ORDER BY "expiryDate" ASC
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

    const sets = Object.entries(input)
      .filter(([key, value]) => value !== null && value !== undefined && allowed.includes(key))
      .map(([key, value]) => `"${key}" = $${params.push(value)}`);

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    sets.push('"updated_at" = current_timestamp');
    params.push(id);

    const sql = `
      UPDATE "MedicalItems"
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    try {
      const result = await db.query(sql, params);
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
        ("medicalItemId", "supplierName", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location, "receivedBy", notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, current_timestamp, current_timestamp)
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

    const sql = `
      INSERT INTO "SupplyBatch"
        ("supplyItemId", "batchNumber", unit, "expiryDate", location, "receivedBy", "supplierName", notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp, current_timestamp)
      RETURNING *
    `;

    try {
      const result = await db.query(sql, [
        input.supplyItemId, input.batchNumber, input.unit,
        input.expiryDate || null, input.location,
        receivedBy, input.supplierName || null, input.notes || null,
      ]);

      const batch = result.rows[0];
      const quantity = input.initialQuantity || 1;

      // Bulk insert individual SupplyEntity records for each unit
      if (quantity > 0) {
        const placeholders = Array(quantity).fill('($1)').join(', ');
        await db.query(
          `INSERT INTO "SupplyEntity" ("batchId") VALUES ${placeholders}`,
          [batch.id],
        );
      }

      return batch;
    } catch (err) {
      logger.error("Error in _addSupplyBatch:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _splitMedicalSupply: async (_, { batchId, input }, { res }) => {
    if (input.quantity <= 0) {
      throwGraphQLError(res).message("Quantity to split must be positive").status(400).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const source = await client.query(
        `SELECT * FROM "SupplyBatch" WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [batchId],
      );

      if (source.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Supply batch not found").status(404).throw();
      }

      const batch = source.rows[0];

      if (batch.location === input.targetLocation) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Target location must differ from source").status(400).throw();
      }

      // Get count of available quantity in the batch
      const availableResult = await client.query(
        `SELECT COUNT(*)::int AS available_count FROM "SupplyEntity" WHERE "batchId" = $1 AND "transactionId" IS NULL`,
        [batchId],
      );

      const availableCount = availableResult.rows[0].available_count;

      if (availableCount < input.quantity) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Insufficient available quantity to split").status(400).throw();
      }

      const sql = `INSERT INTO "SupplyBatch"
      ("supplyItemId", "batchNumber", unit, "expiryDate",
        location, "receivedBy", "supplierName", notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp, current_timestamp) RETURNING *`;

      const result = await client.query(sql, [
        batch.supplyItemId, batch.batchNumber, batch.unit, batch.expiryDate,
        input.targetLocation, batch.receivedBy,
        batch.supplierName, input.notes || batch.notes,
      ]);

      const newBatch = result.rows[0];

      // Move specified quantity of entities to new batch
      const updateResult = await client.query(
        `UPDATE "SupplyEntity" SET "batchId" = $1 WHERE id IN (
          SELECT id FROM "SupplyEntity" WHERE "batchId" = $2 AND "transactionId" IS NULL LIMIT $3
        )`,
        [newBatch.id, batchId, input.quantity],
      );

      // Verify actual moved count matches requested
      if (updateResult.rowCount !== input.quantity) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message(`Failed to move exact quantity. Expected ${input.quantity}, moved ${updateResult.rowCount}`)
          .status(409)
          .throw();
      }

      await client.query('COMMIT');
      return newBatch;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _splitMedicalSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _splitMedicineSupply: async (_, { batchId, input }, { res }) => {
    if (input.quantity <= 0) {
      throwGraphQLError(res).message("Quantity to split must be positive").status(400).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const source = await client.query(
        `SELECT * FROM "MedicineBatch" WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [batchId],
      );

      if (source.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
      }

      const batch = source.rows[0];

      if (batch.location === input.targetLocation) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Target location must differ from source").status(400).throw();
      }

      // Get count of available (unassigned) entities in the batch
      const availableResult = await client.query(
        `SELECT COUNT(*)::int AS available_count FROM "MedicineEntity" WHERE "batchId" = $1 AND "transactionId" IS NULL`,
        [batchId],
      );

      const availableCount = availableResult.rows[0].available_count;

      if (availableCount < input.quantity) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Insufficient available quantity to split").status(400).throw();
      }
      // Create new batch at target location
      const sql = `
        INSERT INTO "MedicineBatch"
          ("medicalItemId", "supplierName", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location, "receivedBy", notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, current_timestamp, current_timestamp)
        RETURNING *
      `;

      const result = await client.query(sql, [
        batch.medicalItemId, batch.supplierName, batch.batchNumber,
        batch.dosageUnit, batch.dosageValue, batch.expiryDate,
        input.targetLocation, batch.receivedBy, input.notes || batch.notes,
      ]);

      const newBatch = result.rows[0];

      // Move specified quantity of entities to new batch
      const updateResult = await client.query(
        `UPDATE "MedicineEntity" SET "batchId" = $1 WHERE id IN (
          SELECT id FROM "MedicineEntity" WHERE "batchId" = $2 AND "transactionId" IS NULL LIMIT $3
        )`,
        [newBatch.id, batchId, input.quantity],
      );

      // Verify actual moved count matches requested
      if (updateResult.rowCount !== input.quantity) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message(`Failed to move exact quantity. Expected ${input.quantity}, moved ${updateResult.rowCount}`)
          .status(409)
          .throw();
      }

      await client.query('COMMIT');
      return newBatch;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _splitMedicineSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateMedicalSupply: async (_, { batchId, input }, { res }) => {
    const params = [];
    const sets = [];

    if (input.expiryDate !== undefined) sets.push(`"expiryDate" = $${params.push(input.expiryDate)}`);
    if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    sets.push(`"updated_at" = current_timestamp`);
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

    if (input.expiryDate !== undefined) sets.push(`"expiryDate" = $${params.push(input.expiryDate)}`);
    if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

    if (sets.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    sets.push(`"updated_at" = current_timestamp`);
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
