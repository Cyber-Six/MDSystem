const db = require("../../../config/query.js");
const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const permit = require("../../../services/permit.js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Configurable update lock duration in hours (default: 24 hours = 1 day)
const UPDATE_LOCK_HOURS = parseInt(process.env.EMR_UPDATE_LOCK_HOURS, 10) || 24;
const UPDATE_LOCK_MS = UPDATE_LOCK_HOURS * 60 * 60 * 1000;

const Mutation = {
  // Create standalone VitalSigns
  createVitalSigns: async (_, { patientId, input }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_set_vital_sign,
      patientId
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to create VitalSigns`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const result = await db.query(
        `INSERT INTO "VitalSigns"
          ("patientId", "height_cm", "weight_kg", "blood_pressure", "heart_rate",
           "temperature", "notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [
          patientId,
          input.height_cm,
          input.weight_kg,
          input.blood_pressure,
          input.heart_rate,
          input.temperature,
          input.notes || null
        ]
      );

      logger.info(`Staff ${user.id} created VitalSigns for patient ${patientId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating VitalSigns:', error);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to create VitalSigns: ${error.message}`)
        .throw();
    }
  },

  // Create standalone DentalRecord
  createDentalRecord: async (_, { patientId, input }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_set_dental_record,
      patientId
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to create DentalRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    let dentalRecordId;

    try {
      await client.query('BEGIN');

      // Insert DentalRecord
      const dentalRecordResult = await db.queryClient(
        client,
        `INSERT INTO "DentalRecord" ("patientId", "notes")
         VALUES ($1, $2)
         RETURNING *;`,
        [patientId, input.notes || null]
      );

      dentalRecordId = dentalRecordResult.rows[0].id;

      // Insert Tooth Placements
      const toothPlacements = [];
      if (input.ToothPlacements?.length) {
        const values = [];
        const params = [];
        input.ToothPlacements.forEach((tooth, i) => {
          const baseIndex = i * 3;
          values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
          params.push(dentalRecordId, tooth.toothIndex, tooth.legend);
        });

        const query = `
          INSERT INTO "ToothPlacement" ("dentalRecordId", "toothIndex", "legend")
          VALUES ${values.join(", ")}
          RETURNING *;
        `;
        const toothPlacementsResult = await db.queryControlledClient(client, query, params);
        toothPlacements.push(...toothPlacementsResult.rows);
        logger.debug("Inserted Tooth Placements:", toothPlacementsResult.rows);
      }

      // Insert Oral Findings
      const oralFindings = [];
      for (const finding of input.oralFindings || []) {
        const resultFinder = await db.queryControlledClient(
          client,
          `INSERT INTO "oralFindingRecord"
            ("dentalRecordId", "oralFindingId", "status", "notes")
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [
            dentalRecordId,
            finding.oralFindingId,
            finding.status,
            finding.notes || null
          ]
        );
        oralFindings.push(resultFinder.rows[0]);
      }

      await client.query('COMMIT');

      logger.info(`Staff ${user.id} created DentalRecord for patient ${patientId}`);

      return {
        ...dentalRecordResult.rows[0],
        ToothPlacements: toothPlacements,
        oralFindings: oralFindings
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error creating DentalRecord:", err);

      if (err.code === '23503') {
        throwGraphQLError(res)
          .status(400)
          .message(`Invalid oralFindingId provided.`)
          .throw();
      }

      throwGraphQLError(res)
        .status(400)
        .message(`Failed to create DentalRecord: ${err.message}`)
        .throw();
    } finally {
      client.release();
    }
  },

  // Update existing VitalSigns (only allowed within 1 day of creation)
  updateVitalSigns: async (_, { id, input }, { user, res }) => {
    // Get the VitalSigns to check patientId and created_at
    const existing = await db.query(
      `SELECT "patientId", created_at FROM "VitalSigns" WHERE id = $1;`,
      [id]
    );

    if (existing.rows.length === 0) {
      throwGraphQLError(res).status(404).message("VitalSigns not found.").throw();
    }

    const record = existing.rows[0];

    const isPermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_set_vital_sign,
      record.patientId
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update VitalSigns`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Check if within configured hours of creation
    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > UPDATE_LOCK_MS) {
      throwGraphQLError(res)
        .status(403)
        .message(`VitalSigns can only be updated within ${UPDATE_LOCK_HOURS} hours of creation.`)
        .throw();
    }

    try {
      // Build dynamic update query
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (input.height_cm !== undefined) {
        updates.push(`"height_cm" = $${paramIndex++}`);
        params.push(input.height_cm);
      }
      if (input.weight_kg !== undefined) {
        updates.push(`"weight_kg" = $${paramIndex++}`);
        params.push(input.weight_kg);
      }
      if (input.blood_pressure !== undefined) {
        updates.push(`"blood_pressure" = $${paramIndex++}`);
        params.push(input.blood_pressure);
      }
      if (input.heart_rate !== undefined) {
        updates.push(`"heart_rate" = $${paramIndex++}`);
        params.push(input.heart_rate);
      }
      if (input.temperature !== undefined) {
        updates.push(`"temperature" = $${paramIndex++}`);
        params.push(input.temperature);
      }
      if (input.notes !== undefined) {
        updates.push(`"notes" = $${paramIndex++}`);
        params.push(input.notes);
      }

      if (updates.length === 0) {
        throwGraphQLError(res)
          .status(400)
          .message("No fields to update.")
          .throw();
      }

      params.push(id);
      const query = `
        UPDATE "VitalSigns"
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;

      const result = await db.query(query, params);
      logger.info(`Staff ${user.id} updated VitalSigns ${id}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating VitalSigns:', error);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to update VitalSigns: ${error.message}`)
        .throw();
    }
  },

  // Update existing DentalRecord (only allowed within 1 day of creation)
  updateDentalRecord: async (_, { id, input }, { user, res }) => {
    // Get the DentalRecord to check patientId and created_at
    const existing = await db.query(
      `SELECT "patientId", created_at FROM "DentalRecord" WHERE id = $1;`,
      [id]
    );

    if (existing.rows.length === 0) {
      throwGraphQLError(res).status(404).message("DentalRecord not found.").throw();
    }

    const record = existing.rows[0];

    // Check if within configured hours of creation
    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > UPDATE_LOCK_MS) {
      throwGraphQLError(res)
        .status(403)
        .message(`DentalRecord can only be updated within ${UPDATE_LOCK_HOURS} hours of creation.`)
        .throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_set_dental_record,
      record.patientId
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DentalRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Update DentalRecord notes
      if (input.notes !== undefined) {
        await db.queryClient(
          client,
          `UPDATE "DentalRecord" SET notes = $1 WHERE id = $2;`,
          [input.notes, id]
        );
      }

      // Delete and re-insert tooth placements if provided
      if (input.ToothPlacements !== undefined) {
        await db.queryClient(client, `DELETE FROM "ToothPlacement" WHERE "dentalRecordId" = $1;`, [id]);

        if (input.ToothPlacements?.length) {
          const values = [];
          const params = [];
          input.ToothPlacements.forEach((tooth, i) => {
            const baseIndex = i * 3;
            values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
            params.push(id, tooth.toothIndex, tooth.legend);
          });

          const query = `
            INSERT INTO "ToothPlacement" ("dentalRecordId", "toothIndex", "legend")
            VALUES ${values.join(", ")}
            RETURNING *;
          `;
          await db.queryControlledClient(client, query, params);
        }
      }

      // Delete and re-insert oral findings if provided
      if (input.oralFindings !== undefined) {
        await db.queryClient(client, `DELETE FROM "oralFindingRecord" WHERE "dentalRecordId" = $1;`, [id]);

        for (const finding of input.oralFindings || []) {
          await db.queryControlledClient(
            client,
            `INSERT INTO "oralFindingRecord"
              ("dentalRecordId", "oralFindingId", "status", "notes")
             VALUES ($1, $2, $3, $4)
             RETURNING *;`,
            [
              id,
              finding.oralFindingId,
              finding.status,
              finding.notes || null
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated record with all related data
      const updatedRecord = await db.query(`SELECT * FROM "DentalRecord" WHERE id = $1;`, [id]);
      const teethQuery = `
        SELECT tp.id, tp."toothIndex", tp.legend
        FROM "ToothPlacement" tp
        WHERE "dentalRecordId" = $1;
      `;
      const ToothPlacements = await db.query(teethQuery, [id]);

      const findingsQuery = `
        SELECT "oralFindingId", status, notes
        FROM "oralFindingRecord"
        WHERE "dentalRecordId" = $1;
      `;
      const oralFindings = await db.query(findingsQuery, [id]);

      logger.info(`Staff ${user.id} updated DentalRecord ${id}`);

      return {
        ...updatedRecord.rows[0],
        ToothPlacements: ToothPlacements.rows,
        oralFindings: oralFindings.rows
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error updating DentalRecord:", err);

      if (err.code === '23503') {
        throwGraphQLError(res)
          .status(400)
          .message(`Invalid oralFindingId provided.`)
          .throw();
      }

      throwGraphQLError(res)
        .status(400)
        .message(`Failed to update DentalRecord: ${err.message}`)
        .throw();
    } finally {
      client.release();
    }
  },

  // Create OralFindingCatalog
  createOralFindingCatalog: async (_, { input }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.emr_allow_edit_catalogs
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to create OralFindingCatalog`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const result = await db.query(
        `INSERT INTO "oralFindingCatalog"
          ("name", "description", "isActive", "created_by", "created_at")
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *;`,
        [
          input.name,
          input.description || null,
          input.isActive !== undefined ? input.isActive : true,
          user.id
        ]
      );

      logger.info(`Staff ${user.id} created OralFindingCatalog ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating OralFindingCatalog:', error);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to create OralFindingCatalog: ${error.message}`)
        .throw();
    }
  },

  // Update OralFindingCatalog
  updateOralFindingCatalog: async (_, { id, input }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.emr_allow_edit_catalogs
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update OralFindingCatalog`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const existing = await db.query(
        `SELECT * FROM "oralFindingCatalog" WHERE id = $1;`,
        [id]
      );

      if (existing.rows.length === 0) {
        throwGraphQLError(res).status(404).message("OralFindingCatalog not found.").throw();
      }

      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (input.name !== undefined) {
        updates.push(`"name" = $${paramIndex++}`);
        params.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push(`"description" = $${paramIndex++}`);
        params.push(input.description);
      }
      if (input.isActive !== undefined) {
        updates.push(`"isActive" = $${paramIndex++}`);
        params.push(input.isActive);
      }

      if (updates.length === 0) {
        throwGraphQLError(res)
          .status(400)
          .message("No fields to update.")
          .throw();
      }

      params.push(id);
      const query = `
        UPDATE "oralFindingCatalog"
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;

      const result = await db.query(query, params);
      logger.info(`Staff ${user.id} updated OralFindingCatalog ${id}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating OralFindingCatalog:', error);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to update OralFindingCatalog: ${error.message}`)
        .throw();
    }
  },

  // Delete OralFindingCatalog
  deleteOralFindingCatalog: async (_, { id }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.emr_allow_edit_catalogs
    );

    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to delete OralFindingCatalog`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const existing = await db.query(
        `SELECT * FROM "oralFindingCatalog" WHERE id = $1;`,
        [id]
      );

      if (existing.rows.length === 0) {
        throwGraphQLError(res).status(404).message("OralFindingCatalog not found.").throw();
      }

      const result = await db.query(
        `DELETE FROM "oralFindingCatalog" WHERE id = $1 RETURNING *;`,
        [id]
      );

      logger.info(`Staff ${user.id} deleted OralFindingCatalog ${id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error deleting OralFindingCatalog:', error);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to delete OralFindingCatalog: ${error.message}`)
        .throw();
    }
  },
};

module.exports = Mutation;
