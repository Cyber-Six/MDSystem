const logger = require('../utils/logger.js');
const db = require('../config/db.js');
const permissions = {
  is_admin: "IS_ADMIN",
  is_staff: "IS_STAFF",
  privileged_to_perform_on_superior: "PRIVILEGED_TO_PERFORM_ON_SUPERIOR",

  emr_allow_approval: "ALLOW_TO_APPROVE_EMR",
  emr_allow_edit: "ALLOW_TO_EDIT_EMR",
  emr_allow_view: "ALLOW_TO_VIEW_EMR",
  emr_allow_set_vital_sign: "ALLOW_TO_SET_VITAL_SIGN",
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

  notification_allow_send_to_patients: "ALLOW_TO_SEND_NOTIFICATION_TO_PATIENTS",

  inventory_allow_view: "ALLOW_TO_VIEW_INVENTORY",
  inventory_allow_dispense: "ALLOW_TO_DISPENSE_MEDICINE",

  medicine_request_allow_approve: "ALLOW_TO_APPROVE_MEDICINE_REQUEST",
  inventory_allow_edit: "ALLOW_TO_EDIT_INVENTORY",
  inventory_allow_manage_requests: "ALLOW_TO_MANAGE_MEDICINE_REQUESTS",
  inventory_allow_prescribe: "ALLOW_TO_PRESCRIBE",
  inventory_allow_configure: "ALLOW_TO_CONFIGURE_INVENTORY",

  health_chat_allow_access: "ALLOW_TO_ACCESS_HEALTH_CHAT",

  analytics_allow_view: "ALLOW_TO_VIEW_ANALYTICS",
  analytics_allow_export: "ALLOW_TO_EXPORT_ANALYTICS",

  document_allow_view: "ALLOW_TO_VIEW_DOCUMENTS",
  document_allow_manage: "ALLOW_TO_MANAGE_DOCUMENTS",
  document_allow_generate: "ALLOW_TO_GENERATE_DOCUMENTS",

  role_management_allow_access: "ALLOW_TO_ACCESS_ROLE_MANAGEMENT",
  role_management_allow_edit: "ALLOW_TO_EDIT_ROLE_MANAGEMENT",

};

// ─── Admin-only permission keys — cannot be assigned via templates ────────────
const ADMIN_ONLY_KEYS = new Set([
  'is_admin',
  'role_management_allow_access',
  'role_management_allow_edit',
]);

// ─── GROUPED TEMPLATE PERMISSIONS ───────────────────────────────────────────
// Parent groups for template UX/API hierarchy. Each group is defined by its
// child permission keys (keys in the `permissions` object above).
const PERMISSION_GROUP_DEFINITIONS = Object.freeze({
  documents: Object.freeze({
    id: 'documents',
    label: 'DOCUMENTS',
    childKeys: Object.freeze([
      'document_allow_view',
      'document_allow_manage',
      'document_allow_generate',
    ]),
  }),
});

function createDisabledPermissionEntry(key) {
  return {
    key,
    label: permissions[key],
    enabled: false,
    branch: null,
  };
}

/**
 * Build hierarchical permission groups from a flat BranchPermission list.
 * This is used by template APIs so frontend can render parent + children
 * deterministically without inferring hierarchy client-side.
 */
function buildPermissionGroups(branchPermissions = []) {
  const flatMap = new Map((branchPermissions || []).map((perm) => [perm.key, perm]));

  return Object.values(PERMISSION_GROUP_DEFINITIONS).map((group) => {
    const children = group.childKeys.map((key) => {
      return flatMap.get(key) || createDisabledPermissionEntry(key);
    });

    const enabledChildCount = children.filter((child) => child.enabled).length;

    return {
      id: group.id,
      label: group.label,
      enabled: enabledChildCount > 0,
      fullyEnabled: enabledChildCount === children.length && children.length > 0,
      childCount: children.length,
      enabledChildCount,
      children,
    };
  });
}

/**
 * Normalize template inputs where permissions can be provided as:
 * 1) flat permission list, 2) grouped parent/children input, or both.
 *
 * Precedence rules (deterministic):
 * - Flat permissions are loaded first.
 * - Group parent `enabled` applies to all children when explicitly set.
 * - If parent is OFF, child overrides are ignored.
 * - If parent is ON/unspecified, explicit child entries override parent/default.
 */
