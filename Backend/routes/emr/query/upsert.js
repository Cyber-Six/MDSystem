const { generateDomainCode, normalizeName, normalizeNumber } = require("../../../utils/validator.js");
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
      ("contactName", "relationship", "contactNumber", "isverified", "created_at")
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

async function upsertAllergenCatalog(input) {
  const existing = await query(
    `SELECT * FROM "AllergenCatalog" WHERE "allergen" = $1`,
    [input.allergen]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await query(
    `INSERT INTO "AllergenCatalog"
      ("type", "allergen")
     VALUES ($1, $2)
     RETURNING *;`,
    [
      input.type,
      input.allergen
    ]
  );

  return result.rows[0];
}


async function upsertDomainCatalog(input, domain) {
  const normalizedName = normalizeName(input.name);

  // Check if record already exists by name + domain
  const existing = await query(
    `SELECT * FROM "DomainTypeCatalog" 
     WHERE "name" = $1 AND "domain" = $2 LIMIT 1;`,
    [normalizedName, domain]
  );

  if (existing.rows.length > 0) {
    // Reuse existing record
    return existing.rows[0];
  }

  // Otherwise insert new
  const result = await query(
    `INSERT INTO "DomainTypeCatalog"
      ("domain", "code", "name", "description", "isValid", "created_at")
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *;`,
    [
      domain,
      generateDomainCode(normalizedName, domain), // helper to ensure unique code
      normalizedName,
      input.description || null,
      input.isValid || false
    ]
  );

  return result.rows[0];
}

module.exports = {
    upsertAllergenCatalog,
    upsertDomainCatalog,
    upsertEmergencyNumber
};