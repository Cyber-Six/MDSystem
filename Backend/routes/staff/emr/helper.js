

const db  = require("../../../config/query.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });


async function getPatientIdFromvitalSignsId(vitalSignsId) {
  const query = `
    SELECT "patientId"
    FROM "VitalSigns"
    WHERE id = $1
  `;

  const result = await db.query(query, [ConsultationId]);
  return result.rows[0]?.patientId || null;
}

async function getPatientIdFromDentalRecordId(dentalRecordId) {
  const query = `
    SELECT "patientId"
    FROM "DentalRecord"
    WHERE id = $1
  `;

  const result = await db.query(query, [dentalRecordId]);
  return result.rows[0]?.patientId || null;
}

module.exports = { getPatientIdFromvitalSignsId, getPatientIdFromDentalRecordId };