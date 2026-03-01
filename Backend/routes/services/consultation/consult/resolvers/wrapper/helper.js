const db  = require("../../../../../../config/query.js");

const { throwGraphQLError } = require("../../../../../../utils/graphql-helper.js");
const logger = require("../../../../../../utils/logger.js");
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
module.exports = { getLatestOutcome, getOutcomeData, groupByOutcome };