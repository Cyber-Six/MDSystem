const db  = require("../../../../../config/query.js");

const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const logger = require("../../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

async function getLatestOutcome(consultationId) {
  const query = `
    SELECT *
    FROM "ConsultationOutcome"
    WHERE "consultationId" = $1
    ORDER BY "recordedAt" DESC
    LIMIT 1;
  `;

  const result = await db.query(query, [consultationId]);
  return result.rows[0] || null;  
}

async function getOutcomeData(table, outcomeId, offset = 0, limit = 10) {
  try {
    const result = await db.query(`
      SELECT *
      FROM "${table}"
      WHERE "outcomeId" = $1
      ORDER BY id ASC
      OFFSET $2
      LIMIT $3;
    `, [outcomeId, offset, limit]);
    return result.rows;
  } catch (error) {
    logger.error(`Error fetching ${table}: ${error.message}`);
    throwGraphQLError(res).message(`Failed to fetch ${table}`).status(500).throw();
  }
}

function groupByOutcome(queryResult) {
  const map = {};
  for (const row of queryResult.rows) {
    if (!map[row.outcomeId]) {
      map[row.outcomeId] = [];
    }
    map[row.outcomeId].push(row);
  }
  return map;
}

async function getPatientIdFromConsultationId(ConsultationId) {
  const query = `
    SELECT "patientId"
    FROM "Consultation"
    WHERE id = $1
  `;

  const result = await db.query(query, [ConsultationId]);
  return result.rows[0]?.patientId || null;
}

async function getPatientIdFromOutcomeId(outcomeId) {
  const query = `
    SELECT c."patientId"
    FROM "ConsultationOutcome" co
    JOIN "Consultation" c ON co."consultationId" = c.id
    WHERE co.id = $1
  `;

  const result = await db.query(query, [outcomeId]);
  return result.rows[0]?.patientId || null;
}

module.exports = { getLatestOutcome, getOutcomeData,
  groupByOutcome, getPatientIdFromConsultationId,
  getPatientIdFromOutcomeId };