function normalizeTemplatePermissionsInput({ permissionsList = [], permissionGroups = [], defaultBranch = 'Both' }) {
  const merged = new Map();

  const setPermission = (key, enabled, branch) => {
    const label = permissions[key];
    if (!label) {
      throw new Error(`Invalid permission key: ${key}`);
    }

    merged.set(key, {
      key,
      enabled: Boolean(enabled),
      branch: branch || defaultBranch || 'Both',
    });
  };

  for (const perm of permissionsList || []) {
    if (!perm || !perm.key) continue;
    setPermission(perm.key, perm.enabled, perm.branch);
  }

  for (const groupInput of permissionGroups || []) {
    if (!groupInput || !groupInput.groupId) continue;

    const groupDef = PERMISSION_GROUP_DEFINITIONS[groupInput.groupId];
    if (!groupDef) {
      throw new Error(`Invalid permission group: ${groupInput.groupId}`);
    }

    const groupBranch = groupInput.branch || defaultBranch || 'Both';
    const hasExplicitParent = typeof groupInput.enabled === 'boolean';

    if (hasExplicitParent) {
      for (const childKey of groupDef.childKeys) {
        setPermission(childKey, groupInput.enabled, groupBranch);
      }
    }

    // Parent OFF means children are not toggleable in that request.
    if (groupInput.enabled === false) {
      continue;
    }

    for (const child of groupInput.children || []) {
      if (!child || !child.key) continue;
      if (!groupDef.childKeys.includes(child.key)) {
        throw new Error(`Permission key ${child.key} is not part of group ${groupDef.id}`);
      }
      setPermission(child.key, child.enabled, child.branch || groupBranch);
    }
  }

  return Array.from(merged.values());
}

async function assertRoleLabelsExist(labels = [], queryClient = db) {
  const normalizedLabels = [...new Set(
    (labels || [])
      .map((label) => String(label || '').trim())
      .filter(Boolean)
  )];

  if (normalizedLabels.length === 0) {
    return;
  }

  const result = await queryClient.query(
    `SELECT label
       FROM "rolesTable"
      WHERE label = ANY($1::text[])`,
    [normalizedLabels]
  );

  const existing = new Set(result.rows.map((row) => row.label));
  const missing = normalizedLabels.filter((label) => !existing.has(label));

  if (missing.length > 0) {
    throw new Error(`rolesTable is missing permission label(s): ${missing.join(', ')}`);
  }
}

async function isMedicalAdmin(userId) {
  return await findMedicalPermit(userId, permissions.is_admin);;
}

async function getMedicalpermits(personnelId) {
  const result = await db.query(
    `SELECT rt.label, rm.branch FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1;`,
    [personnelId]
  );
  return result.rows;
}

/**
 * Get the staff member's branch designation from MedicalPersonnel.
 * Returns 'Manila', 'QuezonCity', or 'Both'. Defaults to 'Both' if not found.
 * Use this for list-level query filtering where no patientId is available.
 * @param {string|number} userId
 * @returns {Promise<string>}
 */
