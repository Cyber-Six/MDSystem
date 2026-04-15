const db  = require("../../../../../config/query.js");
const { getLatestOutcome, getOutcomeData, groupByOutcome } = require("./helper.js");
const { GetIcd, GetTitle, getIcdDetails } = require("../../../../../config/icdapi/icdmain.js");
const { throwGraphQLError, GraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const Query = {
  _getConsultations: async (_, { patientId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const result = await db.query(`
        SELECT *
        FROM "Consultation"
        WHERE "patientId" = $1
        ORDER BY "updatedAt" DESC
        OFFSET $2
        LIMIT $3;
      `, [patientId, offset || 0, limit || 10]);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching consultations: ${error.message}`);
      throwGraphQLError(res).message("Failed to fetch consultations").status(500).throw();
    }
  },

  _getOutcomes: async (_, { consultationId, offset = 0, limit = 10 }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      const outcomeResult = await db.query(`
        SELECT *
        FROM "ConsultationOutcome"
        WHERE "consultationId" = $1
        ORDER BY "recordedAt" DESC
        OFFSET $2
        LIMIT $3;
      `, [consultationId, offset, limit]);

      const outcomes = outcomeResult.rows;
      if (outcomes.length === 0) return [];

      const outcomeIds = outcomes.map(o => o.id);

      const [complaints, peFindings, treatments, diagnoses] = await Promise.all([
        db.query(`SELECT * FROM "ConsultationComplaints" WHERE "outcomeId" = ANY($1);`, [outcomeIds]),
        db.query(`SELECT * FROM "ConsultationPEFindings" WHERE "outcomeId" = ANY($1);`, [outcomeIds]),
        db.query(`SELECT * FROM "ConsultationTreatment" WHERE "outcomeId" = ANY($1);`, [outcomeIds]),
        db.query(`SELECT * FROM "ConsultationDiagnosis" WHERE "outcomeId" = ANY($1);`, [outcomeIds]),
      ]);

      const complaintsMap = groupByOutcome(complaints);
      const peFindingsMap = groupByOutcome(peFindings);
      const treatmentsMap = groupByOutcome(treatments);
      const diagnosesMap = groupByOutcome(diagnoses);

      for (const outcome of outcomes) {
        outcome.complaints = complaintsMap[outcome.id] || [];
        outcome.peFindings = peFindingsMap[outcome.id] || [];
        outcome.treatments = treatmentsMap[outcome.id] || [];
        outcome.diagnoses = diagnosesMap[outcome.id] || [];
      }

      return outcomes;
    } catch (error) {
      logger.error(`Error fetching consultation outcomes: ${error.message}`);
      throwGraphQLError(res).message("Failed to fetch consultation outcomes").status(500).throw();
    }
  },

  _getComplaints: (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return getOutcomeData("ConsultationComplaints", outcomeId, offset, limit);
  },

  _getPEFindings: (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return getOutcomeData("ConsultationPEFindings", outcomeId, offset, limit);
  },

  _getTreatments: (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return getOutcomeData("ConsultationTreatment", outcomeId, offset, limit);
  },

  _getDiagnoses: (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return getOutcomeData("ConsultationDiagnosis", outcomeId, offset, limit);
  },

  _getIcdViaCode: async (_, { code }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await GetTitle(code);
  },
 
  _getIcdViaTitle: async (_, { title }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await GetIcd(title);
  },

  _getIcdDetails: async (_, { id }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await getIcdDetails(id);
    if (!result) {
      throwGraphQLError(res).message("Failed to retrieve ICD details").status(500).throw();
    }
    return result;
  },
};

const Mutation = {
  _createConsultation: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      INSERT INTO "Consultation" ("followUpId", "patientId", "mode", "type", "status", "notes")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

      try {
      const result = await db.query(query, [
        input.followUpId || null,
        input.patientId,
        input.mode,
        input.type,
        "Created",
        input.notes || null
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating consultation: ${error.message}`);
      throwGraphQLError(res).message("Failed to create consultation").status(500).throw();
    }
  },

  _OpenConsultation: async (_, { input, _status }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Validate consultation status before proceeding
    const queryResult = await db.query(`
      SELECT status, "patientId"
      FROM "Consultation"
      WHERE id = $1
      LIMIT 1;
    `, [input.consultationId]);

    if (queryResult.rows.length === 0) {
      throwGraphQLError(res).message("Consultation not found").status(404).throw();
    }

    if (!["Created", "Completed", "Referred", "Monitored"].includes(queryResult.rows[0].status)) {
      throwGraphQLError(res).message("Outcome cannot be created in its consultation status").status(400).throw();
    } // protect against creating consultation outcome when consultation is not yet submitted, as consultation outcome should only be created when consultation is submitted

    const patientId = queryResult.rows[0].patientId;

    // Validate vitalSignsId if provided
    let vitalSignsId = null;
    if (input.vitalSignsId) {
      const vsResult = await db.query(`
        SELECT id, "patientId"
        FROM "VitalSigns"
        WHERE id = $1
        LIMIT 1;
      `, [input.vitalSignsId]);

      if (vsResult.rows.length === 0) {
        throwGraphQLError(res).message("VitalSigns not found").status(404).throw();
      }

      if (vsResult.rows[0].patientId !== patientId) {
        throwGraphQLError(res).message("VitalSigns does not belong to this patient").status(403).throw();
      }
      vitalSignsId = input.vitalSignsId;
    }

    // Validate dentalRecordId if provided
    let dentalRecordId = null;
    if (input.dentalRecordId) {
      const drResult = await db.query(`
        SELECT id, "patientId"
        FROM "DentalRecord"
        WHERE id = $1
        LIMIT 1;
      `, [input.dentalRecordId]);

      if (drResult.rows.length === 0) {
        throwGraphQLError(res).message("DentalRecord not found").status(404).throw();
      }

      if (drResult.rows[0].patientId !== patientId) {
        throwGraphQLError(res).message("DentalRecord does not belong to this patient").status(403).throw();
      }
      dentalRecordId = input.dentalRecordId;
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        UPDATE "Consultation"
        SET status = $1, "updatedAt" = NOW()
        WHERE id = $2;
      `, [_status, input.consultationId]);
      // protect against creating multiple consultation outcomes for the same consultation by setting consultation status to Open when creating the consultation outcome, as consultation with status Open should not have an outcome, and only consultation with status Completed, Referred or Monitored can have an outcome

      const outcomeResult = await client.query(`
        INSERT INTO "ConsultationOutcome" ("consultationId", "vitalSignsId", "dentalRecordId", "recordedBy", "remarks")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `, [
        input.consultationId,
        vitalSignsId,
        dentalRecordId,
        user.id,
        input.remarks || null
      ]);

      const outcomeId = outcomeResult.rows[0].id;

      const complaintsResult = await client.query(`
        INSERT INTO "ConsultationComplaints" ("outcomeId", "complaint")
        SELECT $1, unnest($2::text[]) RETURNING *;
      `, [ outcomeId, input.complaints || [] ]);

      const peFindingsResult = await client.query(`
        INSERT INTO "ConsultationPEFindings" ("outcomeId", "finding")
        SELECT $1, unnest($2::text[]) RETURNING *;
      `, [ outcomeId, input.peFindings || [] ]);

      const treatmentResult = await client.query(`
        INSERT INTO "ConsultationTreatment" ("outcomeId", "treatment")
        SELECT $1, unnest($2::text[]) RETURNING *;
      `, [ outcomeId, input.treatments || [] ]);

      // ✅ Corrected diagnoses insert
      const diagnosisResult = await client.query(`
        INSERT INTO "ConsultationDiagnosis" ("outcomeId", "diagnosisName", "icdId", "diagnosisType", "notes")
        SELECT $1, d."diagnosisName", d."icdId", d."diagnosisType"::"DiagnosisType", d.notes
        FROM jsonb_to_recordset($2::jsonb)
          AS d("diagnosisName" text, "icdId" int, "diagnosisType" text, notes text)
        RETURNING *;
      `, [
        outcomeId,
        JSON.stringify(input.diagnoses)
      ]);

      await client.query("COMMIT");
      return {
        ...outcomeResult.rows[0],
        complaints: complaintsResult.rows,
        peFindings: peFindingsResult.rows,
        treatments: treatmentResult.rows,
        diagnoses: diagnosisResult.rows
      };

    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error creating consultation outcome: ${error.message}`);
      throwGraphQLError(res).message("Failed to create consultation outcome").status(500).throw();
    } finally {
      client.release();
    }
  },

  _submitConsultation: async (_, { consultationId, status }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the consultation and outcome rows
      const queryResult = await client.query(
        `SELECT c.status, co."recordedBy"
         FROM "Consultation" c
         INNER JOIN "ConsultationOutcome" co ON co."consultationId" = c.id
         WHERE c.id = $1
         ORDER BY co."recordedAt" DESC
         LIMIT 1
         FOR UPDATE OF c, co;`,
        [consultationId]
      );

      if (queryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      const currentStatus = queryResult.rows[0].status;
      const recordedBy = queryResult.rows[0].recordedBy;

      // Protect against submitting consultation without an outcome or invalid status
      if (!["Created", "Completed", "Referred", "Monitored"].includes(currentStatus)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation cannot be submitted in its current status").status(400).throw();
      }

      // Protect against other medical personnel submitting the consultation outcome created by another personnel
      if (recordedBy !== Number(user.id)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Only the medical personnel who created the outcome can submit the consultation").status(403).throw();
      }

      const result = await client.query(
        `UPDATE "Consultation"
         SET status = $1
         WHERE id = $2
         RETURNING *;`,
        [status, consultationId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof GraphQLError) {
        throw err; // Re-throw known GraphQL errors without modification  
      }
      logger.error(`Error submitting consultation: ${err.message}`);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateConsultationNotes: async (_, { consultationId, notes }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the consultation row
      const queryResult = await client.query(
        `SELECT status FROM "Consultation" WHERE id = $1 FOR UPDATE;`,
        [consultationId]
      );

      if (queryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      if (["Created", "Completed", "Referred", "Monitored"].includes(queryResult.rows[0].status)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation notes cannot be updated in its current status").status(400).throw();
      }

      const result = await client.query(
        `UPDATE "Consultation"
         SET notes = $1
         WHERE id = $2
         RETURNING *;`,
        [notes, consultationId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating consultation notes: ${error.message}`);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateConsultationFollowUpId: async (_, { consultationId, followUpId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the consultation row
      const queryResult = await client.query(
        `SELECT status FROM "Consultation" WHERE id = $1 FOR UPDATE;`,
        [consultationId]
      );

      if (queryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      if (["Created", "Completed", "Referred", "Monitored"].includes(queryResult.rows[0].status)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation follow-up ID cannot be updated in its current status").status(400).throw();
      }

      const result = await client.query(
        `UPDATE "Consultation"
         SET "followUpId" = $1
         WHERE id = $2
         RETURNING *;`,
        [followUpId, consultationId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Consultation not found").status(404).throw();
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating consultation follow-up ID: ${error.message}`);
      throwGraphQLError(res).message("Database error").status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateOutcomeRemarks: async (_, { consultationId, remarks }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const outcome = await getLatestOutcome(consultationId);
    console.log("Latest outcome for consultation", consultationId, "is", outcome);
    if (!outcome) {
      throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
    }

    else if (outcome.recordedBy !== Number(user.id)) {
      throwGraphQLError(res).message("Only the medical personnel who created the outcome can update the remarks").status(403).throw();
    } // protect against other medical personnel updating the consultation outcome created by another personnel

    try {
      const result = await db.query(`
        UPDATE "ConsultationOutcome"
        SET remarks = $1
        WHERE id = $2
        RETURNING *;
      `, [remarks, outcome.id]);

      if (result.rows.length === 0) {
        throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
      }
      return true;
    } catch (error) {
      logger.error(`Error updating consultation outcome remarks: ${error.message}`);
      throwGraphQLError(res).message("Failed to update consultation outcome remarks").status(500).throw();
    }
  },

  _updateComplaints: async (_, { consultationId, complaints }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const outcome = await getLatestOutcome(consultationId);
    if (!outcome) {
      throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
    }

    else if (outcome.recordedBy !== Number(user.id)) {
      throwGraphQLError(res).message("Only the medical personnel who created the outcome can update the complaints").status(403).throw();
    } // protect against other medical personnel updating the consultation outcome created by another personnel

    const outcomeId = outcome.id;
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        DELETE FROM "ConsultationComplaints"
        WHERE "outcomeId" = $1;
      `, [outcomeId]);

      const result = await client.query(`
        INSERT INTO "ConsultationComplaints" ("outcomeId", "complaint")
        SELECT $1, unnest($2::text[])
        RETURNING *;
      `, [ outcomeId, complaints || [] ]);

      await client.query("COMMIT");

      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error updating complaints: ${error.message}`);
      throwGraphQLError(res).message("Failed to update complaints").status(500).throw();
    } finally {
      client.release();
    }
  },
  
  _updatePEFindings: async (_, { consultationId, findings }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const outcome = await getLatestOutcome(consultationId);
    if (!outcome) {
      throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
    }

    else if (outcome.recordedBy !== Number(user.id)) {
      throwGraphQLError(res).message("Only the medical personnel who created the outcome can update the PE findings").status(403).throw();
    } // protect against other medical personnel updating the consultation outcome created by another personnel

    const outcomeId = outcome.id;
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        DELETE FROM "ConsultationPEFindings"
        WHERE "outcomeId" = $1;
      `, [outcomeId]);

      const result = await client.query(`
        INSERT INTO "ConsultationPEFindings" ("outcomeId", "finding")
        SELECT $1, unnest($2::text[])
        RETURNING *;
      `, [ outcomeId, findings || [] ]);

      await client.query("COMMIT");

      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error updating PE findings: ${error.message}`);
      throwGraphQLError(res).message("Failed to update PE findings").status(500).throw();
    } finally {
      client.release();
    }
  },
  
  _updateTreatments: async (_, { consultationId, treatments }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const outcome = await getLatestOutcome(consultationId);
    if (!outcome) {
      throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
    }

    else if (outcome.recordedBy !== Number(user.id)) {
      throwGraphQLError(res).message("Only the medical personnel who created the outcome can update the treatment").status(403).throw();
    } // protect against other medical personnel updating the consultation outcome created by another personnel

    const outcomeId = outcome.id;
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        DELETE FROM "ConsultationTreatment"
        WHERE "outcomeId" = $1;
      `, [outcomeId]);

      const result = await client.query(`
        INSERT INTO "ConsultationTreatment" ("outcomeId", "treatment")
        SELECT $1, unnest($2::text[])
        RETURNING *;
      `, [ outcomeId, treatments || [] ]);

      await client.query("COMMIT");

      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error updating treatments: ${error.message}`);
      throwGraphQLError(res).message("Failed to update treatments").status(500).throw();
    } finally {
      client.release();
    }
  },
  
  _updateDiagnoses: async (_, { consultationId, diagnoses }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const outcome = await getLatestOutcome(consultationId);
    if (!outcome) {
      throwGraphQLError(res).message("Consultation outcome not found").status(404).throw();
    }

    else if (outcome.recordedBy !== Number(user.id)) {
      throwGraphQLError(res).message("Only the medical personnel who created the outcome can update the diagnosis").status(403).throw();
    } // protect against other medical personnel updating the consultation outcome created by another personnel

    const outcomeId = outcome.id;
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        DELETE FROM "ConsultationDiagnosis"
        WHERE "outcomeId" = $1;
      `, [outcomeId]);

      const result = await client.query(`
        INSERT INTO "ConsultationDiagnosis" ("outcomeId", "diagnosisName", "icdId", "diagnosisType", "notes")
        SELECT $1, d."diagnosisName", d."icdId", d."diagnosisType"::"DiagnosisType", d.notes
        FROM jsonb_to_recordset($2::jsonb)
          AS d("diagnosisName" text, "icdId" int, "diagnosisType" text, notes text)
        RETURNING *;
      `, [
        outcomeId,
        JSON.stringify(diagnoses)
      ]);

      await client.query("COMMIT");

      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error updating diagnoses: ${error.message}`);
      throwGraphQLError(res).message("Failed to update diagnoses").status(500).throw();
    } finally {
      client.release();
    }
  },

};  


module.exports = { Query, Mutation };
