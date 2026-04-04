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

  role_management_allow_access: "ALLOW_TO_ACCESS_ROLE_MANAGEMENT",
  role_management_allow_edit: "ALLOW_TO_EDIT_ROLE_MANAGEMENT",

};

// ─── Admin-only permission keys — cannot be assigned via templates ────────────
const ADMIN_ONLY_KEYS = new Set([
  'is_admin',
  'role_management_allow_access',
  'role_management_allow_edit',
]);

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


async function clearMedicalPermits(personnelId) {
  const result = await db.query(
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
 */
async function setStaffPermissionsExtended({ personnelId, permissionsList, assignedBy, defaultBranch = 'Both' }) {
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
    await db.query(
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
    const values = [];
    const params = [personnelId, assignedBy];
    let i = params.length + 1;

    for (const { label, branch } of toInsert) {
      values.push(`($${i}, $${i + 1})`);
      params.push(label, branch);
      i += 2;
    }

    await db.query(
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
 */
async function setStaffPermissionsStandard({ personnelId, permissionsList, assignedBy, branch = 'Both' }) {
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
    defaultBranch: branch  // Not used since all have explicit branch, but for safety
  });
}

async function isMedicalPermitted(userId, label) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permission ${label}`);
    return {permitted: true, branch: 'Both'};
  } // Admin bypass

  // Case: patientId null → skip patient join, only check if role exists
  const result = await db.query(
    `SELECT rm.branch
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1
       AND rt.label = $2
     LIMIT 1;`,
    [userId, label]
  );
  

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without ${label} permission.`
    );
    return { permitted: false, branch: null };
  }


  return { permitted: true, branch: result.rows[0].branch };
}


async function isMedicalPermittedPatientBased(userId, label, patientId, strictSuperiority = true) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permission ${label}${patientId ? ` with patient context ${patientId}` : ""}`);
    return true;
  } // Admin bypass

  const result = await db.query(
    `SELECT uc.identity
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     JOIN "MedicalPersonnel" mp ON mp.id = rm."personnelId"
     JOIN "UsersPersonal" up ON up.id = $3
     JOIN "UserCredentials" uc ON uc.id = up.id
     WHERE rm."personnelId" = $1
       AND rt.label = $2
       AND (
         rm.branch = 'Both' OR
         up.branch = 'Both' OR
         up.branch = rm.branch
       )
     LIMIT 1;`,
    [userId, label, patientId]
  );
  
  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without ${label} permission${patientId ? ` on patient ${patientId}` : ""}`
    );
    return false;
  }

  // If patient is Superior, staff must have privileged permit
  const identity = result.rows[0].identity;
  if (identity === "Superior" && strictSuperiority) {
    const permitted = await findMedicalPermit(userId,
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


async function isMedicalPermittedLocationBased(userId, label, location) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permission ${label} with location context ${location}`);
    return true;
  } // Admin bypass

  let result = await db.query(
    `SELECT 1
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1
       AND rt.label = $2 
       AND (rm.branch = 'Both' OR rm.branch = $3)
     LIMIT 1;`,
    [userId, label, location]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without ${label} permission with location context ${location}`
    );
    return false;
  }
  return true;
}

