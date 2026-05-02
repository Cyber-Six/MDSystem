const logger = require("../../../utils/logger.js");

const db = require("../../../config/query.js");

// ✅ Generic query wrapper
// Generic helper
async function queryAnchor(tableName, id, notes, clientdb = null) {
  let queryText, values;
  let client = clientdb ? clientdb : await db.db();

  if (notes) {
    queryText = `
      INSERT INTO "${tableName}" ("id", "notes")
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE
        SET "notes" = EXCLUDED."notes"
      RETURNING *;
    `;
    values = [id, notes];
  } else {
    queryText = `
      INSERT INTO "${tableName}" ("id")
      VALUES ($1)
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;
    values = [id];
  }

  const result = await client.query(queryText, values);
  return result.rows[0];
}

async function VisualAcuity(id, notes, clientdb = null) {
  return queryAnchor("VisualAcuity", id, notes, clientdb);
}

async function MaintenanceMedication(id, notes, clientdb = null) {
  return queryAnchor("MaintenanceMedication", id, notes, clientdb);
}

async function MedicalHistory (id, notes, clientdb = null) {
  return queryAnchor("MedicalHistory", id, notes, clientdb);
}

async function Hospitalization(id, notes, clientdb = null) {
  return queryAnchor("Hospitalization", id, notes, clientdb);
}

async function Operation(id, notes, clientdb = null) {
  return queryAnchor("Operation", id, notes, clientdb);
}

async function Immunization(id, notes, clientdb = null) {
  return queryAnchor("Immunization", id, notes, clientdb);
}

async function DentalProcedure(id, notes, clientdb = null) {
  return queryAnchor("DentalProcedure", id, notes, clientdb);
}

async function Allergy(id, notes, clientdb = null) {
  return queryAnchor("Allergy", id, notes, clientdb);
}

async function OralAppliance(id, notes, clientdb = null) {
  return queryAnchor("OralAppliance", id, notes, clientdb);
}

async function DentalRecord(id, notes, clientdb = null) {
  return queryAnchor("DentalRecord", id, notes, clientdb);
}

module.exports = {
  VisualAcuity, MedicalHistory, Hospitalization,
  Operation, Immunization, DentalProcedure,
  MaintenanceMedication, Allergy,
  OralAppliance, DentalRecord

};