async function getStaffBranch(userId) {
  const result = await db.query(
    `SELECT designation FROM "MedicalPersonnel" WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.designation || 'Both';
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

  await assertRoleLabelsExist(roledata.map((role) => role.label), db);

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
     SELECT $1, r.id, v.branch::"UserDesignation", $2
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


async function clearMedicalPermits(personnelId, client) {
  const queryClient = client || db;
  const result = await queryClient.query(
    `DELETE FROM "rolesMap"
     WHERE "personnelId" = $1
     RETURNING *;`,
    [personnelId]
  );
  return result.rows;
}

/**
 * Get all permission keys with enabled status and branch information
 * @param {number} personnelId
 * @returns {Promise<Object>} { permissions: [{ key, label, enabled, branch }], count }
 */
async function getStaffPermissions(personnelId) {
  // Get all labels with their branches for this staff
  const result = await db.query(
    `SELECT rt.label, rm.branch 
      FROM "rolesMap" rm
      JOIN "rolesTable" rt
      ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1;`,
    [personnelId]
  );

  // Create a map of label -> branch for active permissions
  const activePermissions = new Map();
  for (const row of result.rows) {
    activePermissions.set(row.label, row.branch);
  }

  // Build result array with all permission keys
  const permsList = [];
  for (const [key, label] of Object.entries(permissions)) {
    const enabled = activePermissions.has(label);
    permsList.push({
      key,
      label,
      enabled,
      branch: enabled ? activePermissions.get(label) : null
    });
  }

  return {
    permissions: permsList,
    count: permsList.length
  };
}

/**
 * Set permissions for staff with independent branch per permission
 * @param {Object} params
 * @param {number} params.personnelId
 * @param {Array} params.permissionsList - Array of { key, enabled, branch? }
 * @param {number} params.assignedBy
 * @param {string} params.defaultBranch - Default branch if not specified per permission
 * @param {Object} params.client - Optional database client for transaction support
 */
async function setStaffPermissionsExtended({ personnelId, permissionsList, assignedBy, defaultBranch = 'Both', client }) {
  const queryClient = client || db;

  const toInsert = [];  // Array of { label, branch }
  const toDelete = [];  // Array of labels

  for (const perm of permissionsList) {
    const { key, enabled, branch } = perm;
    const label = permissions[key];

    if (!label) {
      logger.error(`❌ Invalid permission key attempted: ${key}`);
      throw new Error(`Invalid permission key: ${key}`);
    }

    const effectiveBranch = branch || defaultBranch;

    if (enabled === true) {
      toInsert.push({ label, branch: effectiveBranch });
    } else if (enabled === false) {
      toDelete.push(label);
    }
  }

  // Delete permissions set to false (removes records entirely)
  if (toDelete.length > 0) {
    await queryClient.query(
      `DELETE FROM "rolesMap" rm
       USING "rolesTable" rt
       WHERE rm."rolesId" = rt.id
         AND rm."personnelId" = $1
         AND rt.label = ANY($2);`,
      [personnelId, toDelete]
    );
  }

  // Insert/upsert permissions set to true (each with its own branch)
  if (toInsert.length > 0) {
    await assertRoleLabelsExist(toInsert.map((entry) => entry.label), queryClient);

    const values = [];
    const params = [personnelId, assignedBy];
    let i = params.length + 1;

    for (const { label, branch } of toInsert) {
      values.push(`($${i}, $${i + 1})`);
      params.push(label, branch);
      i += 2;
    }

    await queryClient.query(
      `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
       SELECT $1, r.id, v.branch::"UserDesignation", $2
       FROM (VALUES ${values.join(",")}) AS v(label, branch)
       JOIN "rolesTable" r ON r.label = v.label
       ON CONFLICT ("personnelId", "rolesId") DO UPDATE
         SET branch = EXCLUDED.branch,
             "assignedBy" = EXCLUDED."assignedBy";`,
      params
    );
  }

  return {
    inserted: toInsert.map(p => ({ label: p.label, branch: p.branch })),
    deleted: toDelete
  };
}

/**
 * Wrapper: Set permissions for staff using umbrella branch
 * Internally calls setStaffPermissionsExtended with all permissions using same branch
 * @param {Object} params
 * @param {number} params.personnelId
 * @param {Array} params.permissionsList - Array of { key, enabled }
 * @param {number} params.assignedBy
 * @param {string} params.branch - Applied to ALL permissions
 * @param {Object} params.client - Optional database client for transaction support
 */
async function setStaffPermissionsStandard({ personnelId, permissionsList, assignedBy, branch = 'Both', client }) {
  // Convert standard format to extended format by adding branch to each permission
  const extendedPermissionsList = permissionsList.map(perm => ({
    ...perm,
    branch: branch  // Apply umbrella branch to all
  }));

  // Call the main function with all permissions having same branch
  return await setStaffPermissionsExtended({
    personnelId,
    permissionsList: extendedPermissionsList,
    assignedBy,
    defaultBranch: branch,  // Not used since all have explicit branch, but for safety
    client  // Pass through client
  });
}

async function isMedicalPermitted(userId, label) {
  return await isMedicalPermittedMulti(userId, [label]);
}

async function isMedicalPermittedMulti(userId, labels) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permissions [${[].concat(labels).join(', ')}]`);
    return { permitted: true, branch: 'Both' };
  }

  const result = await db.query(
    `SELECT rm.branch
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1
       AND rt.label = ANY($2::text[])
     LIMIT 1;`,
    [userId, [].concat(labels)]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without any of [${[].concat(labels).join(', ')}] permission(s).`
    );
    return { permitted: false, branch: null };
  }

  return { permitted: true, branch: result.rows[0].branch };
}

async function isMedicalPermittedPatientBased(userId, label, patientId, strictSuperiority = true) {
  return await isMedicalPermittedPatientBasedMulti(userId, [label], patientId, strictSuperiority);
}

async function isMedicalPermittedPatientBasedMulti(userId, labels, patientId, strictSuperiority = true) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permissions [${[].concat(labels).join(', ')}]${patientId ? ` with patient context ${patientId}` : ""}`);
    return true;
  }

  const result = await db.query(
    `SELECT p.profile AS identity
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     JOIN "MedicalPersonnel" mp ON mp.id = rm."personnelId"
     JOIN "UsersPersonal" up ON up.id = $3
     JOIN "Patients" p ON p.id = up.id
     WHERE rm."personnelId" = $1
       AND rt.label = ANY($2::text[])
       AND (
         rm.branch = 'Both' OR
         up.branch = 'Both' OR
         up.branch = rm.branch
       )
     LIMIT 1;`,
    [userId, [].concat(labels), patientId]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without any of [${[].concat(labels).join(', ')}] permission(s)${patientId ? ` on patient ${patientId}` : ""}`
    );
    return false;
  }

  const identity = result.rows[0].identity;
  if (identity === "Superior" && strictSuperiority) {
    const permitted = await findMedicalPermit(userId, permissions.privileged_to_perform_on_superior);
    if (!permitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${userId} lacking superior privileges for [${[].concat(labels).join(', ')}] on patient ${patientId}`
      );
      return false;
    }
  }

  return true;
}