async function isMedicalPermittedBranchBased(userId, label, branch) {
  const isAdmin = await findMedicalPermit(userId, permissions.is_admin);
  if (isAdmin) {
    logger.info(`Admin bypass granted for userId=${userId} on permission ${label} with branch context ${branch}`);
    return true;
  } // Admin bypass

  let result = await db.query(
    `SELECT 1
     FROM "rolesMap" rm
     JOIN "rolesTable" rt ON rm."rolesId" = rt.id
     WHERE rm."personnelId" = $1 AND
       rt.label = $2 AND (
        rm.branch = 'Both' OR 
        (rm.branch = 'Manila' AND $3::"LocationDesignation" IN ('Arlegui', 'Casal')) OR
        (rm.branch = 'QuezonCity' AND $3::"LocationDesignation" = 'QuezonCity')
       )
     LIMIT 1;`,
    [userId, label, branch]
  );

  if (result.rows.length === 0) {
    logger.warn(
      `Unauthorized access attempt by staff ${userId} without ${label} permission with branch context ${branch}`
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
      createdAt: template.created_at.toISOString()
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
    createdAt: template.created_at.toISOString(),
    permissions: permsList,
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
      createdAt: row.created_at.toISOString(),
      permissions: permsList,
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
 * @param {Object} params
 * @param {number} params.personnelId - Staff user ID
 * @param {number} params.templateId - Template ID to apply
 * @param {number} params.assignedBy - Admin user ID applying the template
 * @returns {Promise<Object>} Result with inserted permissions
 */
async function applyTemplateToStaff({ personnelId, templateId, assignedBy }) {
  // Get template permissions
  const template = await getPermissionTemplate(templateId);

  if (!template) {
    throw new Error(`Template with id ${templateId} not found`);
  }

  // Filter only enabled permissions
  const enabledPermissions = template.permissions
    .filter(p => p.enabled)
    .map(p => ({
      key: p.key,
      enabled: true,
      branch: p.branch
    }));

  // Apply permissions using existing function
  await setStaffPermissionsExtended({
    personnelId: String(personnelId),
    permissionsList: enabledPermissions,
    assignedBy: String(assignedBy),
    defaultBranch: 'Both'
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
 * @returns {Promise<{ affectedCount: number }>}
 */
async function propagateTemplatePermissions({ templateId, roleLabel, assignedBy }) {
  // Get the updated template for its current permissions
  const template = await getPermissionTemplate(templateId);
  if (!template) {
    throw new Error(`Template with id ${templateId} not found`);
  }

  // Find all staff with this role
  const staffResult = await db.query(
    `SELECT mp.id, mp.designation
     FROM "MedicalPersonnel" mp
     WHERE mp.role = $1`,
    [roleLabel]
  );

  if (staffResult.rows.length === 0) {
    return { affectedCount: 0 };
  }

  // Pre-compute enabled permissions from template (exclude is_staff — added per-staff with correct branch)
  const enabledPermissions = template.permissions
    .filter(p => p.enabled && p.key !== 'is_staff')
    .map(p => ({ key: p.key, enabled: true, branch: p.branch }));

  let affectedCount = 0;
  for (const staff of staffResult.rows) {
    const branch = staff.designation || 'Both';

    // Clear existing permissions (clean slate)
    await clearMedicalPermits(String(staff.id));

    // Build full permissions: template perms + is_staff with staff-specific branch
    const staffPermissions = [
      ...enabledPermissions,
      { key: 'is_staff', enabled: true, branch }
    ];

    // Apply all permissions in a single upsert
    await setStaffPermissionsExtended({
      personnelId: String(staff.id),
      permissionsList: staffPermissions,
      assignedBy: String(assignedBy),
      defaultBranch: 'Both'
    });

    affectedCount++;
  }

  logger.info(`Template permissions propagated: templateId=${templateId}, role="${roleLabel}", affectedStaff=${affectedCount}`);
  return { affectedCount };
}

// ─── MODULE-LEVEL PERMISSION MAP ─────────────────────────────────────────────
// Maps frontend module IDs to their underlying backend permission keys.
// When a module is ON, ALL listed keys are granted.
// When a module is OFF, keys are revoked ONLY if no other enabled module uses them (union logic).

const MODULE_PERMISSION_MAP = {
  patientSearch: [
    'profile_allow_view',
    'emr_allow_view',
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
  ],
  healthChat: [
    'health_chat_allow_access',
  ],
  analytics: [
    'analytics_allow_view',
    'analytics_allow_export',
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
  healthChat: 'Health Chat',
  analytics: 'Analytics',
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
  isMedicalPermittedPatientBased,
  isMedicalPermittedLocationBased,
  isMedicalPermittedBranchBased,
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
  // Module-level permission functions
  MODULE_PERMISSION_MAP,
  MODULE_LABELS,
  ADMIN_ONLY_KEYS,
  resolveModulePermissions,
  setStaffModulePermissions,
  getStaffModulePermissions,
  getMedicalPermissionBranch,
};