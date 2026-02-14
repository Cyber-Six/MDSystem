const query = require('../config/query.js');
const logger = require('../utils/logger.js');

const permitions = {
  set_as_admin: "SET_AS_ADMIN",
  set_as_staff: "SET_AS_STAFF",

  emr_allow_approval: "ALLOW_TO_APPROVE_EMR",
  emr_allow_edit: "ALLOW_TO_EDIT_EMR",
  emr_allow_view: "ALLOW_TO_VIEW_EMR",
  emr_allow_set_dental_record: "ALLOW_TO_SET_DENTAL_RECORD",
  emr_allow_edit_catalogs: "ALLOW_TO_EDIT_CATALOGS",

  profile_allow_approval: "ALLOW_TO_APPROVE_PROFILE",
  profile_allow_view: "ALLOW_TO_VIEW_PROFILE",
  profile_allow_edit: "ALLOW_TO_EDIT_PROFILE",
  profile_allow_update_email_identifier: "ALLOW_TO_UPDATE_EMAIL_IDENTIFIER",
};

async function getMedicalpermits(personnelId) {
  const result = await query(
    `SELECT rt.label, rm.branch FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm.rolesId = rt.id
     WHERE rm.personnelId = $1;`,
    [personnelId]
  );
  return result.rows;
}

async function setMedicalPermit({ personnelId, assignedBy, roledata = [] }) {
  // Validate labels before hitting the DB
  for (const role of roledata) {
    if (!Object.values(permitions).includes(role.label)) {
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

  const result = await query(
    `INSERT INTO "rolesMap" (personnelId, rolesId, branch, assignedBy)
     SELECT $1, r.id, v.branch, $2
     FROM (VALUES ${values.join(",")}) AS v(label, branch)
     JOIN "rolesTable" r ON r.label = v.label
     ON CONFLICT (personnelId, rolesId) DO UPDATE
       SET branch = EXCLUDED.branch,
           assignedBy = EXCLUDED.assignedBy
     RETURNING *;`,
    params
  );

  return result.rows;
}

async function unsetMedicalPermit({ personnelId, labels = [] }) {
  const result = await query(
    `DELETE FROM "rolesMap" rm
     USING "rolesTable" rt
     WHERE rm.rolesId = rt.id
       AND rm.personnelId = $1
       AND rt.label = ANY($2)
     RETURNING *;`,
    [personnelId, labels] // labels is an array of strings
  );

  return result.rows; // all deleted records
}


async function clearMedicalPermits(personnelId) {
  const result = await query(
    `DELETE FROM "rolesMap"
     WHERE personnelId = $1
     RETURNING *;`,
    [personnelId]
  );
  return result.rows;
}


async function isMedicalPermitted(userId, label, patientId) {
  const result = await query(
    `SELECT 1
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm.rolesId = rt.id
     JOIN "UsersPersonal" up ON up.id = $3   -- patientId lookup
     JOIN "UsersCredentials" uc ON uc.id = $3
     WHERE rm.personnelId = $1
       AND rt.label = $2
       AND (
         up.branch = 'Both'
         OR rm.branch = up.branch
         OR rm.branch = 'Both'
         OR uc.credentials_status = 'unverified'  -- check if an account has branch yet
       )
     LIMIT 1;`,
    [userId, label, patientId]
  );

  return result.rows.length > 0;
}


module.exports = { setMedicalPermit, unsetMedicalPermit, isMedicalPermitted,
  clearMedicalPermits, getMedicalpermits, permitions };