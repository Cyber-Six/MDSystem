const db = require("../../../config/query.js");
const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const { permissions, isMedicalPermittedPatientBased } = require("../../../services/permit.js");
const { getPatientIdFromvitalSignsId, getPatientIdFromDentalRecordId } = require("./helper.js");

const Query = {
  // Get all VitalSigns for a patient
  getPatientVitalSigns: async (_, { patientId, limit, offset }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.emr_allow_set_vital_sign, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).status(403).message("Forbidden: insufficient permissions to view this patient's details.").throw();
    }

    const query = `
      SELECT vs.*
      FROM "VitalSigns" vs
      WHERE vs."patientId" = $1
      ORDER BY vs.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      patientId,
      limit || 10,
      offset || 0
    ]);

    logger.debug("Patient VitalSigns Query Result:", result.rows);
    return result.rows;
  },

  // Get all DentalRecords for a patient
  getPatientDentalRecord: async (_, { patientId, limit, offset }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.emr_allow_set_dental_record, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).status(403).message("Forbidden: insufficient permissions to view this patient's details.").throw();
    }

    const query = `
      SELECT dr.*
      FROM "DentalRecord" dr
      WHERE dr."patientId" = $1
      ORDER BY dr.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      patientId,
      limit || 10,
      offset || 0
    ]);

    if (result.rows.length === 0) return [];

    // Fetch tooth placements for each dental record
    for (const row of result.rows) {
      const teethQuery = `
        SELECT tp.id, tp."toothIndex", tp.legend
        FROM "ToothPlacement" tp
        WHERE "dentalRecordId" = $1;
      `;
      const ToothPlacements = await db.query(teethQuery, [row.id]);
      row.ToothPlacements = ToothPlacements.rows;

      // Fetch oral findings for each dental record
      const findingsQuery = `
        SELECT "oralFindingId", status, notes
        FROM "oralFindingRecord"
        WHERE "dentalRecordId" = $1;
      `;
      const oralFindings = await db.query(findingsQuery, [row.id]);
      row.oralFindings = oralFindings.rows;
    }

    logger.debug("Patient DentalRecord Query Result:", result.rows);
    return result.rows;
  },

  // Get specific VitalSigns by ID
  getVitalSignsById: async (_, { id }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const patientId = await getPatientIdFromvitalSignsId(id);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.emr_allow_set_vital_sign, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).status(403).message("Forbidden: insufficient permissions to view this patient's details.").throw();
    }

    const query = `SELECT * FROM "VitalSigns" WHERE id = $1;`;
    const result = await db.query(query, [id]);

    logger.debug("VitalSigns by ID Query Result:", result.rows[0]);
    return result.rows[0] || null;
  },

  // Get specific DentalRecord by ID
  getDentalRecordById: async (_, { id }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const patientId = getPatientIdFromDentalRecordId(id);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.emr_allow_set_dental_record, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).status(403).message("Forbidden: insufficient permissions to view this patient's details.").throw();
    }

    const query = `SELECT * FROM "DentalRecord" WHERE id = $1;`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) return null;

    const record = result.rows[0];

    // Fetch tooth placements
    const teethQuery = `
      SELECT tp.id, tp."toothIndex", tp.legend
      FROM "ToothPlacement" tp
      WHERE "dentalRecordId" = $1;
    `;
    const ToothPlacements = await db.query(teethQuery, [record.id]);
    record.ToothPlacements = ToothPlacements.rows;

    // Fetch oral findings
    const findingsQuery = `
      SELECT "oralFindingId", status, notes
      FROM "oralFindingRecord"
      WHERE "dentalRecordId" = $1;
    `;
    const oralFindings = await db.query(findingsQuery, [record.id]);
    record.oralFindings = oralFindings.rows;

    logger.debug("DentalRecord by ID Query Result:", record);
    return record;
  },

  // Get all OralFindingCatalogs
  getOralFindingCatalogs: async (_, { filterIsValid, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT *
      FROM "oralFindingCatalog"
      WHERE "isActive" = COALESCE($1, "isActive")
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);

    logger.debug("OralFindingCatalogs Query Result:", result.rows);
    return result.rows;
  },
};

module.exports = Query;
