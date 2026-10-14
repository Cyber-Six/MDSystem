const logger = require("../../../utils/logger.js");

const { query } = require("../../../config/query.js");
const { encodeOralApplianceNotes } = require("../custom-choice-storage.js");

// ✅ Generic query wrapper
// Generic helper
async function queryAnchor(tableName, id, notes) {
  let queryText, values;

  if (notes !== undefined) {
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
  return queryAnchor("VisualAcuity", id);
}

async function MaintenanceMedication(id, notes) {
  return queryAnchor("MaintenanceMedication", id, notes);
}

async function MedicalHistory (id, notes) {
  return queryAnchor("MedicalHistory", id);}

async function Hospitalization(id, notes) {
  return queryAnchor("Hospitalization", id);
}

async function Operation(id, notes) {
  return queryAnchor("Operation", id);
}

async function Immunization(id, notes) {
  return queryAnchor("Immunization", id);
}

async function DentalProcedure(id, notes) {
  return queryAnchor("DentalProcedure", id);
}

async function Allergy(id, notes) {
  return queryAnchor("Allergy", id);
}

async function OralAppliance(id, notes, customFields = {}) {
  const storedNotes = encodeOralApplianceNotes(notes, customFields);
  return queryAnchor("OralAppliance", id, storedNotes);
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