async function isMedicalPermittedLocationBased(userId, label, location) {
  return await isMedicalPermittedLocationBasedMulti(userId, [label], location);
}

async function isMedicalPermittedLocationBasedMulti(userId, labels, location) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permissions [${labels.join(', ')}] with location context ${location}`);
    return true;
  }

  let result = await db.query(
    `SELECT 1
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1
       AND rt.label = ANY($2::text[])
       AND (rm.branch = 'Both' OR rm.branch = $3 OR $3 = 'Both')
     LIMIT 1;`,
    [userId, labels, location]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without any of [${labels.join(', ')}] permission(s) with location context ${location}`
    );
    return false;
  }
  return true;
}


async function isMedicalPermittedBranchBased(userId, label, branch) {
  return await isMedicalPermittedBranchBasedMulti(userId, [label], branch);
}

async function isMedicalPermittedBranchBasedMulti(userId, labels, branch) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permissions [${labels.join(', ')}] with branch context ${branch}`);
    return true;
  }

  let result = await db.query(
    `SELECT 1
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1
       AND rt.label = ANY($2::text[])
       AND (
         rm.branch = 'Both' OR 
         (rm.branch = 'Manila' AND $3::"LocationDesignation" IN ('Arlegui', 'Casal')) OR
         (rm.branch = 'QuezonCity' AND $3::"LocationDesignation" = 'QuezonCity')
       )
     LIMIT 1;`,
    [userId, labels, branch]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without any of [${labels.join(', ')}] permission(s) with branch context ${branch}`
    );
    return false;
  }
  return true;
}

