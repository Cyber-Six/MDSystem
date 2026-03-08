const logger = require('../utils/logger.js');
const db = require('../config/db.js');
const permissions = {
  is_admin: "IS_ADMIN",
  is_staff: "IS_STAFF",
  privileged_to_perform_on_superior: "PRIVILEGED_TO_PERFORM_ON_SUPERIOR",

  emr_allow_approval: "ALLOW_TO_APPROVE_EMR",
  emr_allow_edit: "ALLOW_TO_EDIT_EMR",
  emr_allow_view: "ALLOW_TO_VIEW_EMR",
  emr_allow_set_dental_record: "ALLOW_TO_SET_DENTAL_RECORD",
  emr_allow_edit_catalogs: "ALLOW_TO_EDIT_CATALOGS",

  profile_allow_approval: "ALLOW_TO_APPROVE_PROFILE",
  profile_allow_view: "ALLOW_TO_VIEW_PROFILE",
  profile_allow_edit: "ALLOW_TO_EDIT_PROFILE",
  profile_allow_update_email_identifier: "ALLOW_TO_UPDATE_EMAIL_IDENTIFIER",

  appointment_allow_approval: "ALLOW_TO_APPROVE_APPOINTMENT",
  appointment_allow_view_records: "ALLOW_TO_VIEW_APPOINTMENT",
  appointment_allow_view_configuration: "ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION",
  appointment_allow_edit_configuration: "ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION",

  announcement_allow_crud: "ALLOW_TO_CRUD_ANNOUNCEMENT",
  
  consultation_allow_view: "ALLOW_TO_VIEW_CONSULTATION",
  consultation_allow_edit: "ALLOW_TO_EDIT_CONSULTATION",

  inventory_allow_view: "ALLOW_TO_VIEW_INVENTORY",
  inventory_allow_edit: "ALLOW_TO_EDIT_INVENTORY",
  inventory_allow_manage_requests: "ALLOW_TO_MANAGE_MEDICINE_REQUESTS",
  inventory_allow_prescribe: "ALLOW_TO_PRESCRIBE",

};

async function getMedicalpermits(personnelId) {
  const result = await db.query(
    `SELECT rt.label, rm.branch FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1;`,
    [personnelId]
  );
  return result.rows;
}

async function findMedicalPermit(personnelId, label) {
  const result = await db.query(
    `SELECT 1 FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1 AND rt.label = $2
     LIMIT 1;`,
    [personnelId, label]
  );
  return result.rows.length > 0;
}

async function setMedicalPermit({ personnelId, assignedBy, roledata = [] }) {
  // Validate labels before hitting the DB
  for (const role of roledata) {
    if (!Object.values(permissions).includes(role.label)) {
      logger.error(`❌ Invalid role label attempted: ${role.label}`);
      throw new Error(`Invalid role label: ${role.label}`);
    }
  }

  // Build VALUES placeholders: ($1, $2), ($3, $4), ...
  const values = [];
  const params = [personnelId, assignedBy]; // fixed params first
  let i = params.length + 1;

  for (const { label, branch } of roledata) {
    values.push(`($${i}, $${i + 1})`);
    params.push(label, branch);
    i += 2;
  }

  const result = await db.query(
    `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
     SELECT $1, r.id, v.branch, $2
     FROM (VALUES ${values.join(",")}) AS v(label, branch)
     JOIN "rolesTable" r ON r.label = v.label
     ON CONFLICT ("personnelId", "rolesId") DO UPDATE
       SET branch = EXCLUDED.branch,
           "assignedBy" = EXCLUDED."assignedBy"
     RETURNING *;`,
    params
  );

  return result.rows;
}

async function unsetMedicalPermit({ personnelId, labels = [] }) {
  const result = await db.query(
    `DELETE FROM "rolesMap" rm
     USING "rolesTable" rt
     WHERE rm."rolesId" = rt.id
       AND rm."personnelId" = $1
       AND rt.label = ANY($2)
     RETURNING *;`,
    [personnelId, labels] // labels is an array of strings
  );

  return result.rows; // all deleted records
}


async function clearMedicalPermits(personnelId) {
  const result = await db.query(
    `DELETE FROM "rolesMap"
     WHERE "personnelId" = $1
     RETURNING *;`,
    [personnelId]
  );
  return result.rows;
}

async function isMedicalPermitted(userId, label, patientId) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permission ${label}${patientId ? ` with patient context ${patientId}` : ""}`);
    return true;
  } // Admin bypass

  let result;

  if (patientId) {
    // Case: patientId provided → join against patient branch
    result = await db.query(
      `SELECT uc.identity
       FROM "rolesMap" rm
       JOIN "rolesTable" rt ON rm."rolesId" = rt.id
       JOIN "UsersPersonal" up ON up.id = $3
       JOIN "UserCredentials" uc ON uc.id = up.id
       WHERE rm."personnelId" = $1
         AND rt.label = $2
         AND (
           up.branch = 'Both'
           OR rm.branch = up.branch
           OR rm.branch = 'Both'
         )
       LIMIT 1;`,
      [userId, label, patientId]
    );
  } else {
    // Case: patientId null → skip patient join, only check role/branch
    result = await db.query(
      `SELECT uc.identity
       FROM "rolesMap" rm
       JOIN "rolesTable" rt ON rm."rolesId" = rt.id
       WHERE rm."personnelId" = $1
         AND rt.label = $2
       LIMIT 1;`,
      [userId, label]
    );
  }

  if (result.rows.length === 0) {
    console.log("userId, label, patientId", userId, label, patientId);
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without ${label} permission${patientId ? ` on patient ${patientId}` : ""}`
    );
    return false;
  }

  // If patient is Superior, staff must have privileged permit
  const { identity } = result.rows[0];
  if (identity === "Superior" && patientId) {
    const permitted = await findMedicalPermit(
      userId,
      permissions.privileged_to_perform_on_superior
    );
    if (!permitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${userId} lacking superior privileges for ${label} on patient ${patientId}`
      );
      return false;
    }
  }

  return true;
}

module.exports = { setMedicalPermit, unsetMedicalPermit, isMedicalPermitted,
  clearMedicalPermits, getMedicalpermits, permissions };