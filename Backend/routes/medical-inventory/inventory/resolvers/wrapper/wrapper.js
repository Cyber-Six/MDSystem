const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { validateItemActive } = require("./helper.js");
const logger = require("../../../../../utils/logger.js");
const { bool } = require("joi");
const { emitToRole } = require("../../../../../config/sockets");

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
  _createMedicalItems: async (_, { input }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      await db.setSystemAuditLog({
        eventType: "INVENTORY_CREATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: result.rows[0].id,
        action: "CREATE_MEDICAL_ITEM",
        details: JSON.stringify({ itemId: result.rows[0].id, itemCode: input.item_code }),
        changedBy: "Medical"
      });
    } catch (err) {
      if (err.code === '23505') {
        throwGraphQLError(res).message("Item code already exists").status(409).throw();
      }
      logger.error("Error in _createMedicalItems:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _updateMedicalItems: async (_, { id, input }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      await db.setSystemAuditLog({
        eventType: "INVENTORY_UPDATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: parseInt(id),
        action: "UPDATE_MEDICAL_ITEM",
        details: JSON.stringify({ itemId: parseInt(id), updatedFields: input }),
        changedBy: "Medical"
      });

      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throwGraphQLError(res).message("Item code already exists").status(409).throw();
      }
      logger.error("Error in _updateMedicalItems:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _deleteMedicalItems: async (_, { id }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

    await db.setSystemAuditLog({
      eventType: "INVENTORY_DELETE",
      actorId: user.id,
      actorType: "Staff",
      targetId: parseInt(id),
      action: "DELETE_MEDICAL_ITEM",
      details: JSON.stringify({ itemId: parseInt(id) }),
      changedBy: "Medical"
    });

    return true;
  },

  _addMedicalSupply: async (_, { input, receivedBy }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      try {
        const itemRow = await db.query(`SELECT item_name FROM "MedicalItems" WHERE id = $1`, [input.medicalItemId]);
        const itemName = itemRow.rows[0]?.item_name ?? 'Unknown';
        emitToRole('medical', 'inventory:stock-changed', {
          action: 'restock',
          itemId: input.medicalItemId,
          itemName,
          batchId: batch.id,
          location: batch.location,
          quantityAdded: quantity,
          summary: `${itemName} restocked: +${quantity} unit${quantity !== 1 ? 's' : ''} at ${batch.location}`,
        });
      } catch (emitErr) {
        logger.warn('[INVENTORY] Failed to emit inventory:stock-changed:', emitErr.message);
      }

      await db.setSystemAuditLog({
        eventType: "INVENTORY_CREATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: batch.id,
        action: "CREATE_MEDICAL_SUPPLY",
        details: JSON.stringify({ batchId: batch.id, itemId: input.medicalItemId }),
        changedBy: "Medical"
      });

      return batch;
    } catch (err) {
      logger.error("Error in _addMedicalSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _addSupplyBatch: async (_, { input, receivedBy }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      try {
        const itemRow = await db.query(`SELECT item_name FROM "MedicalItems" WHERE id = $1`, [input.supplyItemId]);
        const itemName = itemRow.rows[0]?.item_name ?? 'Unknown';
        emitToRole('medical', 'inventory:stock-changed', {
          action: 'restock',
          itemId: input.supplyItemId,
          itemName,
          batchId: batch.id,
          location: batch.location,
          quantityAdded: quantity,
          summary: `${itemName} restocked: +${quantity} unit${quantity !== 1 ? 's' : ''} at ${batch.location}`,
        });
      } catch (emitErr) {
        logger.warn('[INVENTORY] Failed to emit inventory:stock-changed:', emitErr.message);
      }

      await db.setSystemAuditLog({
        eventType: "INVENTORY_CREATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: batch.id,
        action: "CREATE_SUPPLY_BATCH",
        details: JSON.stringify({ batchId: batch.id, itemId: input.supplyItemId }),
        changedBy: "Medical"
      });

      return batch;
    } catch (err) {
      logger.error("Error in _addSupplyBatch:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _splitMedicalSupply: async (_, { batchId, input }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      await db.setSystemAuditLog({
        eventType: "INVENTORY_UPDATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: newBatch.id,
        action: "SPLIT_SUPPLY_BATCH",
        details: JSON.stringify({
          sourceBatchId: batchId,
          newBatchId: newBatch.id,
          quantityMoved: input.quantity,
          sourceLocation: batch.location,
          targetLocation: newBatch.location
        }),
        changedBy: "Medical"
      });

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

  _splitMedicineSupply: async (_, { batchId, input }, { res, user }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

      await db.setSystemAuditLog({
        eventType: "INVENTORY_UPDATE",
        actorId: user.id,
        actorType: "Staff",
        targetId: newBatch.id,
        action: "SPLIT_MEDICINE_BATCH",
        details: JSON.stringify({
          sourceBatchId: batchId,
          newBatchId: newBatch.id,
          quantityMoved: input.quantity,
          sourceLocation: batch.location,
          targetLocation: newBatch.location
        }),
        changedBy: "Medical"
      });      

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

  _updateMedicalSupply: async (_, { batchId, input }, { res, user }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the batch row to prevent concurrent updates
      const batchResult = await client.query(
        `SELECT "expiryDate", notes FROM "MedicineBatch" WHERE id = $1 FOR UPDATE`,
        [batchId]
      );

      if (batchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
      }

      const oldValues = batchResult.rows[0];

      // Get old quantity count with lock
      const oldQtyResult = await client.query(
        `SELECT COUNT(*)::int AS count
          FROM (
            SELECT 1
            FROM "MedicineEntity"
            WHERE "batchId" = $1 AND "transactionId" IS NULL
            FOR UPDATE
          ) sub;
          `,
        [batchId]
      );
      const oldQuantity = oldQtyResult.rows[0]?.count || 0;

      const params = [];
      const sets = [];

      if (input.expiryDate !== undefined) sets.push(`"expiryDate" = $${params.push(input.expiryDate)}`);
      if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

      if (sets.length === 0 && input.currentQuantity === undefined) {
        await client.query('ROLLBACK');
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

      const result = await client.query(sql, params);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Medicine batch not found").status(404).throw();
      }

      const newValues = result.rows[0];
      let newQuantity = oldQuantity;

      // Handle quantity changes (add or remove MedicineEntity records) - atomic within transaction
      if (input.currentQuantity !== undefined) {
        const quantityDiff = input.currentQuantity - oldQuantity;

        if (quantityDiff > 0) {
          // Add new MedicineEntity records
          const placeholders = Array(quantityDiff).fill('($1)').join(', ');
          await client.query(
            `INSERT INTO "MedicineEntity" ("batchId") VALUES ${placeholders}`,
            [batchId]
          );
        } else if (quantityDiff < 0) {
          // Remove unused MedicineEntity records
          const toDelete = Math.abs(quantityDiff);
          await client.query(
            `DELETE FROM "MedicineEntity"
             WHERE ctid IN (
               SELECT ctid
               FROM "MedicineEntity"
               WHERE "batchId" = $1 AND "transactionId" IS NULL
               LIMIT $2
             )`,
            [batchId, toDelete]
          );
        }
        newQuantity = input.currentQuantity;
      }

      // Log to SystemAuditLog
      if (user && user.id) {
        await db.setSystemAuditLog({
          eventType: "INVENTORY_UPDATE",
          actorId: user.id,
          actorType: "Staff",
          targetId: parseInt(batchId),
          action: "UPDATE_MEDICINE_BATCH",
          details: JSON.stringify({
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            oldExpiryDate: oldValues.expiryDate,
            newExpiryDate: newValues.expiryDate,
            oldNotes: oldValues.notes,
            newNotes: newValues.notes
          }),
          changedBy: "Medical"
        });
      }

      await client.query('COMMIT');

      if (input.currentQuantity !== undefined) {
        try {
          emitToRole('medical', 'inventory:stock-changed', {
            action: 'adjust',
            batchId: parseInt(batchId),
            quantityBefore: oldQuantity,
            quantityAfter: newQuantity,
            summary: `Stock adjusted: ${oldQuantity} → ${newQuantity} unit${newQuantity !== 1 ? 's' : ''} (batch #${batchId})`,
          });
        } catch (emitErr) {
          logger.warn('[INVENTORY] Failed to emit inventory:stock-changed:', emitErr.message);
        }
      }

      return newValues;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _updateMedicalSupply:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateSupplyBatch: async (_, { batchId, input }, { res, user }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the batch row to prevent concurrent updates
      const batchResult = await client.query(
        `SELECT "expiryDate", notes FROM "SupplyBatch" WHERE id = $1 FOR UPDATE`,
        [batchId]
      );

      if (batchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Supply batch not found").status(404).throw();
      }

      const oldValues = batchResult.rows[0];

      // Fetch real current quantity from entity rows while locking those rows.
      // PostgreSQL does not allow FOR UPDATE directly on aggregate queries.
      const oldQtyResult = await client.query(
        `SELECT COUNT(*)::int AS count
           FROM (
             SELECT 1
             FROM "SupplyEntity"
             WHERE "batchId" = $1 AND "transactionId" IS NULL
             FOR UPDATE
           ) sub;`,
        [batchId]
      );
      const oldQuantity = oldQtyResult.rows[0]?.count || 0;

      const params = [];
      const sets = [];

      if (input.expiryDate !== undefined) sets.push(`"expiryDate" = $${params.push(input.expiryDate)}`);
      if (input.notes !== undefined) sets.push(`notes = $${params.push(input.notes)}`);

      if (sets.length === 0 && input.currentQuantity === undefined) {
        await client.query('ROLLBACK');
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

      const result = await client.query(sql, params);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Supply batch not found").status(404).throw();
      }

      const newValues = result.rows[0];
      let newQuantity = oldQuantity;

      // Adjust quantity by inserting or deleting SupplyEntity rows (atomic within transaction)
      if (input.currentQuantity !== undefined) {
        const quantityDiff = input.currentQuantity - oldQuantity;

        if (quantityDiff > 0) {
          const placeholders = Array(quantityDiff).fill('($1)').join(', ');
          await client.query(
            `INSERT INTO "SupplyEntity" ("batchId") VALUES ${placeholders}`,
            [batchId]
          );
        } else if (quantityDiff < 0) {
          const toDelete = Math.abs(quantityDiff);
          await client.query(
            `DELETE FROM "SupplyEntity"
             WHERE ctid IN (
               SELECT ctid FROM "SupplyEntity"
               WHERE "batchId" = $1 AND "transactionId" IS NULL
               LIMIT $2
             )`,
            [batchId, toDelete]
          );
        }
        newQuantity = input.currentQuantity;
      }

      // Log to SystemAuditLog
      if (user && user.id) {
        await db.setSystemAuditLog({
          eventType: "INVENTORY_UPDATE",
          actorId: user.id,
          actorType: "Staff",
          targetId: parseInt(batchId),
          action: "UPDATE_SUPPLY_BATCH",
          details: JSON.stringify({
            oldQuantity,
            newQuantity,
            oldExpiryDate: oldValues.expiryDate,
            newExpiryDate: newValues.expiryDate,
            oldNotes: oldValues.notes,
            newNotes: newValues.notes
          }),
          changedBy: "Medical"
        });
      }

      await client.query('COMMIT');

      if (input.currentQuantity !== undefined) {
        try {
          emitToRole('medical', 'inventory:stock-changed', {
            action: 'adjust',
            batchId: parseInt(batchId),
            quantityBefore: oldQuantity,
            quantityAfter: newQuantity,
            summary: `Stock adjusted: ${oldQuantity} → ${newQuantity} unit${newQuantity !== 1 ? 's' : ''} (batch #${batchId})`,
          });
        } catch (emitErr) {
          logger.warn('[INVENTORY] Failed to emit inventory:stock-changed:', emitErr.message);
        }
      }

      return { ...newValues, currentQuantity: newQuantity };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _updateSupplyBatch:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },
};

module.exports = { Query, Mutation };
