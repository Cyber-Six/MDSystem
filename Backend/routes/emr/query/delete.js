const logger = require("../../../utils/logger.js");

const { query } = require("../../../config/query.js");

// Generic delete helper
async function deleteRecord(tableName, field, id) {
  try {
    const result = await query(
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

async function VisualAcuityRecord(id) {
  return deleteRecord("VisualAcuityRecord", "id", id);
}


async function MedicalCondition(id) { 
  return deleteRecord("MedicalCondition", "medicalHistoryId", id);
}

async function MedicationRecord(id) {
  return deleteRecord("MedicationRecord", "medicationId",id);
}

async function HospitalizationRecord(id) {
  return deleteRecord("HospitalizationRecord", "hospitalizationId", id);
}

async function OperationRecord(id) {
  return deleteRecord("OperationRecord", "operationId", id);
}

async function ImmunizationRecord(id) {
  return deleteRecord("ImmunizationRecord", "immunizationId", id);
}

async function DentalProcedureRecord(id) {
  return deleteRecord("DentalProcedureRecord", "dentalProcedureId", id);
}

async function AllergyRecord(id) {
  return deleteRecord("AllergyRecord", "allergyId", id);
}

async function OralApplianceRecord(id) {
  return deleteRecord("OralApplianceRecord", "applianceId", id);
}

module.exports = {
  VisualAcuityRecord, MedicalCondition, HospitalizationRecord,
  OperationRecord, ImmunizationRecord, DentalProcedureRecord,
  MedicationRecord, AllergyRecord, OralApplianceRecord
};