async function getMedicalPermissionBranch(userId, label) {
  const result = await db.query(
    `SELECT rm.branch
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1 AND rt.label = $2
     LIMIT 1;`,
    [userId, label]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Permission designation query: staff ${userId} does not have ${label} permission`
    );
    return null;
  }

  return result.rows[0].branch;
}
// ─── TEMPLATE PERMISSION FUNCTIONS ───────────────────────────────────────────

/**
 * Create a new permission template with permissions
 * @param {Object} params
 * @param {string} params.label - Template name
 * @param {Array} params.permissionsList - Array of { key, enabled, branch }
 * @param {number} params.createdBy - User ID creating the template
 * @param {string} params.defaultBranch - Default branch if not specified
 * @returns {Promise<Object>} Created template with id
 */
async function createPermissionTemplate({ label, permissionsList, createdBy, defaultBranch = 'Both' }) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Insert template
    const templateResult = await client.query(
      `INSERT INTO "rolesTemplate" (label, created_by, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, label, created_by, created_at;`,
      [label, createdBy]
    );

    const template = templateResult.rows[0];
    const templateId = template.id;

    // Prepare permissions to insert (strip admin-only keys)
    const toInsert = [];
    for (const perm of permissionsList) {
      const { key, enabled, branch } = perm;

      // Skip admin-only keys — they cannot be assigned via templates
      if (ADMIN_ONLY_KEYS.has(key)) continue;

      const permLabel = permissions[key];

      if (!permLabel) {
        throw new Error(`Invalid permission key: ${key}`);
      }

      if (enabled === true) {
        const effectiveBranch = branch || defaultBranch;
        toInsert.push({ label: permLabel, branch: effectiveBranch });
      }
    }

    // Insert template permissions
    if (toInsert.length > 0) {
      await assertRoleLabelsExist(toInsert.map((entry) => entry.label), client);

      const values = [];
      const params = [templateId];
      let i = params.length + 1;

      for (const { label: permLabel, branch } of toInsert) {
        values.push(`($${i}, $${i + 1})`);
        params.push(permLabel, branch);
        i += 2;
      }

      await client.query(
        `INSERT INTO "rolesTemplateMap" ("templateId", "rolesId", branch, created_at)
         SELECT $1, r.id, v.branch::"UserDesignation", NOW()
         FROM (VALUES ${values.join(",")}) AS v(label, branch)
         JOIN "rolesTable" r ON r.label = v.label;`,
        params
      );
    }

    await client.query('COMMIT');

    logger.info(`Permission template created: templateId=${templateId}, label="${label}", by userId=${createdBy}`);

    return {
      id: String(templateId),
      label: template.label,
      createdBy: String(template.created_by),
      createdAt: new Date(template.created_at).toISOString()
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to create permission template: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single permission template with its permissions
 * @param {number} templateId
 * @returns {Promise<Object>} Template with permissions array
 */
async function getPermissionTemplate(templateId) {
  // Get template info
  const templateResult = await db.query(
    `SELECT id, label, created_by, created_at
     FROM "rolesTemplate"
     WHERE id = $1;`,
    [templateId]
  );

  if (templateResult.rows.length === 0) {
    return null;
  }

  const template = templateResult.rows[0];

  // Get template permissions
  const permsResult = await db.query(
    `SELECT rt.label, rtm.branch
     FROM "rolesTemplateMap" rtm
     JOIN "rolesTable" rt ON rtm."rolesId" = rt.id
     WHERE rtm."templateId" = $1;`,
    [templateId]
  );

  // Create map of label -> branch for enabled permissions
  const activePermissions = new Map();
  for (const row of permsResult.rows) {
    activePermissions.set(row.label, row.branch);
  }

  // Build complete permissions list
  const permsList = [];
  for (const [key, label] of Object.entries(permissions)) {
    const enabled = activePermissions.has(label);
    permsList.push({
      key,
      label,
      enabled,
      branch: enabled ? activePermissions.get(label) : null
    });
  }

  return {
    id: String(template.id),
    label: template.label,
    createdBy: String(template.created_by),
    createdAt: new Date(template.created_at).toISOString(),
    permissions: permsList,
    permissionGroups: buildPermissionGroups(permsList),
    permissionCount: permsList.filter(p => p.enabled).length
  };
}

/**
 * List all permission templates
 * @returns {Promise<Array>} Array of templates with basic info
 */
async function listPermissionTemplates() {
  // Single query with JOIN — avoids N+1 by fetching all templates + their permissions at once
  const result = await db.query(
    `SELECT
       t.id,
       t.label,
       t.created_by,
       t.created_at,
       COALESCE(json_agg(
         json_build_object('label', rt.label, 'branch', rtm.branch)
       ) FILTER (WHERE rt.label IS NOT NULL), '[]'::json) AS perms
     FROM "rolesTemplate" t
     LEFT JOIN "rolesTemplateMap" rtm ON rtm."templateId" = t.id
     LEFT JOIN "rolesTable" rt ON rtm."rolesId" = rt.id
     GROUP BY t.id, t.label, t.created_by, t.created_at
     ORDER BY t.created_at DESC;`
  );

  const templates = result.rows.map(row => {
    const activePermissions = new Map();
    const perms = typeof row.perms === 'string' ? JSON.parse(row.perms) : row.perms;
    for (const p of perms) {
      activePermissions.set(p.label, p.branch);
    }

    const permsList = [];
    for (const [key, label] of Object.entries(permissions)) {
      const enabled = activePermissions.has(label);
      permsList.push({
        key,
        label,
        enabled,
        branch: enabled ? activePermissions.get(label) : null
      });
    }

    return {
      id: String(row.id),
      label: row.label,
      createdBy: String(row.created_by),
      createdAt: new Date(row.created_at).toISOString(),
      permissions: permsList,
      permissionGroups: buildPermissionGroups(permsList),
      permissionCount: permsList.filter(p => p.enabled).length
    };
  });

  return {
    templates,
    count: templates.length
  };
}

/**
 * Update a permission template
 * @param {Object} params
 * @param {number} params.templateId
 * @param {string} params.label - Optional new label
 * @param {Array} params.permissionsList - Optional new permissions
 * @param {string} params.defaultBranch - Default branch if not specified
 * @returns {Promise<Object>} Updated template
 */
async function updatePermissionTemplate({ templateId, label, permissionsList, defaultBranch = 'Both' }) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Check if template is the protected Admin template
    const templateCheck = await client.query(
      `SELECT label FROM "rolesTemplate" WHERE id = $1 LIMIT 1`,
      [templateId]
    );

    if (templateCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`Template with id ${templateId} not found`);
    }

    const currentTemplate = templateCheck.rows[0];
    if (currentTemplate.label === 'Admin') {
      await client.query('ROLLBACK');
      throw new Error('The Admin template is protected and cannot be modified');
    }

    // Update label if provided
    if (label !== undefined && label !== null) {
      await client.query(
        `UPDATE "rolesTemplate"
         SET label = $1
         WHERE id = $2;`,
        [label, templateId]
      );
    }

    // Update permissions if provided
    if (permissionsList && permissionsList.length > 0) {
      // Delete existing permissions for this template
      await client.query(
        `DELETE FROM "rolesTemplateMap"
         WHERE "templateId" = $1;`,
        [templateId]
      );

      // Prepare new permissions to insert (strip admin-only keys)
      const toInsert = [];
      for (const perm of permissionsList) {
        const { key, enabled, branch } = perm;

        // Skip admin-only keys — they cannot be assigned via templates
        if (ADMIN_ONLY_KEYS.has(key)) continue;

        const permLabel = permissions[key];

        if (!permLabel) {
          throw new Error(`Invalid permission key: ${key}`);
        }

        if (enabled === true) {
          const effectiveBranch = branch || defaultBranch;
          toInsert.push({ label: permLabel, branch: effectiveBranch });
        }
      }

      // Insert new permissions
      if (toInsert.length > 0) {
        await assertRoleLabelsExist(toInsert.map((entry) => entry.label), client);

        const values = [];
        const params = [templateId];
        let i = params.length + 1;

        for (const { label: permLabel, branch } of toInsert) {
          values.push(`($${i}, $${i + 1})`);
          params.push(permLabel, branch);
          i += 2;
        }

        await client.query(
          `INSERT INTO "rolesTemplateMap" ("templateId", "rolesId", branch, created_at)
           SELECT $1, r.id, v.branch::"UserDesignation", NOW()
           FROM (VALUES ${values.join(",")}) AS v(label, branch)
           JOIN "rolesTable" r ON r.label = v.label;`,
          params
        );
      }
    }

    await client.query('COMMIT');

    logger.info(`Permission template updated: templateId=${templateId}`);

    // Return updated template
    return await getPermissionTemplate(templateId);

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to update permission template: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a permission template
 * @param {number} templateId
 * @returns {Promise<boolean>} True if deleted
 */
async function deletePermissionTemplate(templateId) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Check if template is the protected Admin template
    const templateCheck = await client.query(
      `SELECT label FROM "rolesTemplate" WHERE id = $1 LIMIT 1`,
      [templateId]
    );

    if (templateCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;  // Template doesn't exist
    }

    const template = templateCheck.rows[0];
    if (template.label === 'Admin') {
      await client.query('ROLLBACK');
      throw new Error('The Admin template is protected and cannot be deleted');
    }

    // Delete template permissions first (foreign key constraint)
    await client.query(
      `DELETE FROM "rolesTemplateMap"
       WHERE "templateId" = $1;`,
      [templateId]
    );

    // Delete template
    const result = await client.query(
      `DELETE FROM "rolesTemplate"
       WHERE id = $1
       RETURNING id;`,
      [templateId]
    );

    await client.query('COMMIT');

    if (result.rows.length > 0) {
      logger.info(`Permission template deleted: templateId=${templateId}`);
      return true;
    }

    return false;

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to delete permission template: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply a template to a staff member (copy template permissions to staff)
 * REVISED: Preserves template branch assignments for location-scoped permissions
 * 
 * @param {Object} params
 * @param {number} params.personnelId - Staff user ID
 * @param {number} params.templateId - Template ID to apply
 * @param {number} params.assignedBy - Admin user ID applying the template
 * @param {string} params.staffBranch - Staff's branch designation (Manila, QuezonCity, Both)
 *                                     - For non-location-scoped permissions, defaults to this
 *                                     - For location-scoped permissions, template branches are PRESERVED
 * @param {Object} params.client - Optional database client for transaction support
 * @returns {Promise<Object>} Result with inserted permissions
 */
async function applyTemplateToStaff({ personnelId, templateId, assignedBy, staffBranch, client }) {
  // Get template permissions
  const template = await getPermissionTemplate(templateId);

  if (!template) {
    throw new Error(`Template with id ${templateId} not found`);
  }

  // Location-scoped permissions that should preserve template branch assignments
  // These are permissions where the branch represents accessible locations
  const LOCATION_SCOPED_KEYS = new Set([
    'announcement_allow_crud',
    'health_chat_allow_access'
    // Add other location-based permissions here
  ]);

  // Filter only enabled permissions
  // Preserve template branch for location-scoped permissions
  // Use staffBranch as default for other permissions
  const enabledPermissions = template.permissions
    .filter(p => p.enabled)
    .map(p => ({
      key: p.key,
      enabled: true,
      // For location-scoped permissions, use template branch
      // For others, use staff branch or default to 'Both'
      branch: LOCATION_SCOPED_KEYS.has(p.key) 
        ? p.branch  // Keep template's branch for location-scoped
        : (staffBranch || p.branch || 'Both')  // Use staff branch for non-location-scoped
    }));

  // Apply permissions using existing function, passing client through
  await setStaffPermissionsExtended({
    personnelId: String(personnelId),
    permissionsList: enabledPermissions,
    assignedBy: String(assignedBy),
    defaultBranch: staffBranch || 'Both',
    client  // Pass through client
  });

  logger.info(`Template applied to staff: templateId=${templateId}, personnelId=${personnelId}, by userId=${assignedBy}`);

  return {
    appliedCount: enabledPermissions.length,
    permissions: enabledPermissions
  };
}

/**
 * Propagate template permission changes to all staff assigned to this role.
 * For each linked staff: clears existing permissions, re-applies from the
 * updated template, and ensures is_staff is always set with the correct branch.
 *
 * @param {Object} params
 * @param {number} params.templateId - The template that was updated
 * @param {string} params.roleLabel  - The role label to match staff against
 * @param {number} params.assignedBy - The admin user ID performing the update
 * @param {Object} params.client - Optional database client for transaction support
 * @returns {Promise<{ affectedCount: number }>}
 */
async function propagateTemplatePermissions({ templateId, roleLabel, assignedBy, client }) {
  // Get the updated template for its current permissions
  const template = await getPermissionTemplate(templateId);
  if (!template) {
    throw new Error(`Template with id ${templateId} not found`);
  }

  // Find all staff with this role
  const staffResult = await db.query(
    `SELECT mp.id, mp.designation, mp.is_active
     FROM "MedicalPersonnel" mp
     WHERE mp.role = $1`,
    [roleLabel]
  );

  if (staffResult.rows.length === 0) {
    return { affectedCount: 0, affectedStaff: [] };
  }

  // Pre-compute enabled permissions from template (exclude is_staff — added per-staff with correct branch)
  const enabledPermissions = template.permissions
    .filter(p => p.enabled && p.key !== 'is_staff')
    .map(p => ({ key: p.key, enabled: true, branch: p.branch }));

  let affectedCount = 0;
  const affectedStaff = [];
  for (const staff of staffResult.rows) {
    const branch = staff.designation || 'Both';

    // Clear existing permissions (clean slate)
    await clearMedicalPermits(String(staff.id), client);

    // Build full permissions: override template branches with staff's branch + is_staff with staff-specific branch
    const staffPermissions = [
      ...enabledPermissions.map(p => ({
        ...p,
        branch: branch  // Override template branch with staff's actual branch
      })),
      { key: 'is_staff', enabled: true, branch }
    ];

    // Apply all permissions in a single upsert
    await setStaffPermissionsExtended({
      personnelId: String(staff.id),
      permissionsList: staffPermissions,
      assignedBy: String(assignedBy),
      defaultBranch: branch,  // Use staff's branch as default
      client  // Pass through client
    });

    affectedCount++;
    affectedStaff.push({
      userId: String(staff.id),
      branch,
      status: staff.is_active ? 'Active' : 'Suspended',
    });
  }

  logger.info(`Template permissions propagated: templateId=${templateId}, role="${roleLabel}", affectedStaff=${affectedCount}`);
  return { affectedCount, affectedStaff };
}

// ─── MODULE-LEVEL PERMISSION MAP ─────────────────────────────────────────────
// Maps frontend module IDs to their underlying backend permission keys.
// MUST be kept in sync with Frontend mds-staff/src/modules/role-management/role-permissions.js
// When a module is ON, ALL listed keys are granted.
// When a module is OFF, keys are revoked ONLY if no other enabled module uses them (union logic).

const MODULE_PERMISSION_MAP = {
  patientSearch: [
    'profile_allow_view',
    'emr_allow_view',
    'profile_allow_update_email_identifier',  // ← Added to match frontend
  ],
  pendingRequests: [
    'emr_allow_approval',
    'profile_allow_approval',
    'appointment_allow_approval',
    'medicine_request_allow_approve',
  ],
  medicalRecords: [
    'emr_allow_view',
    'emr_allow_edit',
    'emr_allow_edit_catalogs',
    'emr_allow_set_vital_sign',  // ← Added to match frontend
    'consultation_allow_view',
    'consultation_allow_edit',
    'profile_allow_view',
    'profile_allow_edit',
  ],
  dentalRecords: [
    'emr_allow_view',
    'emr_allow_edit',
    'emr_allow_set_dental_record',
    'consultation_allow_view',
    'consultation_allow_edit',
  ],
  appointments: [
    'appointment_allow_approval',
    'appointment_allow_view_records',
    'appointment_allow_view_configuration',
    'appointment_allow_edit_configuration',
  ],
  inventory: [
    'inventory_allow_view',
    'inventory_allow_edit',
    'inventory_allow_dispense',
    'inventory_allow_manage_requests',
    'inventory_allow_prescribe',
    'inventory_allow_configure',  // ← Added to match frontend
  ],
  announcements: [
    'announcement_allow_crud',
  ],
  healthChat: [
    'health_chat_allow_access',
  ],
  sendNotification: [
    'notification_allow_send_to_patients',
  ],
  analytics: [
    'analytics_allow_view',
    'analytics_allow_export',
  ],
  documents: [
    'document_allow_view',
    'document_allow_manage',
    'document_allow_generate',
  ],
  superiorAccess: [
    'privileged_to_perform_on_superior',  // ← Added to match frontend
  ],
  // roleManagement intentionally excluded — admin-only via is_admin, not assignable via templates
};

const MODULE_LABELS = {
  patientSearch: 'Search Patient',
  pendingRequests: 'Pending Requests',
  medicalRecords: 'Medical Records',
  dentalRecords: 'Dental Records',
  appointments: 'Appointments',
  inventory: 'Inventory',
  announcements: 'Announcements',
  healthChat: 'Health Chat',
  sendNotification: 'Send Notification',
  analytics: 'Analytics',
  documents: 'Documents',
  superiorAccess: 'Superior Account Access',  // ← Added to match frontend
  // roleManagement excluded — admin-only access
};

/**
 * Expand module toggles into granular permission keys with union logic.
 * A key is enabled if ANY module that maps to it is enabled.
 * A key is disabled only if ALL modules that map to it are OFF.
 * @param {Array<{moduleId: string, enabled: boolean}>} modules
 * @returns {Array<{key: string, enabled: boolean}>}
 */
function resolveModulePermissions(modules) {
  const keyStates = new Map();

  for (const { moduleId, enabled } of modules) {
    const keys = MODULE_PERMISSION_MAP[moduleId] || [];
    for (const key of keys) {
      if (enabled) {
        keyStates.set(key, true);
      } else if (!keyStates.has(key)) {
        keyStates.set(key, false);
      }
    }
  }

  return Array.from(keyStates.entries()).map(([key, enabled]) => ({ key, enabled }));
}

/**
 * Set staff permissions at the module level.
 * Expands module toggles to granular permission keys using union logic,
 * then applies them via setStaffPermissionsExtended.
 * Also ensures is_staff is always set when any module is enabled.
 * @param {Object} params
 * @param {number|string} params.personnelId
 * @param {Array<{moduleId: string, enabled: boolean}>} params.modules
 * @param {number|string} params.assignedBy
 * @param {string} params.branch - Branch designation for all permissions
 * @returns {Promise<Object>}
 */
async function setStaffModulePermissions({ personnelId, modules, assignedBy, branch = 'Both' }) {
  // Validate all module IDs
  for (const { moduleId } of modules) {
    if (!MODULE_PERMISSION_MAP.hasOwnProperty(moduleId)) {
      throw new Error(`Invalid module ID: ${moduleId}`);
    }
  }

  // Resolve to granular permission keys with union logic
  const resolvedKeys = resolveModulePermissions(modules);

  // Ensure is_staff is always set if any module is enabled
  const anyEnabled = modules.some(m => m.enabled);
  const hasIsStaff = resolvedKeys.find(k => k.key === 'is_staff');
  if (!hasIsStaff) {
    resolvedKeys.push({ key: 'is_staff', enabled: anyEnabled });
  }

  // Apply via the existing extended permissions function
  await setStaffPermissionsExtended({
    personnelId: String(personnelId),
    permissionsList: resolvedKeys,
    assignedBy: String(assignedBy),
    defaultBranch: branch,
  });

  logger.info(`Module permissions set: personnelId=${personnelId}, modules=${modules.map(m => `${m.moduleId}:${m.enabled}`).join(',')}, by userId=${assignedBy}`);

  return { ok: true };
}

/**
 * Derive module-level permission status from existing granular permissions.
 * A module is considered enabled only if ALL its mapped keys are enabled.
 * @param {number|string} personnelId
 * @returns {Promise<{modules: Array<{moduleId: string, label: string, enabled: boolean}>, count: number}>}
 */
async function getStaffModulePermissions(personnelId) {
  const { permissions: permsList } = await getStaffPermissions(personnelId);

  // Build a set of enabled permission keys
  const enabledKeys = new Set();
  for (const p of permsList) {
    if (p.enabled) {
      enabledKeys.add(p.key);
    }
  }

  const modules = [];
  for (const [moduleId, keys] of Object.entries(MODULE_PERMISSION_MAP)) {
    let enabled;
    if (keys.length === 0) {
      // Modules with no keys mapped yet are considered disabled
      enabled = false;
    } else {
      // Module is enabled only if ALL its keys are enabled
      enabled = keys.every(key => enabledKeys.has(key));
    }

    modules.push({
      moduleId,
      label: MODULE_LABELS[moduleId] || moduleId,
      enabled,
    });
  }

  return { modules, count: modules.length };
}

module.exports = {
  isMedicalAdmin,
  setMedicalPermit,
  unsetMedicalPermit,
  isMedicalPermitted,
  isMedicalPermittedMulti,
  isMedicalPermittedPatientBased,
  isMedicalPermittedPatientBasedMulti,
  isMedicalPermittedLocationBased,
  isMedicalPermittedLocationBasedMulti,
  isMedicalPermittedBranchBased,
  isMedicalPermittedBranchBasedMulti,
  clearMedicalPermits,
  getMedicalpermits,
  getStaffBranch,
  permissions,
  getStaffPermissions,
  setStaffPermissionsExtended,
  setStaffPermissionsStandard,
  // Template functions
  createPermissionTemplate,
  getPermissionTemplate,
  listPermissionTemplates,
  updatePermissionTemplate,
  deletePermissionTemplate,
  applyTemplateToStaff,
  propagateTemplatePermissions,
  PERMISSION_GROUP_DEFINITIONS,
  buildPermissionGroups,
  normalizeTemplatePermissionsInput,
  // Module-level permission functions
  MODULE_PERMISSION_MAP,
  MODULE_LABELS,
  ADMIN_ONLY_KEYS,
  resolveModulePermissions,
  setStaffModulePermissions,
  getStaffModulePermissions,
  getMedicalPermissionBranch,
};