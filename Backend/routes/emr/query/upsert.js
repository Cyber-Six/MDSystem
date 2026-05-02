const { normalizeName, normalizeNumber } = require("../../../utils/validator.js");
const logger = require("../../../utils/logger.js");

const db = require("../../../config/query.js");

// ✅ Generic query wrapper

async function upsertEmergencyNumber(input, clientdb = null) {
  const normalizedName = normalizeName(input.contactName);
  const normalizedNumber = normalizeNumber(input.contactNumber);
  
  let client = clientdb ? clientdb : await db.db();
  // Check if number already exists
  const existing = await client.query(
    `SELECT * FROM "EmergencyNumber" WHERE "contactNumber" = $1 AND "contactName" = $2 AND "address" = $3;`,
    [normalizedNumber, normalizedName, input.address || null]
  );

  if (existing.rows.length > 0) {
    // Reuse existing record
    return existing.rows[0];
  }

  // Otherwise insert new
  const result = await client.query(
    `INSERT INTO "EmergencyNumber"
      ("contactName", "relationship", "contactNumber", address, "isVerified", "created_at")
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *;`,
    [
      normalizedName,
      input.relationship.trim(),
      normalizedNumber,
      input.address || null,
      input.isVerified || false
    ]
  );

  return result.rows[0];
}

module.exports = {
    upsertEmergencyNumber
};