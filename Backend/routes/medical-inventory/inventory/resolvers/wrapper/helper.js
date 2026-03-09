const db = require("../../../../../config/query.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

async function validateItemExists(itemId, res) {
  const result = await db.query(
    'SELECT id, category, active FROM "MedicalItems" WHERE id = $1 LIMIT 1',
    [itemId]
  );
  if (result.rows.length === 0) {
    throwGraphQLError(res).message("Medical item not found").status(404).throw();
  }
  return result.rows[0];
}

async function validateItemActive(itemId, res) {
  const item = await validateItemExists(itemId, res);
  if (!item.active) {
    throwGraphQLError(res).message("Medical item is inactive").status(400).throw();
  }
  return item;
}

module.exports = { validateItemExists, validateItemActive };