const logger = require("../../../utils/logger.js");

const db = require("../../../config/query.js");

// Generic delete helper
async function deleteRecord(tableName, field, id, clientdb = null) {
  let client = clientdb ? clientdb : await db.db();
  try {
    const result = await client.query(
      `DELETE FROM "${tableName}"
       WHERE "${field}" = $1
       RETURNING *;`,
      [id]
    );
    if (result.rows.length === 0) {
      return { success: false, reason: 'NOT_FOUND', detail: `No record with id ${id}` };
    }

    return { success: true, record: result.rows[0] };
  } catch (err) {
    logger.error(`DB DELETE ERROR in ${tableName}:`, err);
    throw err;
  }
}

async function VisualAcuityRecord(id, clientdb = null) {
  return deleteRecord("VisualAcuityRecord", "id", id, clientdb);
}


async function MedicalCondition(id, clientdb = null) { 
  return deleteRecord("MedicalCondition", "medicalHistoryId", id, clientdb);
}

async function MedicationRecord(id, clientdb = null) {
  return deleteRecord("MedicationRecord", "medicationId",id, clientdb);
}

async function HospitalizationRecord(id, clientdb = null) {
  return deleteRecord("HospitalizationRecord", "hospitalizationId", id, clientdb);
}

async function OperationRecord(id, clientdb = null) {
  return deleteRecord("OperationRecord", "operationId", id, clientdb);
}

async function ImmunizationRecord(id, clientdb = null) {
  return deleteRecord("ImmunizationRecord", "immunizationId", id, clientdb);
}

async function DentalProcedureRecord(id, clientdb = null) {
  return deleteRecord("DentalProcedureRecord", "dentalProcedureId", id, clientdb);
}

async function AllergyRecord(id, clientdb = null) {
  return deleteRecord("AllergyRecord", "allergyId", id, clientdb);
}

async function OralApplianceRecord(id, clientdb = null) {
  return deleteRecord("OralApplianceRecord", "applianceId", id, clientdb);
}

module.exports = {
  VisualAcuityRecord, MedicalCondition, HospitalizationRecord,
  OperationRecord, ImmunizationRecord, DentalProcedureRecord,
  MedicationRecord, AllergyRecord, OralApplianceRecord
};