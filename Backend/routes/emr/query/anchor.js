const logger = require("../../../utils/logger.js");

const { query } = require("../../../config/query.js");

// ✅ Generic query wrapper
// Generic helper
async function queryAnchor(tableName, id, notes) {
  let queryText, values;

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

  const result = await query(queryText, values);
  return result.rows[0];
}

async function VisualAcuity(id, notes) {
  return queryAnchor("VisualAcuity", id, notes);
}

async function MaintenanceMedication(id, notes) {
  return queryAnchor("MaintenanceMedication", id, notes);
}

async function MedicalHistory (id, notes) {
  return queryAnchor("MedicalHistory", id, notes);}

async function Hospitalization(id, notes) {
  return queryAnchor("Hospitalization", id, notes);
}

async function Operation(id, notes) {
  return queryAnchor("Operation", id, notes);
}

async function Immunization(id, notes) {
  return queryAnchor("Immunization", id, notes);
}

async function DentalProcedure(id, notes) {
  return queryAnchor("DentalProcedure", id, notes);
}

async function Allergy(id, notes) {
  return queryAnchor("Allergy", id, notes);
}

async function OralAppliance(id, notes) {
  return queryAnchor("OralAppliance", id, notes);
}

async function DentalRecord(id, notes) {
  return queryAnchor("DentalRecord", id, notes);
}

module.exports = {
  VisualAcuity, MedicalHistory, Hospitalization,
  Operation, Immunization, DentalProcedure,
  MaintenanceMedication, Allergy,
  OralAppliance, DentalRecord

};