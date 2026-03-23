const db = require('../../../../config/query.js');
const {
  permissions,
  getStaffPermissions,
  setStaffPermissionsExtended,
  setStaffPermissionsStandard
} = require('../../../../services/permit.js');
const {
  listUserSessions,
  scanAllRefreshSessions,
  deleteAllUserSessions,
  getStaffAnchor,
  saveStaffAnchor
} = require('../../../../config/redis.js');
const crypto = require('crypto');
const logger = require('../../../../utils/logger.js');
const { throwGraphQLError } = require('../../../../utils/graphql-helper.js');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function labelsToPermissions(labels) {
  const labelSet = new Set(labels || []);
  const perms = {};
  for (const [key, label] of Object.entries(permissions)) {
    perms[key] = labelSet.has(label);
  }
  return perms;
}

function buildUserInfo(row) {
  const nameParts = [
    row.first_name,
    row.middle_name,
    row.last_name
  ].filter(Boolean);

  return {
    email: row.email,
    identity: row.identity,
    credentialsStatus: row.credentials_status,
    name: nameParts.join(' ') || row.email
  };
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const Query = {
  _listStaffAccounts: async (_, { status, location }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         mp.designation AS branch,
         COALESCE(array_agg(rt.label) FILTER (WHERE rt.label IS NOT NULL), '{}') AS labels
       FROM "UserCredentials" uc
       JOIN "UsersPersonal" up ON up.id = uc.id
       JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
       LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       WHERE
          uc.identity = 'Medical'
          AND ($1 IS NULL OR uc.credentials_status = $1)
          AND ($2 IS NULL OR mp.designation = $2)
       GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
                up.first_name, up.middle_name, up.last_name, mp.designation
       ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST`,
      [status || null, location || null]
    );

    // Fetch last login dates
    let lastLoginMap = {};
    try {
      const loginResult = await db.query(
        `SELECT ula.user_id, MAX(ula.attempted_at) AS last_login
         FROM "UserLoginAttempt" ula
         WHERE ula.was_successful = true
         GROUP BY ula.user_id`
      );
      for (const row of loginResult.rows) {
        lastLoginMap[row.user_id] = row.last_login;
      }
    } catch (_) {
      // gracefully skip on error
    }

    const staff = result.rows.map((row) => {
      const perms = labelsToPermissions(row.labels);

      let staffStatus;
      if (row.identity === 'Medical') {
        staffStatus = 'Active';
      } else if (perms.is_staff) {
        staffStatus = 'Suspended';
      } else {
        staffStatus = 'Pending';
      }

      const nameParts = [
        row.first_name,
        row.middle_name ? `${row.middle_name[0]}.` : null,
        row.last_name,
      ].filter(Boolean);

      const lastLogin = lastLoginMap[row.id] || null;

      return {
        id: String(row.id),
        email: row.email,
        name: nameParts.join(' ') || row.email,
        branch: row.branch || 'Both',
        identity: row.identity,
        status: staffStatus,
        permissions: perms,
        credentialsStatus: row.credentials_status,
        lastLogin: lastLogin
          ? new Date(lastLogin).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null,
      };
    });

    return { staff, count: staff.length };
  },

  _getStaffAccount: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         mp.designation AS branch,
         COALESCE(array_agg(rt.label) FILTER (WHERE rt.label IS NOT NULL), '{}') AS labels
       FROM "UserCredentials" uc
       JOIN "UsersPersonal" up ON up.id = uc.id
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
       LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       WHERE uc.id = $1
       GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
                up.first_name, up.middle_name, up.last_name, mp.designation`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const perms = labelsToPermissions(row.labels);

    let staffStatus;
    if (row.identity === 'Medical') {
      staffStatus = 'Active';
    } else if (perms.is_staff) {
      staffStatus = 'Suspended';
    } else {
      staffStatus = 'Pending';
    }

    const nameParts = [
      row.first_name,
      row.middle_name ? `${row.middle_name[0]}.` : null,
      row.last_name,
    ].filter(Boolean);

    return {
      id: String(row.id),
      email: row.email,
      name: nameParts.join(' ') || row.email,
      branch: row.branch || 'Both',
      identity: row.identity,
      status: staffStatus,
      permissions: perms,
      credentialsStatus: row.credentials_status,
      lastLogin: null,
    };
  },

  _listMedicalPersonnel: async (_, { role, designation, isActive }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const result = await db.query(
      `SELECT
         mp.id, mp.role, mp.title, mp.designation, mp.is_active,
         uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       JOIN "UsersPersonal" up ON up.id = mp.id
       WHERE
         ($1 IS NULL OR mp.role = $1)
         AND ($2 IS NULL OR mp.designation = $2)
         AND ($3 IS NULL OR mp.is_active = $3::boolean)
       ORDER BY mp.id DESC`,
      [role || null, designation || null, isActive !== undefined ? isActive : null]
    );

    const personnel = result.rows.map(row => ({
      id: row.id,
      role: row.role,
      title: row.title,
      designation: row.designation,
      isActive: row.is_active,
      user: buildUserInfo(row)
    }));

    return { personnel, count: personnel.length };
  },

  _getMedicalPersonnel: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const result = await db.query(
      `SELECT
         mp.id, mp.role, mp.title, mp.designation, mp.is_active,
         uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       JOIN "UsersPersonal" up ON up.id = mp.id
       WHERE mp.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      role: row.role,
      title: row.title,
      designation: row.designation,
      isActive: row.is_active,
      user: buildUserInfo(row)
    };
  },

  _getStaffPermissions: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    return await getStaffPermissions(userId);
  },

  _listStaffSessions: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Get all refresh sessions for this user from Redis
    const sessions = await listUserSessions(userId);
    const currentAnchor = await getStaffAnchor(userId);

    // Format sessions for GraphQL response
    const formattedSessions = sessions.map(session => ({
      deviceId: session.deviceId || 'unknown',
      status: session.status || 'active',
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: session.updatedAt ? new Date(session.updatedAt).toISOString() : null,
      expiresAt: session.exp ? new Date(session.exp).toISOString() : null,
      isCurrent: session.deviceId === user.deviceId
    }));

    return {
      sessions: formattedSessions,
      count: formattedSessions.length,
      currentAnchor: currentAnchor || null
    };
  },

  /**
   * Count all active refresh tokens across all users
   * Filters out expired sessions (exp < now) or those with status !== "active"
   */
  _countActiveRefreshTokens: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const now = Date.now();
    const allSessions = await scanAllRefreshSessions();

    // Filter active, non-expired sessions
    const activeCount = allSessions.filter(session => {
      // Handle missing or malformed session data gracefully
      if (!session) return false;

      // Check status is "active"
      if (session.status !== 'active') return false;

      // Check not expired (exp is in milliseconds)
      if (session.exp && session.exp < now) return false;

      return true;
    }).length;

    return activeCount;
  },

  /**
   * List all sessions across all logged-in users with offset-based pagination (global query)
   * Scans all refresh sessions, maps userId to email, and paginates
   * Returns userId, email, role, exp for each session
   */
  _listUserSessions: async (_, { offset = 0, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Validate pagination parameters
    if (offset < 0) {
      throwGraphQLError(res).message('offset must be >= 0').status(400).throw();
    }
    if (limit < 1 || limit > 100) {
      throwGraphQLError(res).message('limit must be between 1 and 100').status(400).throw();
    }

    // Scan all refresh sessions across all users in the system
    const allSessions = await scanAllRefreshSessions();
    const totalCount = allSessions.length;

    // Apply offset-based pagination
    const paginatedSessions = allSessions.slice(offset, offset + limit);

    // Map userId to email and extract userId, email, role, exp
    const sessions = await Promise.all(paginatedSessions.map(async (session) => {
      // Handle missing or malformed session data gracefully
      if (!session) {
        return {
          userId: 'unknown',
          email: 'unknown',
          role: 'unknown',
          exp: 0
        };
      }

      // Look up email for this session's userId
      const email = await db.findEmailByUserId(session.userId);

      return {
        userId: String(session.userId) || 'unknown',
        email: email || 'unknown',
        role: session.role || 'unknown',
        exp: session.exp ? Number(session.exp) : 0
      };
    }));

    return {
      sessions,
      totalCount
    };
  },
};

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const Mutation = {
  _createMedicalPersonnel: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const { userId, title, role, designation } = input;

    // Validate required fields
    if (!userId || !title || !role || !designation) {
      throwGraphQLError(res).message('userId, title, role, and designation are required.').status(400).throw();
    }

    // Validate designation
    const validDesignations = ['Manila', 'QuezonCity', 'Both'];
    if (!validDesignations.includes(designation)) {
      throwGraphQLError(res).message('designation must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // Validate role
    const validRoles = ['Doctor', 'Nurse', 'Admin', 'Pharmacist', 'Dentist', 'Staff'];
    if (!validRoles.includes(role)) {
      throwGraphQLError(res)
        .message('role must be one of: Doctor, Nurse, Admin, Pharmacist, Dentist, Staff.')
        .status(400)
        .throw();
    }

    // Verify user exists and has Employee identity
    const userResult = await db.query(
      `SELECT uc.id, md.id AS "medicalId", uc.identity FROM "UserCredentials" uc
      LEFT JOIN "MedicalPersonnel" md ON md.id = uc.id
      WHERE uc.id = $1 
      LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throwGraphQLError(res).message('User not found.').status(404).throw();
    }

    const targetUser = userResult.rows[0];
    if (targetUser.identity !== 'Employee' || process.env.ALLOW_MEDICAL_CREATION_FOR_NON_EMPLOYEES === 'true') {
      throwGraphQLError(res)
        .message('User must have Employee identity to be assigned a MedicalPersonnel role.')
        .status(409)
        .throw();
    }
    
    if (targetUser.medicalId) {
      throwGraphQLError(res).message('MedicalPersonnel record already exists for this user.').status(409).throw();
    }

    // Insert MedicalPersonnel record
    const insertResult = await db.query(
      `INSERT INTO "MedicalPersonnel" (id, role, title, designation, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, role, title, designation]
    );

    const personnel = insertResult.rows[0];
    logger.info(`MedicalPersonnel record created: userId=${userId}, role=${role}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'MedicalPersonnel record created successfully.',
      personnel: {
        id: personnel.id,
        role: personnel.role,
        title: personnel.title,
        designation: personnel.designation,
        isActive: personnel.is_active,
        user: null
      }
    };
  },

  _updateMedicalPersonnel: async (_, { userId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const { title, designation, isActive } = input;

    // Validate at least one field provided
    if (title === undefined && designation === undefined && isActive === undefined) {
      throwGraphQLError(res)
        .message('At least one field (title, designation, isActive) must be provided.')
        .status(400)
        .throw();
    }

    // Validate designation if provided
    if (designation !== undefined) {
      const validDesignations = ['Manila', 'QuezonCity', 'Both'];
      if (!validDesignations.includes(designation)) {
        throwGraphQLError(res).message('designation must be Manila, QuezonCity, or Both.').status(400).throw();
      }
    }

    // Verify MedicalPersonnel record exists
    const existingResult = await db.query(
      `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );

    if (existingResult.rows.length === 0) {
      throwGraphQLError(res).message('MedicalPersonnel record not found.').status(404).throw();
    }

    // Build dynamic UPDATE query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (designation !== undefined) {
      updates.push(`designation = $${paramIndex++}`);
      params.push(designation);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    params.push(userId);

    const updateQuery = `
      UPDATE "MedicalPersonnel"
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await db.query(updateQuery, params);
    const personnel = updateResult.rows[0];

    logger.info(`MedicalPersonnel record updated: userId=${userId}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'MedicalPersonnel record updated successfully.',
      personnel: {
        id: personnel.id,
        role: personnel.role,
        title: personnel.title,
        designation: personnel.designation,
        isActive: personnel.is_active,
        user: null
      }
    };
  },

  _deleteMedicalPersonnel: async (_, { userId, revertIdentity = true }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Verify MedicalPersonnel record exists
    const existingResult = await db.query(
      `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );

    if (existingResult.rows.length === 0) {
      throwGraphQLError(res).message('MedicalPersonnel record not found.').status(404).throw();
    }

    // Delete MedicalPersonnel record
    await db.query(
      `DELETE FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );

    let identityReverted = false;

    // Optionally revert identity to Employee
    if (revertIdentity) {
      const identityResult = await db.query(
        `UPDATE "UserCredentials"
         SET identity = 'Employee'
         WHERE id = $1 AND identity = 'Medical'
         RETURNING id`,
        [userId]
      );
      identityReverted = identityResult.rowCount > 0;
    }

    logger.info(`MedicalPersonnel record deleted: userId=${userId}, identityReverted=${identityReverted}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'MedicalPersonnel record deleted successfully.',
      identityReverted
    };
  },

  _setStaffPermissionsStandard: async (_, { userId, permissions: permissionsList, branch }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Validate branch (required for standard)
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      throwGraphQLError(res).message('branch must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    await setStaffPermissionsStandard({
      personnelId: String(userId),
      permissionsList,
      assignedBy: String(user.id),
      branch,
    });

    logger.info(`Staff permissions set (standard): userId=${userId}, branch=${branch}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'Staff permissions updated successfully.',
    };
  },

  _setStaffPermissionsExtended: async (_, { userId, permissions: permissionsList, defaultBranch = 'Both' }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Validate defaultBranch
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (defaultBranch && !validBranches.includes(defaultBranch)) {
      throwGraphQLError(res).message('defaultBranch must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // Validate each permission's branch if provided
    for (const perm of permissionsList) {
      if (perm.branch && !validBranches.includes(perm.branch)) {
        throwGraphQLError(res)
          .message(`Invalid branch "${perm.branch}" for permission "${perm.key}". Must be Manila, QuezonCity, or Both.`)
          .status(400)
          .throw();
      }
    }

    await setStaffPermissionsExtended({
      personnelId: String(userId),
      permissionsList,
      assignedBy: String(user.id),
      defaultBranch,
    });

    logger.info(`Staff permissions set (extended): userId=${userId}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'Staff permissions updated successfully.',
    };
  },

  _rotateStaffAnchor: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    // Verify target user exists and is Medical staff
    const targetResult = await db.query(
      `SELECT uc.id, uc.identity, uc.credentials_status
       FROM "UserCredentials" uc
       WHERE uc.id = $1`,
      [userId]
    );

    if (targetResult.rows.length === 0) {
      throwGraphQLError(res).message('User not found.').status(404).throw();
    }

    const targetUser = targetResult.rows[0];

    if (targetUser.identity !== 'Medical') {
      throwGraphQLError(res)
        .message('Can only rotate anchor for Medical staff accounts.')
        .status(403)
        .throw();
    }

    // Get current sessions count before rotation
    const sessions = await listUserSessions(userId);
    const sessionCount = sessions.length;

    // Generate new anchor and save it
    const REFRESH_EXP = parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800;
    const newAnchor = crypto.randomUUID();
    await saveStaffAnchor(userId, newAnchor, REFRESH_EXP);

    // Delete all refresh sessions for this user
    await deleteAllUserSessions(userId);

    logger.warn(`Staff anchor rotated: userId=${userId}, sessionsInvalidated=${sessionCount}, by adminId=${user.id}`);

    return {
      ok: true,
      message: 'Staff anchor rotated successfully. All devices have been logged out.',
      sessionsInvalidated: sessionCount,
    };
  },
};

module.exports = { Query, Mutation };
