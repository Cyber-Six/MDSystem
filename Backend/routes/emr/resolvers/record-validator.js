const db  = require("../../../config/query.js");

async function validateMedicalUpdateTicket(id) {
  const result = await db.query(
    `
    SELECT
      CASE WHEN NOT EXISTS (SELECT 1 FROM "MedicalHistory" mh WHERE mh.id = pul.id) THEN 'MedicalHistory' END AS missing_history,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Hospitalization" hp WHERE hp.id = pul.id) THEN 'Hospitalization' END AS missing_hospitalization,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Operation" op WHERE op.id = pul.id) THEN 'Operation' END AS missing_operation,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Immunization" ip WHERE ip.id = pul.id) THEN 'Immunization' END AS missing_immunization,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Allergy" ap WHERE ap.id = pul.id) THEN 'Allergy' END AS missing_allergy,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "MaintenanceMedication" mm WHERE mm.id = pul.id) THEN 'MaintenanceMedication' END AS missing_medication,
      CASE WHEN up.sex = 'Female' AND NOT EXISTS (SELECT 1 FROM "ObGynHistory" oh WHERE oh.id = pul.id) THEN 'ObGynHistory' END AS missing_obgyn,

      CASE WHEN NOT EXISTS (SELECT 1 FROM "Lifestyle" ls WHERE ls.id = pul.id) THEN 'Lifestyle' END AS missing_lifestyle,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "VisualAcuity" va WHERE va.id = pul.id) THEN 'VisualAcuity' END AS missing_visual
    FROM "patientUpdateLog" pul
    LEFT JOIN "UsersPersonal" up ON up.id = pul."patientId"
    WHERE pul.id = $1
    LIMIT 1;
    `,
    [id]
  );

  if (result.rows.length === 0) return ["patientUpdateLog"]; // no ticket at all

  const row = result.rows[0];
  const missing = Object.values(row).filter(v => v !== null);

  return missing; // e.g. ["MedicalHistory", "Immunization"]
}

async function validateDentalUpdateTicket(id) {
  const result = await db.query(
    `
    SELECT
      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalHistory" dh WHERE dh.id = pul.id) THEN 'DentalHistory' END AS missing_dentalhistory,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalPhotoRecord" dp WHERE dp.id = pul.id) THEN 'DentalPhotoRecord' END AS missing_dentalphoto,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "OralAppliance" oap WHERE oap.id = pul.id) THEN 'OralAppliance' END AS missing_oralappliance,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalProcedure" dpp WHERE dpp.id = pul.id) THEN 'DentalProcedure' END AS missing_dentalprocedure
    FROM "patientUpdateLog" pul
    WHERE pul.id = $1
    LIMIT 1;
    `,
    [id]
  );

  if (result.rows.length === 0) return ["patientUpdateLog"]; // no ticket at all

  const row = result.rows[0];
  const missing = Object.values(row).filter(v => v !== null);

  return missing; // e.g. ["DentalPhotoRecord", "DentalRecord"]
}

async function validateAllUpdateTicket(id) {
  const result = await db.query(
    `
    SELECT
      CASE WHEN NOT EXISTS (SELECT 1 FROM "MedicalHistory" mh WHERE mh.id = pul.id) THEN 'MedicalHistory' END AS missing_history,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Hospitalization" hp WHERE hp.id = pul.id) THEN 'Hospitalization' END AS missing_hospitalization,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Operation" op WHERE op.id = pul.id) THEN 'Operation' END AS missing_operation,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Immunization" ip WHERE ip.id = pul.id) THEN 'Immunization' END AS missing_immunization,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "Allergy" ap WHERE ap.id = pul.id) THEN 'Allergy' END AS missing_allergy,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "MaintenanceMedication" mm WHERE mm.id = pul.id) THEN 'MaintenanceMedication' END AS missing_medication,
      CASE WHEN up.sex = 'Female' AND NOT EXISTS (SELECT 1 FROM "ObGynHistory" oh WHERE oh.id = pul.id) THEN 'ObGynHistory' END AS missing_obgyn,

      CASE WHEN NOT EXISTS (SELECT 1 FROM "Lifestyle" ls WHERE ls.id = pul.id) THEN 'Lifestyle' END AS missing_lifestyle,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "VisualAcuity" va WHERE va.id = pul.id) THEN 'VisualAcuity' END AS missing_visual,

      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalHistory" dh WHERE dh.id = pul.id) THEN 'DentalHistory' END AS missing_dentalhistory,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalPhotoRecord" dp WHERE dp.id = pul.id) THEN 'DentalPhotoRecord' END AS missing_dentalphoto,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "OralAppliance" oap WHERE oap.id = pul.id) THEN 'OralAppliance' END AS missing_oralappliance,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "DentalProcedure" dpp WHERE dpp.id = pul.id) THEN 'DentalProcedure' END AS missing_dentalprocedure,

      -- Basic personal-information requirements are enforced for all statuses,
      -- including Inactive users.
      CASE WHEN NOT EXISTS (SELECT 1 FROM "profileRecord" pr WHERE pr.id = pul.id) THEN 'profileRecord' END AS missing_profile,
      CASE WHEN NOT EXISTS (SELECT 1 FROM "EmergencyContact" ec WHERE ec.id = pul.id) THEN 'EmergencyContact' END AS missing_emergencycontact

    FROM "patientUpdateLog" pul
    LEFT JOIN "UsersPersonal" up ON up.id = pul."patientId"

    WHERE pul.id = $1
    LIMIT 1;
    `,
    [id]
  );

  if (result.rows.length === 0) return ["patientUpdateLog"];

  // Collect non-null values into an array
  const row = result.rows[0];
  const missing = Object.values(row).filter(v => v !== null);

  return missing; // e.g. ["VitalSigns", "DentalRecord"]
}

async function validateUpdateTicket(id, scope = "Both") {
  // Dispatch based on scope
  switch (scope) {
    case "Medical":
      return await validateMedicalUpdateTicket(id);
    case "Dental":
      return await validateDentalUpdateTicket(id);
    case "Both":
      return await validateAllUpdateTicket(id);
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}
module.exports = { validateUpdateTicket };