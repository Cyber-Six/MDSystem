const { normalizeName, normalizeNumber } = require("../../../utils/validator.js");
const logger = require("../../../utils/logger.js");

const { query } = require("../../../config/query.js");

// ✅ Generic query wrapper

async function upsertEmergencyNumber(input) {
  const normalizedName = normalizeName(input.contactName);
  const normalizedNumber = normalizeNumber(input.contactNumber);
  // Check if number already exists
  const existing = await query(
    `SELECT * FROM "EmergencyNumber" WHERE "contactNumber" = $1`,
    [normalizedNumber]
  );

  if (existing.rows.length > 0) {
    // Reuse existing record
    return existing.rows[0];
  }
  console.log("fdd", input);
  // Otherwise insert new
  const result = await query(
    `INSERT INTO "EmergencyNumber"
      ("contactName", "relationship", "contactNumber", "isVerified", "created_at")
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *;`,
    [
      normalizedName,
      input.relationship.trim(),
      normalizedNumber,
      input.isVerified || false
    ]
  );

  return result.rows[0];
}

module.exports = {
    upsertEmergencyNumber
};