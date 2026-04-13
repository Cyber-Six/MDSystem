const db = require('../../../../../config/query.js');
const {
  permissions,
  getStaffPermissions,
  setStaffPermissionsExtended,
  setStaffPermissionsStandard,
  createPermissionTemplate,
  getPermissionTemplate,
  listPermissionTemplates,
  updatePermissionTemplate,
  deletePermissionTemplate,
  applyTemplateToStaff,
  propagateTemplatePermissions,
  isMedicalPermitted,
  MODULE_PERMISSION_MAP,
  MODULE_LABELS,
  setStaffModulePermissions,
  getStaffModulePermissions,
  clearMedicalPermits,
} = require('../../../../../services/permit.js');
const {
  setKey,
  listUserSessions,
  listUserSessionsWithMeta,
  scanAllRefreshSessions,
  scanAllRefreshSessionsWithMeta,
  deleteAllUserSessions,
  getStaffAnchor,
  saveStaffAnchor,
  createAdminTransferSession,
  getAdminTransferSession,
  deleteAdminTransferSession,
  recordAdminTransferAttempt,
  getAdminActivePendingTransfer,
  recordAdminTransferPasswordFailure,
  isAdminTransferPasswordLocked,
  clearAdminTransferPasswordFailures,
} = require('../../../../../config/redis.js');
const { enqueueAdminTransferEmail } = require('../../../../../services/emailservice.js');
const { emitToUser } = require('../../../../../config/sockets');
const { generateOTP, verifyPassword, 
  delayRandom, generateUUID } = require('../../../../../utils/security.js');
const crypto = require('crypto');
const logger = require('../../../../../utils/logger.js');
const { throwGraphQLError } = require('../../../../../utils/graphql-helper.js');

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const REFRESH_SESSION_TTL_SECONDS = Number(process.env.JWT_REFRESH_EXPIRATION) || 604800;
const REFRESH_SESSION_TTL_MS = REFRESH_SESSION_TTL_SECONDS * 1000;
const USER_IDENTITY_ENUM_CANDIDATES = ['userIdentity', 'userIdentity_new'];
const REQUIRED_USER_IDENTITY_VALUES = ['Student', 'Employee', 'Superior'];

/**
 * ─── PERMISSIONS REFACTORING ──────────────────────────────────────────────
 * 
 * MIGRATION: Unified Permission Type (BranchPermission)
 * 
 * This module has been refactored to use a unified BranchPermission type across
 * all permission queries and mutations. This ensures consistency and scalability.
 * 
 * BEFORE (Old Structure):
 *   type Permissions {
 *     is_admin: Boolean!
 *     is_staff: Boolean!
 *     emr_allow_view: Boolean!
 *     ... 20+ individual boolean fields
 *   }
 * 
 * AFTER (New Structure):
 *   type BranchPermission {
 *     key: String!           # Permission key (e.g., "emr_allow_view")
 *     label: String!         # Permission label (e.g., "ALLOW_TO_VIEW_EMR")
 *     enabled: Boolean!      # Whether permission is granted
 *     branch: Designation    # Branch assignment (Manila, QuezonCity, Both)
 *   }
 * 
 *   type Permissions {
 *     permissions: [BranchPermission!]!
 *     count: Int!
 *   }
 * 
 * BENEFITS:
 *   ✓ Scalable: Add new permissions without schema changes
 *   ✓ Consistent: Same format for StaffPermissions, Permissions, templates
 *   ✓ Branch-aware: Each permission has explicit branch assignment
 *   ✓ Maintainable: Single source of truth for permission structure
 * 
 * IMPACT:
 *   - SQL queries now use json_object_agg to map labels to branches
 *   - Helper function converts label->branch map to BranchPermission array
 *   - Permission checks use hasPermission() utility instead of direct property access
 *   - All StaffAccount queries return unified permission format
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Convert label->branch map to BranchPermission array format
 * @param {Object} labelToBranchMap - Map of label -> branch (from database query)
 * @returns {Array} Array of BranchPermission objects
 */
function labelsAndBranchesToBranchPermissions(labelToBranchMap) {
  const activePermissions = new Map(Object.entries(labelToBranchMap || {}));
  
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
  
  return permsList;
}

/**
 * Check if staff has a specific permission enabled
 * @param {Array} branchPermissions - Array of BranchPermission objects
 * @param {string} permissionKey - Permission key to check (e.g., 'is_staff')
 * @returns {boolean} True if permission is enabled
 */
function hasPermission(branchPermissions, permissionKey) {
  const perm = branchPermissions?.find(p => p.key === permissionKey);
  return perm?.enabled || false;
}

/**
 * Derive module-level permissions from a BranchPermission array (in-memory, no DB hit)
 * @param {Array} branchPermissions - Array of BranchPermission objects
 * @returns {{modules: Array<{moduleId: string, label: string, enabled: boolean}>, count: number}}
 */
function deriveModulePermissions(branchPermissions) {
  const enabledKeys = new Set();
  for (const p of branchPermissions) {
    if (p.enabled) {
      enabledKeys.add(p.key);
    }
  }

  const modules = [];
  for (const [moduleId, keys] of Object.entries(MODULE_PERMISSION_MAP)) {
    let enabled;
    if (keys.length === 0) {
      enabled = false;
    } else {
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

async function ensureUserIdentityEnumValues() {
  const enumTypesResult = await db.query(
    `SELECT typname
     FROM pg_type
     WHERE typtype = 'e'
       AND typname = ANY($1::text[])`,
    [USER_IDENTITY_ENUM_CANDIDATES]
  );

  const enumTypes = enumTypesResult.rows.map((row) => String(row.typname || ''));

  for (const enumType of enumTypes) {
    const labelsResult = await db.query(
      `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = $1`,
      [enumType]
    );

    const existingLabels = new Set(labelsResult.rows.map((row) => String(row.enumlabel || '')));

    for (const requiredValue of REQUIRED_USER_IDENTITY_VALUES) {
      if (existingLabels.has(requiredValue)) continue;

      // enumType is sourced from USER_IDENTITY_ENUM_CANDIDATES and pg_type, so this is safe.
      await db.query(`ALTER TYPE "${enumType}" ADD VALUE IF NOT EXISTS '${requiredValue}'`);
      existingLabels.add(requiredValue);
    }
  }
}

function normalizeOptionalScopeValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'all') return null;
  return normalized;
}

function normalizeMutableUserSessionRecord(record, expectedUserId) {
  const rawSession = record?.session;
  if (!rawSession || typeof rawSession !== 'object') {
    return null;
  }

  const key = String(record.key || '').trim();
  const keyParts = key.split(':');
  const keyUserId = keyParts[1];
  const keyDeviceId = keyParts[2];

  const resolvedUserId = String(rawSession.userId ?? keyUserId ?? '').trim();
  if (!resolvedUserId || resolvedUserId !== expectedUserId) {
    return null;
  }

  const status = String(rawSession.status || 'active').trim().toLowerCase();
  if (!['active', 'revoked'].includes(status)) {
    return null;
  }

  const ttlSeconds = Number(record.ttlSeconds) || 0;
  if (ttlSeconds <= 0) {
    return null;
  }

  const deviceId = String(rawSession.deviceId || keyDeviceId || '').trim();
  if (!deviceId) {
    return null;
  }

  const refreshToken = typeof rawSession.refreshToken === 'string'
    ? rawSession.refreshToken.trim()
    : '';
  if (!refreshToken) {
    return null;
  }

  return {
    sessionKey: key || `rt:${expectedUserId}:${deviceId}`,
    session: rawSession,
    deviceId,
    status,
    ttlSeconds,
  };
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

function toTimestampMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric > 1e12 ? numeric : numeric * 1000;
}

function getSessionExpirationMs(session) {
  const explicitExpiration = toTimestampMs(session?.exp);
  if (explicitExpiration) {
    return explicitExpiration;
  }

  const updatedAt = toTimestampMs(session?.updatedAt);
  const createdAt = toTimestampMs(session?.createdAt);
  const lastTouchedAt = updatedAt || createdAt;

  if (!lastTouchedAt) {
    return null;
  }

  return lastTouchedAt + REFRESH_SESSION_TTL_MS;
}

function normalizeActiveRefreshSession(session, nowMs) {
  if (!session || session.userId === undefined || session.userId === null) {
    return null;
  }

  const role = String(session.role || '').toLowerCase();
  if (role && role !== 'patient') {
    return null;
  }

  const status = String(session.status || 'active').toLowerCase();
  if (status !== 'active') {
    return null;
  }

  const expMs = getSessionExpirationMs(session);
  if (expMs && expMs <= nowMs) {
    return null;
  }

  return {
    userId: String(session.userId),
    deviceId: String(session.deviceId || 'unknown'),
    role: role || 'patient',
    expMs,
    createdAtMs: toTimestampMs(session.createdAt),
    updatedAtMs: toTimestampMs(session.updatedAt),
  };
}

function compareSessionsByRecencyDesc(a, b) {
  const expDelta = (b.expMs || 0) - (a.expMs || 0);
  if (expDelta !== 0) return expDelta;

  const updatedDelta = (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
  if (updatedDelta !== 0) return updatedDelta;

  const createdDelta = (b.createdAtMs || 0) - (a.createdAtMs || 0);
  if (createdDelta !== 0) return createdDelta;

  const userIdOrder = a.userId.localeCompare(b.userId, undefined, { numeric: true, sensitivity: 'base' });
  if (userIdOrder !== 0) return userIdOrder;

  return a.deviceId.localeCompare(b.deviceId, undefined, { numeric: true, sensitivity: 'base' });
}

function isSessionMoreRecent(candidate, current) {
  return compareSessionsByRecencyDesc(candidate, current) < 0;
}

async function getPatientEmailMap(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `SELECT uc.id::text AS "userId", uc.email
     FROM "UserCredentials" uc
     JOIN "Patients" p ON p.id = uc.id
     WHERE uc.id::text = ANY($1::text[])`,
    [userIds]
  );

  return new Map(
    result.rows.map((row) => [String(row.userId), row.email || 'unknown'])
  );
}

async function getActivePatientRefreshSessions() {
  const nowMs = Date.now();
  const allSessions = await scanAllRefreshSessions();
  const normalized = allSessions
    .map((session) => normalizeActiveRefreshSession(session, nowMs))
    .filter(Boolean);

  const candidateUserIds = [...new Set(normalized.map((session) => session.userId))];
  const patientEmails = await getPatientEmailMap(candidateUserIds);

  return normalized
    .filter((session) => patientEmails.has(session.userId))
    .map((session) => ({
      ...session,
      email: patientEmails.get(session.userId) || 'unknown',
    }));
}

async function getUserEmailMap(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `SELECT uc.id::text AS "userId", uc.email
     FROM "UserCredentials" uc
     WHERE uc.id::text = ANY($1::text[])`,
    [userIds]
  );

  return new Map(
    result.rows.map((row) => [String(row.userId), row.email || 'unknown'])
  );
}

function normalizeScannedRefreshSession(record, nowMs) {
  if (!record || !record.session) {
    return null;
  }

  const ttlSeconds = Number(record.ttlSeconds);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return null;
  }

  const rawSession = record.session;
  const key = String(record.key || '');
  const parts = key.split(':');
  const keyUserId = parts[1];
  const keyDeviceId = parts[2];

  const sessionRefreshToken = typeof rawSession.refreshToken === 'string'
    ? rawSession.refreshToken.trim()
    : '';

  if (!sessionRefreshToken) {
    return null;
  }

  const userIdRaw = rawSession.userId ?? keyUserId;
  if (userIdRaw === undefined || userIdRaw === null || userIdRaw === '') {
    return null;
  }

  const status = String(rawSession.status || 'active').toLowerCase();
  if (status !== 'active') {
    return null;
  }

  const expMs = getSessionExpirationMs(rawSession) || (nowMs + ttlSeconds * 1000);
  if (!Number.isFinite(expMs) || expMs <= nowMs) {
    return null;
  }

  const updatedAtMs = toTimestampMs(rawSession.updatedAt);
  const createdAtMs = toTimestampMs(rawSession.createdAt);
  const lastActiveMs = updatedAtMs || createdAtMs || expMs;

  const deviceId = String(rawSession.deviceId || keyDeviceId || 'unknown');
  const userId = String(userIdRaw);

  return {
    sessionId: String(rawSession.sessionId || `${userId}:${deviceId}`),
    userId,
    deviceId,
    refreshToken: sessionRefreshToken,
    ttlSeconds,
    lastActiveMs,
    status,
    role: String(rawSession.role || 'unknown').toLowerCase(),
    expMs,
    createdAtMs,
    updatedAtMs,
  };
}

function getSessionActivityMs(session) {
  const updatedAtMs = Number(session?.updatedAtMs);
  if (Number.isFinite(updatedAtMs) && updatedAtMs > 0) {
    return updatedAtMs;
  }

  const createdAtMs = Number(session?.createdAtMs);
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    return createdAtMs;
  }

  const expMs = Number(session?.expMs);
  if (Number.isFinite(expMs) && expMs > 0) {
    const inferredIssuedAtMs = expMs - REFRESH_SESSION_TTL_MS;
    return inferredIssuedAtMs > 0 ? inferredIssuedAtMs : null;
  }

  return null;
}

async function getActiveRefreshSessionsAcrossUsers({ includeEmails = false } = {}) {
  const nowMs = Date.now();
  const scannedSessions = await scanAllRefreshSessionsWithMeta();
  logger.debug(
    `Scanned ${scannedSessions.length} refresh sessions from Redis.`,
    { sessions: scannedSessions.slice(0, 5) } // show first 5
  );
  
  const normalizedSessions = scannedSessions
    .map((record) => normalizeScannedRefreshSession(record, nowMs))
    .filter(Boolean);

  if (!includeEmails || normalizedSessions.length === 0) {
    return normalizedSessions;
  }

  logger.info(`Identified ${normalizedSessions.length} active refresh sessions after normalization. Fetching user emails...`);
  const candidateUserIds = [...new Set(normalizedSessions.map((session) => session.userId))];
  const emailMap = await getUserEmailMap(candidateUserIds);

  return normalizedSessions.map((session) => ({
    ...session,
    email: emailMap.get(session.userId) || 'unknown',
  }));
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const Query = {
  _listStaffAccounts: async (_, { status, location }, { user, res }) => {
    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         mp.designation AS branch,
         mp.is_active,
         mp.role AS personnel_role,
         COALESCE(json_object_agg(rt.label, rm.branch) FILTER (WHERE rt.label IS NOT NULL), '{}'::json) AS label_branch_map,
         lla.last_login
       FROM "UserCredentials" uc
       JOIN "UsersPersonal" up ON up.id = uc.id
       JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
       LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       LEFT JOIN (
         SELECT user_id, MAX(attempted_at) AS last_login
         FROM "UserLoginAttempt"
         WHERE was_successful = true
         GROUP BY user_id
       ) lla ON lla.user_id = uc.id
       WHERE
          ($1::"CredentialStatus" IS NULL OR uc.credentials_status = $1::"CredentialStatus")
          AND ($2::"UserDesignation" IS NULL OR mp.designation = $2::"UserDesignation")
       GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
                up.first_name, up.middle_name, up.last_name, mp.designation,
                mp.is_active, mp.role, lla.last_login
       ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST`,
      [status || null, location || null]
    );

    const staff = result.rows.map((row) => {
      const labelBranchMap = typeof row.label_branch_map === 'string' 
        ? JSON.parse(row.label_branch_map) 
        : row.label_branch_map || {};
      
      const branchPermissions = labelsAndBranchesToBranchPermissions(labelBranchMap);

      let staffStatus;
      if (row.is_active) {
        staffStatus = 'Active';
      } else {
        staffStatus = 'Suspended';
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
        role: row.personnel_role || null,
        branch: row.branch || 'Both',
        identity: row.identity,
        status: staffStatus,
        permissions: {
          permissions: branchPermissions,
          count: branchPermissions.length
        },
        modulePermissions: deriveModulePermissions(branchPermissions),
        credentialsStatus: row.credentials_status,
        lastLogin: row.last_login
          ? new Date(row.last_login).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null,
      };
    });

    return { staff, count: staff.length };
  },

  _getStaffAccount: async (_, { userId }, { user, res }) => {
    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         mp.designation AS branch,
         mp.is_active,
         mp.role AS personnel_role,
         COALESCE(json_object_agg(rt.label, rm.branch) FILTER (WHERE rt.label IS NOT NULL), '{}'::json) AS label_branch_map,
         lla.last_login
       FROM "UserCredentials" uc
       JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       LEFT JOIN "UsersPersonal" up ON up.id = uc.id
       LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
       LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       LEFT JOIN (
         SELECT user_id, MAX(attempted_at) AS last_login
         FROM "UserLoginAttempt"
         WHERE was_successful = true
         GROUP BY user_id
       ) lla ON lla.user_id = uc.id
       WHERE uc.id = $1
       GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
                up.first_name, up.middle_name, up.last_name, mp.designation,
                mp.is_active, mp.role, lla.last_login`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const labelBranchMap = typeof row.label_branch_map === 'string' 
      ? JSON.parse(row.label_branch_map) 
      : row.label_branch_map || {};
    
    const branchPermissions = labelsAndBranchesToBranchPermissions(labelBranchMap);

    let staffStatus;
    if (row.is_active) {
      staffStatus = 'Active';
    } else {
      staffStatus = 'Suspended';
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
      role: row.personnel_role || null,
      branch: row.branch || 'Both',
      identity: row.identity,
      status: staffStatus,
      permissions: {
        permissions: branchPermissions,
        count: branchPermissions.length
      },
      modulePermissions: deriveModulePermissions(branchPermissions),
      credentialsStatus: row.credentials_status,
      lastLogin: row.last_login
        ? new Date(row.last_login).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : null,
    };
  },

  _searchUsers: async (_, { query, mdsOnly }, { user, res }) => {
    if (!query || query.trim().length < 2) {
      throwGraphQLError(res).message('Search query must be at least 2 characters.').status(400).throw();
    }

    const searchTerm = `%${query.trim()}%`;

    // Strictly search Employee identity only (Students excluded, Medical are already staff)
    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         up.identifier,
         CASE WHEN mp.id IS NOT NULL THEN true ELSE false END AS is_medical_personnel
       FROM "UserCredentials" uc
       JOIN "UsersPersonal" up ON up.id = uc.id
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       WHERE
         uc.identity = 'Employee'
         AND ($3::boolean IS NOT TRUE OR uc.email LIKE '%.mds@tip.edu.ph')
         AND (
           uc.email ILIKE $1
           OR up.first_name ILIKE $1
           OR up.last_name ILIKE $1
           OR CONCAT(up.first_name, ' ', up.last_name) ILIKE $1
           OR CONCAT(up.first_name, ' ', up.middle_name, ' ', up.last_name) ILIKE $1
           OR CAST(up.identifier AS TEXT) ILIKE $1
           OR CAST(uc.id AS TEXT) = $2
         )
       ORDER BY up.last_name, up.first_name
       LIMIT 20`,
      [searchTerm, query.trim(), mdsOnly || false]
    );

    const users = result.rows.map(row => {
      const nameParts = [row.first_name, row.middle_name, row.last_name].filter(Boolean);
      return {
        id: String(row.id),
        email: row.email,
        name: nameParts.join(' ') || row.email,
        identity: row.identity,
        credentialsStatus: row.credentials_status,
        isMedicalPersonnel: row.is_medical_personnel,
      };
    });

    return { users, count: users.length };
  },

  _listMedicalPersonnel: async (_, { role, designation, isActive }, { user, res }) => {
    const result = await db.query(
      `SELECT
         mp.id, mp.role, mp.title, mp.designation, mp.is_active,
         uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       JOIN "UsersPersonal" up ON up.id = mp.id
       WHERE
         ($1::text IS NULL OR mp.role = $1)
         AND ($2::"UserDesignation" IS NULL OR mp.designation = $2::"UserDesignation")
         AND ($3::boolean IS NULL OR mp.is_active = $3::boolean)
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
    return await getStaffPermissions(userId);
  },

  _getStaffModulePermissions: async (_, { userId }, { user, res }) => {
    return await getStaffModulePermissions(userId);
  },

  _listUsers: async (_, { offset = 0, limit, search, branch, type, status, includeUnverified = false }, { user, res }) => {
    if (offset < 0) {
      throwGraphQLError(res).message('offset must be >= 0').status(400).throw();
    }

    if (limit < 1 || limit > 500) {
      throwGraphQLError(res).message('limit must be between 1 and 500').status(400).throw();
    }

    const normalizeOptionalFilter = (value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalized = value.trim();
      if (!normalized || normalized.toLowerCase() === 'all') {
        return null;
      }

      return normalized;
    };

    const normalizedBranch = normalizeOptionalFilter(branch);
    const normalizedType = normalizeOptionalFilter(type);
    const normalizedStatus = normalizeOptionalFilter(status);
    const normalizedSearch = normalizeOptionalFilter(search);
    const shouldIncludeUnverified = Boolean(includeUnverified);
    const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : null;

    const listResult = await db.query(
      `SELECT
         uc.id::text AS id,
         uc.email,
         COALESCE(uc.identity::text, 'Unknown') AS type,
         COALESCE(uc.credentials_status::text, 'Unknown') AS status,
         up.branch::text AS branch,
         NULLIF(
           TRIM(CONCAT_WS(
             ' ',
             up.first_name,
             CASE
               WHEN up.middle_name IS NOT NULL AND up.middle_name <> '' THEN LEFT(up.middle_name, 1) || '.'
               ELSE NULL
             END,
             up.last_name,
             up.suffix
           )),
           ''
         ) AS name,
         lla.last_login
       FROM "UserCredentials" uc
       LEFT JOIN "UsersPersonal" up ON up.id = uc.id
       LEFT JOIN (
         SELECT user_id, MAX(attempted_at) AS last_login
         FROM "UserLoginAttempt"
         WHERE was_successful = true
         GROUP BY user_id
       ) lla ON lla.user_id = uc.id
       WHERE
         ($3::text IS NULL OR LOWER(COALESCE(up.branch::text, '')) = LOWER($3))
         AND ($4::text IS NULL OR LOWER(COALESCE(uc.identity::text, '')) = LOWER($4))
         AND ($5::text IS NULL OR LOWER(COALESCE(uc.credentials_status::text, '')) = LOWER($5))
         AND (
           $7::boolean = true
           OR LOWER(COALESCE(uc.credentials_status::text, '')) <> 'unverified'
           OR LOWER(COALESCE($5::text, '')) = 'unverified'
         )
         AND (
           $6::text IS NULL
           OR uc.email ILIKE $6
           OR uc.id::text ILIKE $6
           OR TRIM(CONCAT_WS(
             ' ',
             up.first_name,
             CASE
               WHEN up.middle_name IS NOT NULL AND up.middle_name <> '' THEN LEFT(up.middle_name, 1) || '.'
               ELSE NULL
             END,
             up.last_name,
             up.suffix
           )) ILIKE $6
         )
       ORDER BY uc.id DESC
       OFFSET $1
       LIMIT $2`,
      [offset, limit, normalizedBranch, normalizedType, normalizedStatus, searchPattern, shouldIncludeUnverified]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total_count
       FROM "UserCredentials" uc
       LEFT JOIN "UsersPersonal" up ON up.id = uc.id
       WHERE
         ($1::text IS NULL OR LOWER(COALESCE(up.branch::text, '')) = LOWER($1))
         AND ($2::text IS NULL OR LOWER(COALESCE(uc.identity::text, '')) = LOWER($2))
         AND ($3::text IS NULL OR LOWER(COALESCE(uc.credentials_status::text, '')) = LOWER($3))
         AND (
           $5::boolean = true
           OR LOWER(COALESCE(uc.credentials_status::text, '')) <> 'unverified'
           OR LOWER(COALESCE($3::text, '')) = 'unverified'
         )
         AND (
           $4::text IS NULL
           OR uc.email ILIKE $4
           OR uc.id::text ILIKE $4
           OR TRIM(CONCAT_WS(
             ' ',
             up.first_name,
             CASE
               WHEN up.middle_name IS NOT NULL AND up.middle_name <> '' THEN LEFT(up.middle_name, 1) || '.'
               ELSE NULL
             END,
             up.last_name,
             up.suffix
           )) ILIKE $4
         )`,
      [normalizedBranch, normalizedType, normalizedStatus, searchPattern, shouldIncludeUnverified]
    );

    const users = listResult.rows.map((row) => {
      const resolvedStatus = String(row.status || 'Unknown');
      const resolvedName = String(row.name || '').trim();
      const isUnverified = resolvedStatus.toLowerCase() === 'unverified' || !resolvedName;

      return {
        id: String(row.id),
        // Name is sourced from UsersPersonal only. Unverified users use a fixed placeholder.
        name: isUnverified ? 'Unverified User' : resolvedName,
        // Email is sourced from UserCredentials.email.
        email: row.email || '--',
        // Branch is sourced from UsersPersonal.branch only.
        branch: row.branch || '--',
        type: row.type || 'Unknown',
        status: resolvedStatus,
        // Last login is sourced from UserLoginAttempt successful attempts only.
        lastLogin: row.last_login ? new Date(row.last_login).toISOString() : null,
      };
    });

    return {
      users,
      totalCount: Number(countResult.rows?.[0]?.total_count) || 0,
    };
  },

  _listStaffSessions: async (_, { userId }, { user, res }) => {
    // Get all refresh sessions for this user from Redis
    const sessions = await listUserSessions(String(userId));
    const currentAnchor = await getStaffAnchor(String(userId));

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

  _countActiveRefreshTokens: async (_, __, { user, res }) => {
    const activeSessions = await getActiveRefreshSessionsAcrossUsers();
    return activeSessions.length;
  },

  _countActiveUsersInDays: async (_, { days }, { user, res }) => {
    const normalizedDays = Number(days);

    if (!Number.isInteger(normalizedDays) || normalizedDays < 1 || normalizedDays > 365) {
      throwGraphQLError(res).message('days must be an integer between 1 and 365').status(400).throw();
    }

    const cutoffMs = Date.now() - normalizedDays * 24 * 60 * 60 * 1000;
    const activeSessions = await getActiveRefreshSessionsAcrossUsers();
    const activeUserIds = new Set();

    for (const session of activeSessions) {
      const activityMs = getSessionActivityMs(session);
      if (Number.isFinite(activityMs) && activityMs >= cutoffMs) {
        activeUserIds.add(String(session.userId));
      }
    }

    return activeUserIds.size;
  },

  _countMaxActiveUsersInHours: async (_, { hours }, { user, res }) => {
    const normalizedHours = Number(hours);

    if (!Number.isInteger(normalizedHours) || normalizedHours < 6 || normalizedHours > 72) {
      throwGraphQLError(res).message('hours must be an integer between 6 and 72').status(400).throw();
    }

    const nowMs = Date.now();
    const windowEndMs = nowMs + normalizedHours * 60 * 60 * 1000;
    const activeSessions = await getActiveRefreshSessionsAcrossUsers();
    const activeUserIds = new Set();

    for (const session of activeSessions) {
      const expMs = Number(session?.expMs);
      if (Number.isFinite(expMs) && expMs > nowMs && expMs <= windowEndMs) {
        activeUserIds.add(String(session.userId));
      }
    }

    return activeUserIds.size;
  },

  _listAllSessions: async (_, { offset = 0, limit }, { user, res }) => {
    if (offset < 0) {
      throwGraphQLError(res).message('offset must be >= 0').status(400).throw();
    }
    if (limit < 1 || limit > 100) {
      throwGraphQLError(res).message('limit must be between 1 and 100').status(400).throw();
    }

    const activeSessions = await getActiveRefreshSessionsAcrossUsers({ includeEmails: true });

    const groupedByUser = new Map();

    for (const session of activeSessions) {
      const userId = String(session.userId || 'unknown');
      const existing = groupedByUser.get(userId);

      if (!existing) {
        groupedByUser.set(userId, {
          userId,
          email: session.email || 'unknown',
          role: session.role || 'unknown',
          numberOfSessions: 1,
          latestSession: session,
        });
        continue;
      }

      existing.numberOfSessions += 1;
      if (!existing.email || existing.email === 'unknown') {
        existing.email = session.email || existing.email;
      }
      if (!existing.role || existing.role === 'unknown') {
        existing.role = session.role || existing.role;
      }

      if (isSessionMoreRecent(session, existing.latestSession)) {
        existing.latestSession = session;
      }
    }

    const sortedUsers = Array.from(groupedByUser.values()).sort((left, right) => {
      return compareSessionsByRecencyDesc(left.latestSession, right.latestSession);
    });

    const totalCount = sortedUsers.length;

    const sessions = sortedUsers
      .slice(offset, offset + limit)
      .map((entry) => {
        const latest = entry.latestSession;

        return {
          sessionId: latest.sessionId,
          userId: entry.userId,
          device: latest.deviceId,
          refreshToken: latest.refreshToken || '',
          ttlSeconds: Number(latest.ttlSeconds) || 0,
          numberOfSessions: Number(entry.numberOfSessions) || 0,
          lastActive: latest.lastActiveMs,
          status: latest.status,
          email: entry.email || 'unknown',
          role: entry.role || 'unknown',
          exp: latest.expMs,
        };
      });

    return {
      sessions,
      totalCount,
    };
  },

  _listUserSessions: async (_, { userId, offset = 0, limit = 10 }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    if (offset < 0) {
      throwGraphQLError(res).message('offset must be >= 0').status(400).throw();
    }

    if (limit < 1 || limit > 100) {
      throwGraphQLError(res).message('limit must be between 1 and 100').status(400).throw();
    }

    const normalizedUserId = String(userId);
    const sessionRecords = await listUserSessionsWithMeta(normalizedUserId);
    const nowMs = Date.now();

    const dedupedSessions = new Map();

    for (const record of sessionRecords) {
      const rawSession = record?.session;
      if (!rawSession || typeof rawSession !== 'object') {
        continue;
      }

      const key = String(record.key || '');
      const keyParts = key.split(':');
      const keyUserId = keyParts[1];
      const keyDeviceId = keyParts[2];

      const resolvedUserId = String(rawSession.userId ?? keyUserId ?? '');
      if (!resolvedUserId || resolvedUserId !== normalizedUserId) {
        continue;
      }

      const status = String(rawSession.status || 'active').toLowerCase();
      if (!['active', 'revoked'].includes(status)) {
        continue;
      }

      const ttlSeconds = Number(record.ttlSeconds) || 0;
      if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        continue;
      }

      const deviceId = String(rawSession.deviceId || keyDeviceId || 'unknown');
      const refreshToken = typeof rawSession.refreshToken === 'string'
        ? rawSession.refreshToken.trim()
        : '';

      if (!refreshToken) {
        continue;
      }

      const createdAtMs = toTimestampMs(rawSession.createdAt);
      const updatedAtMs = toTimestampMs(rawSession.updatedAt);
      const expMs = getSessionExpirationMs(rawSession) || (nowMs + ttlSeconds * 1000);
      const sortMs = updatedAtMs || createdAtMs || expMs || 0;

      const mappedSession = {
        deviceId,
        refreshToken,
        status,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
        updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
        ttlSeconds,
        expiresAt: Number.isFinite(expMs) && expMs > 0 ? new Date(expMs).toISOString() : null,
        _sortMs: sortMs,
      };

      const dedupeKey = `${deviceId}:${refreshToken}`;
      const existing = dedupedSessions.get(dedupeKey);

      if (!existing || sortMs > (existing._sortMs || 0)) {
        dedupedSessions.set(dedupeKey, mappedSession);
      }
    }

    const sessions = Array.from(dedupedSessions.values())
      .sort((left, right) => (right._sortMs || 0) - (left._sortMs || 0))
      .map(({ _sortMs, ...session }) => session);

    return sessions.slice(offset, offset + limit);
  },

  _listUserLoginAttempts: async (_, { userId, offset = 0, limit = 10 }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    if (offset < 0) {
      throwGraphQLError(res).message('offset must be >= 0').status(400).throw();
    }

    if (limit < 1 || limit > 100) {
      throwGraphQLError(res).message('limit must be between 1 and 100').status(400).throw();
    }

    const result = await db.query(
      `SELECT
         attempted_at,
         was_successful,
         ip_address,
         user_agent
       FROM "UserLoginAttempt"
       WHERE user_id = $1
       ORDER BY attempted_at DESC
       OFFSET $2
       LIMIT $3`,
      [userId, offset, limit]
    );

    return result.rows.map((row) => ({
      timestamp: row.attempted_at ? new Date(row.attempted_at).toISOString() : new Date(0).toISOString(),
      ip: row.ip_address || 'N/A',
      device: row.user_agent || 'Unknown Device',
      status: row.was_successful ? 'Success' : 'Failed',
    }));
  },

  _listPermissionTemplates: async (_, __, { user, res }) => {
    return await listPermissionTemplates();
  },

  _getPermissionTemplate: async (_, { templateId }, { user, res }) => {
    return await getPermissionTemplate(templateId);
  },
};

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const Mutation = {
  _createMedicalPersonnel: async (_, { input }, { user, res }) => {
    const { userId, title, role, designation, templateId } = input;

    // Validate required fields
    if (!userId || !title || !role || !designation) {
      throwGraphQLError(res).message('userId, title, role, and designation are required.').status(400).throw();
    }

    // Validate designation
    const validDesignations = ['Manila', 'QuezonCity', 'Both'];
    if (!validDesignations.includes(designation)) {
      throwGraphQLError(res).message('designation must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // Role is now a free-form string - no validation needed
    // It can match a template label or be any custom role name

    // ⚠️ SECURITY: Block direct Admin role assignment - only transfers allowed
    if (role === 'Admin') {
      throwGraphQLError(res)
        .message('Cannot directly assign Admin role. Admin privileges can only be granted through Admin Transfer.')
        .status(403)
        .throw();
    }

    // Validate that role matches an existing template label
    const templatesResult = await listPermissionTemplates();
    const matchingTemplate = templatesResult.templates.find(t => t.label === role);
    if (!matchingTemplate && !templateId) {
      throwGraphQLError(res)
        .message(`Role "${role}" does not match any existing Role Template. Only roles from Role Templates can be assigned.`)
        .status(400)
        .throw();
    }

    // If no templateId provided, auto-select the matching template
    const effectiveTemplateId = templateId || matchingTemplate?.id;

    // Use client for transaction
    const client = await db.db().connect();
    try {
      await client.query('BEGIN');

      // Verify user exists and has Employee identity
      const userResult = await client.query(
        `SELECT uc.id, md.id AS "medicalId", uc.identity FROM "UserCredentials" uc
        LEFT JOIN "MedicalPersonnel" md ON md.id = uc.id
        WHERE uc.id = $1
        LIMIT 1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message('User not found.').status(404).throw();
      }

      const targetUser = userResult.rows[0];
      if (targetUser.identity !== 'Employee') {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message('Only Employee accounts can be elevated to Staff. Students and other identities are not eligible.')
          .status(409)
          .throw();
      }

      if (targetUser.medicalId) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message('MedicalPersonnel record already exists for this user.').status(409).throw();
      }

      // Insert MedicalPersonnel record
      const insertResult = await client.query(
        `INSERT INTO "MedicalPersonnel" (id, role, title, designation, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [userId, role, title, designation]
      );

      const personnel = insertResult.rows[0];

      // Grant is_staff permission
      await setStaffPermissionsExtended({
        personnelId: String(userId),
        permissionsList: [{ key: 'is_staff', enabled: true }],
        assignedBy: String(user.id),
        defaultBranch: designation,
        client  // Pass client for transaction participation
      });

      // If template provided, apply permissions from template
      if (effectiveTemplateId) {
        await applyTemplateToStaff({
          personnelId: userId,
          templateId: effectiveTemplateId,
          assignedBy: user.id,
          staffBranch: designation,  // Staff's branch - all permissions inherit this
          client  // Pass client for transaction participation
        });
        logger.info(`Template ${effectiveTemplateId} applied to new medical personnel: userId=${userId}, staffBranch=${designation}`);
      }

      await client.query('COMMIT');

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
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating MedicalPersonnel: ${error.message}`);
      throwGraphQLError(res).message(error.message || 'Failed to create MedicalPersonnel record.').status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateMedicalPersonnel: async (_, { userId, input }, { user, res }) => {
    const { title, role, designation, isActive, templateId } = input;

    // Validate at least one field provided
    if (title === undefined && role === undefined && designation === undefined && isActive === undefined && templateId === undefined) {
      throwGraphQLError(res)
        .message('At least one field (title, role, designation, isActive, templateId) must be provided.')
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

    // If templateId provided, verify template exists
    if (templateId !== undefined) {
      const template = await getPermissionTemplate(templateId);
      if (!template) {
        throwGraphQLError(res).message('Permission template not found.').status(404).throw();
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
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
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

    // If designation changed, update branch in location-specific permissions
    // BUT: Don't override 'Both' permissions since they apply across all locations
    if (designation !== undefined) {
      await db.query(
        `UPDATE "rolesMap"
         SET branch = $1::"UserDesignation"
         WHERE "personnelId" = $2
           AND branch != 'Both'`,
        [designation, userId]
      );
      logger.info(`Updated branch to "${designation}" for location-specific permissions of userId=${userId} (preserved 'Both' permissions)`);
    }

    // If template provided, apply permissions from template
    if (templateId !== undefined) {
      try {
        await applyTemplateToStaff({
          personnelId: userId,
          templateId,
          assignedBy: user.id,
          staffBranch: personnel.designation  // Use the staff's branch - all permissions inherit this
        });
        logger.info(`Template ${templateId} applied to medical personnel: userId=${userId}, staffBranch=${personnel.designation}`);
      } catch (error) {
        logger.error(`Failed to apply template during update: ${error.message}`);
        // Continue - personnel updated but template not applied
      }
    }

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
    const client = await db.db().connect();
    try {
      await client.query('BEGIN');

      // Verify MedicalPersonnel record exists
      const existingResult = await client.query(
        `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
        [userId]
      );

      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message('MedicalPersonnel record not found.').status(404).throw();
      }

      // Delete all permissions (rolesMap entries) for this staff
      await clearMedicalPermits(String(userId), client);

      // Delete MedicalPersonnel record
      await client.query(
        `DELETE FROM "MedicalPersonnel" WHERE id = $1`,
        [userId]
      );

      // Revert identity to Employee
      if (revertIdentity) {
        await client.query(
          `UPDATE "UserCredentials" SET identity = 'Employee' WHERE id = $1`,
          [userId]
        );
      }

      await client.query('COMMIT');

      logger.info(`MedicalPersonnel record deleted: userId=${userId}, identityReverted=${revertIdentity}, by adminId=${user.id}`);

      return {
        ok: true,
        message: 'MedicalPersonnel record deleted successfully.',
        identityReverted: revertIdentity
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting MedicalPersonnel: ${error.message}`);
      throwGraphQLError(res).message(error.message || 'Failed to delete MedicalPersonnel record.').status(500).throw();
    } finally {
      client.release();
    }
  },

  _setStaffPermissionsStandard: async (_, { userId, permissions: permissionsList, branch }, { user, res }) => {
    // Validate branch (required for standard)
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      throwGraphQLError(res).message('branch must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // ⚠️ SECURITY: Block IS_ADMIN assignment - only transfers allowed
    for (const perm of permissionsList) {
      if (perm.key === 'is_admin' && perm.enabled) {
        throwGraphQLError(res)
          .message('Cannot directly assign IS_ADMIN permission. Admin privileges can only be granted through Admin Transfer.')
          .status(403)
          .throw();
      }
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
    // Validate defaultBranch
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (defaultBranch && !validBranches.includes(defaultBranch)) {
      throwGraphQLError(res).message('defaultBranch must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // Validate each permission's branch if provided
    for (const perm of permissionsList) {
      // ⚠️ SECURITY: Block IS_ADMIN assignment - only transfers allowed
      if (perm.key === 'is_admin' && perm.enabled) {
        throwGraphQLError(res)
          .message('Cannot directly assign IS_ADMIN permission. Admin privileges can only be granted through Admin Transfer.')
          .status(403)
          .throw();
      }

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

  _setStaffModulePermissions: async (_, { userId, modules, branch }, { user, res }) => {
    // Validate branch
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      throwGraphQLError(res).message('branch must be Manila, QuezonCity, or Both.').status(400).throw();
    }

    // Validate module IDs
    for (const mod of modules) {
      if (!MODULE_PERMISSION_MAP.hasOwnProperty(mod.moduleId)) {
        throwGraphQLError(res)
          .message(`Invalid module ID: "${mod.moduleId}".`)
          .status(400)
          .throw();
      }
    }

    // ⚠️ SECURITY: Block roleManagement module assignment - only transfers allowed
    const rmModule = modules.find(m => m.moduleId === 'roleManagement');
    if (rmModule && rmModule.enabled) {
      throwGraphQLError(res)
        .message('Cannot directly assign Admin/roleManagement privileges. Admin privileges can only be granted through Admin Transfer.')
        .status(403)
        .throw();
    }

    try {
      await setStaffModulePermissions({
        personnelId: String(userId),
        modules,
        assignedBy: String(user.id),
        branch,
      });

      logger.info(`Staff module permissions set: userId=${userId}, branch=${branch}, by adminId=${user.id}`);

      return {
        ok: true,
        message: 'Staff module permissions updated successfully.',
      };
    } catch (error) {
      logger.error(`Failed to set module permissions: ${error.message}`);
      throwGraphQLError(res)
        .message(`Failed to set module permissions: ${error.message}`)
        .status(500)
        .throw();
    }
  },

  /**
   * Combined update for module permissions and/or account status.
   * - modules: optional array of module toggles (auto-detects branch from MedicalPersonnel.designation)
   * - status: optional Active/Suspended toggle
   * This replaces the REST PUT /admin/staff/accounts/:id endpoint.
   */
  _updateStaffAccount: async (_, { userId, status, role, templateId, designation }, { user, res }) => {
    if (!status && !role && !designation) {
      throwGraphQLError(res)
        .message('At least one of status, role, or designation must be provided.')
        .status(400)
        .throw();
    }

    // Verify target user exists and is medical staff
    const userResult = await db.query(
      `SELECT uc.id, mp.designation, mp.is_active, mp.role
       FROM "UserCredentials" uc
       JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       WHERE uc.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throwGraphQLError(res).message('Staff account not found.').status(404).throw();
    }

    const targetUser = userResult.rows[0];
    const branch = targetUser.designation || 'Both';
    const previousRole = targetUser.role || null;
    const previousBranch = branch;

    // Perform all validations BEFORE starting transaction

    // Handle role change validations
    if (role) {
      // Admin accounts cannot have their role changed (only via admin transfer)
      const { permitted } = await isMedicalPermitted(userId, permissions.is_admin);
      if (permitted) {
        throwGraphQLError(res)
          .message('Admin role cannot be changed directly. Use Admin Transfer instead.')
          .status(403)
          .throw();
      }

      // ⚠️ SECURITY: Block direct Admin role assignment - only transfers allowed
      if (role === 'Admin') {
        throwGraphQLError(res)
          .message('Cannot directly assign Admin role. Admin privileges can only be granted through Admin Transfer.')
          .status(403)
          .throw();
      }

      // Validate that the role matches an existing template label
      const templatesResult = await listPermissionTemplates();
      const matchingTemplate = templatesResult.templates.find(t => t.label === role);
      if (!matchingTemplate && !templateId) {
        throwGraphQLError(res)
          .message(`Role "${role}" does not match any existing Role Template. Only roles from Role Templates can be assigned.`)
          .status(400)
          .throw();
      }
    }

    // Handle status change validations
    if (status) {
      // Admin accounts cannot be deactivated — only admin transfer can change admin control
      const { permitted } = await isMedicalPermitted(userId, permissions.is_admin);
      if (permitted && status === 'Suspended') {
        throwGraphQLError(res)
          .message('Admin account cannot be deactivated. Use Admin Transfer to change admin control.')
          .status(403)
          .throw();
      }

      const validStatuses = ['Active', 'Suspended'];
      if (!validStatuses.includes(status)) {
        throwGraphQLError(res)
          .message(`Invalid status: "${status}". Must be Active or Suspended.`)
          .status(400)
          .throw();
      }
    }

    // Handle designation validation
    if (designation) {
      const validDesignations = ['Manila', 'QuezonCity', 'Both'];
      if (!validDesignations.includes(designation)) {
        throwGraphQLError(res)
          .message('designation must be Manila, QuezonCity, or Both.')
          .status(400)
          .throw();
      }
    }

    // START TRANSACTION FOR ALL DATABASE UPDATES
    const client = await db.db().connect();
    try {
      await client.query('BEGIN');

      // Handle role change
      if (role) {
        // Update MedicalPersonnel.role
        await client.query(
          `UPDATE "MedicalPersonnel" SET role = $1 WHERE id = $2`,
          [role, userId]
        );

        // Clear existing permissions (clean slate for new role)
        await clearMedicalPermits(String(userId), client);

        // Apply template permissions
        const effectiveTemplateId = templateId || (await listPermissionTemplates()).templates.find(t => t.label === role)?.id;
        if (effectiveTemplateId) {
          await applyTemplateToStaff({
            personnelId: userId,
            templateId: effectiveTemplateId,
            assignedBy: user.id,
            staffBranch: branch,  // Use staff's current branch - all permissions inherit this
            client  // Pass client for transaction participation
          });
        }

        // Always ensure is_staff permission is set
        await setStaffPermissionsExtended({
          personnelId: String(userId),
          permissionsList: [{ key: 'is_staff', enabled: true }],
          assignedBy: String(user.id),
          defaultBranch: branch,
          client  // Pass client for transaction participation
        });

        logger.info(`Staff role changed to "${role}" for userId=${userId} by adminId=${user.id}`);
      }

      // Handle status change (Active ↔ Suspended)
      if (status) {
        if (status === 'Active' && !targetUser.is_active) {
          await client.query(
            `UPDATE "MedicalPersonnel" SET is_active = true WHERE id = $1`,
            [userId]
          );
          logger.info(`Staff account activated: userId=${userId} by adminId=${user.id}`);
        } else if (status === 'Suspended' && targetUser.is_active) {
          await client.query(
            `UPDATE "MedicalPersonnel" SET is_active = false WHERE id = $1`,
            [userId]
          );

          // Save new anchor in Redis AFTER transaction commits (non-critical)
          // Will be done in finally or after COMMIT
          logger.info(`Staff account suspended: userId=${userId} by adminId=${user.id}`);
        }
      }

      // Handle designation (branch) change
      if (designation) {
        await client.query(
          `UPDATE "MedicalPersonnel" SET designation = $1 WHERE id = $2`,
          [designation, userId]
        );

        // Update branch in location-specific permissions only (preserve 'Both')
        await client.query(
          `UPDATE "rolesMap"
           SET branch = $1::"UserDesignation"
           WHERE "personnelId" = $2`,
          [designation, userId]
        );

        logger.info(`Staff branch changed to "${designation}" for userId=${userId} by adminId=${user.id}`);
      }

      await client.query('COMMIT');

      // If status was Suspended, save new anchor AFTER successful transaction
      if (status === 'Suspended' && targetUser.is_active) {
        await saveStaffAnchor(userId, generateUUID());
      }

      logger.info(`Staff account updated: userId=${userId}, by adminId=${user.id}`);

      // Fetch and return the updated staff account to avoid a round-trip on the frontend
      const updatedStaff = await Query._getStaffAccount(_, { userId }, { user, res });

      // Notify the affected staff account only when role or branch changed.
      // Emission is user-scoped via the user:{id} socket room.
      const updatedRole = updatedStaff?.role ?? role ?? previousRole;
      const updatedBranch = updatedStaff?.branch ?? designation ?? previousBranch;
      const updatedStatus = updatedStaff?.isActive ? 'Active' : 'Suspended' || status || (targetUser.is_active ? 'Active' : 'Suspended');

      const roleChanged = String(updatedRole ?? '') !== String(previousRole ?? '');
      const branchChanged = String(updatedBranch ?? '') !== String(previousBranch ?? '');
      const statusChanged = String(updatedStatus) !== (targetUser.is_active ? 'Active' : 'Suspended');

      if (roleChanged || branchChanged || statusChanged) {
        const payload = {
          userId: String(userId),
          newRole: updatedRole,
          newBranch: updatedBranch,
          newStatus: updatedStatus,
          timestamp: new Date().toISOString(),
        };

        emitToUser(payload.userId, 'accountUpdated', payload);
        logger.info(
          `accountUpdated emitted to userId=${payload.userId} (roleChanged=${roleChanged}, branchChanged=${branchChanged}, statusChanged=${statusChanged})`
        );
      }

      return {
        ok: true,
        message: 'Staff account updated successfully.',
        staff: updatedStaff,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating staff account: ${error.message}`);
      throwGraphQLError(res).message(error.message || 'Failed to update staff account.').status(500).throw();
    } finally {
      client.release();
    }
  },

  _rotateStaffAnchor: async (_, { userId }, { user, res }) => {
    // Verify target user exists and is Medical staff
    const targetResult = await db.query(
      `SELECT uc.id, uc.identity, uc.credentials_status, mp.id AS "medicalId"
       FROM "UserCredentials" uc
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       WHERE uc.id = $1`,
      [userId]
    );

    if (targetResult.rows.length === 0) {
      throwGraphQLError(res).message('User not found.').status(404).throw();
    }

    const targetUser = targetResult.rows[0];

    if (targetUser.medicalId === null) {
      throwGraphQLError(res)
        .message('Can only rotate anchor for Medical staff accounts.')
        .status(403)
        .throw();
    }

    // Get current sessions count before rotation
    const sessions = await listUserSessions(userId);
    const sessionCount = sessions.length;

    const client = await db.db().connect();
    try {
      await client.query('BEGIN');

      // Save new anchor in transaction context
      await saveStaffAnchor(userId, generateUUID());

      // Delete all refresh sessions for this user (also needs to be atomic with anchor save)
      await deleteAllUserSessions(userId);

      await client.query('COMMIT');

      logger.warn(`Staff anchor rotated: userId=${userId}, sessionsInvalidated=${sessionCount}, by adminId=${user.id}`);

      return {
        ok: true,
        message: 'Staff anchor rotated successfully. All devices have been logged out.',
        sessionsInvalidated: sessionCount,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error rotating staff anchor: ${error.message}`);
      throwGraphQLError(res).message(error.message || 'Failed to rotate staff anchor.').status(500).throw();
    } finally {
      client.release();
    }
  },

  _setUserSessionRevoked: async (_, { userId, deviceId, revoked }, { user, res }) => {
    const normalizedUserId = String(userId || '').trim();
    const normalizedDeviceId = String(deviceId || '').trim();
    const shouldRevoke = Boolean(revoked);

    if (!normalizedUserId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    if (!normalizedDeviceId) {
      throwGraphQLError(res).message('deviceId is required').status(400).throw();
    }

    const sessionRecords = await listUserSessionsWithMeta(normalizedUserId);
    const mutableRecords = sessionRecords
      .map((record) => normalizeMutableUserSessionRecord(record, normalizedUserId))
      .filter(Boolean);

    const matchedRecord = mutableRecords.find((record) => record.deviceId === normalizedDeviceId);

    if (!matchedRecord) {
      return {
        ok: true,
        message: 'Session not found or already expired.',
      };
    }

    const sessionKey = matchedRecord.sessionKey;
    const currentSession = matchedRecord.session;
    const currentStatus = matchedRecord.status;
    const nextStatus = shouldRevoke ? 'revoked' : 'active';

    if (currentStatus === nextStatus) {
      return {
        ok: true,
        message: shouldRevoke ? 'Session already revoked.' : 'Session already active.',
      };
    }

    const updatedPayload = {
      ...currentSession,
      status: nextStatus,
      updatedAt: Date.now(),
    };

    await setKey(sessionKey, JSON.stringify(updatedPayload), matchedRecord.ttlSeconds);

    logger.info('User refresh session status toggled by admin', {
      adminId: String(user?.id || ''),
      userId: normalizedUserId,
      deviceId: normalizedDeviceId,
      revoked: shouldRevoke,
    });

    return {
      ok: true,
      message: shouldRevoke ? 'Session revoked successfully.' : 'Session unrevoked successfully.',
    };
  },

  _setAllUserSessionsRevoked: async (_, { userId, revoked }, { user, res }) => {
    const normalizedUserId = String(userId || '').trim();
    const shouldRevoke = Boolean(revoked);
    const nextStatus = shouldRevoke ? 'revoked' : 'active';

    if (!normalizedUserId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    const sessionRecords = await listUserSessionsWithMeta(normalizedUserId);
    const mutableRecords = sessionRecords
      .map((record) => normalizeMutableUserSessionRecord(record, normalizedUserId))
      .filter(Boolean);

    if (mutableRecords.length === 0) {
      return {
        ok: true,
        message: 'No active sessions found for this user.',
      };
    }

    const recordsToUpdate = mutableRecords.filter((record) => record.status !== nextStatus);

    if (recordsToUpdate.length === 0) {
      return {
        ok: true,
        message: shouldRevoke ? 'All sessions are already revoked.' : 'All sessions are already active.',
      };
    }

    const updatedAt = Date.now();
    for (const record of recordsToUpdate) {
      const updatedPayload = {
        ...record.session,
        status: nextStatus,
        updatedAt,
      };

      await setKey(record.sessionKey, JSON.stringify(updatedPayload), record.ttlSeconds);
    }

    logger.info('All user refresh sessions status toggled by admin', {
      adminId: String(user?.id || ''),
      userId: normalizedUserId,
      revoked: shouldRevoke,
      totalSessions: mutableRecords.length,
      updatedSessions: recordsToUpdate.length,
    });

    return {
      ok: true,
      message: shouldRevoke
        ? `${recordsToUpdate.length} session(s) revoked successfully.`
        : `${recordsToUpdate.length} session(s) unrevoked successfully.`,
    };
  },

  _revokeUserSession: async (_, { userId, deviceId }, { user, res }) => {
    return Mutation._setUserSessionRevoked(_, { userId, deviceId, revoked: true }, { user, res });
  },

  _setUserAccountLocked: async (_, { userId, locked }, { user, res }) => {
    const normalizedUserId = String(userId || '').trim();
    const shouldLock = Boolean(locked);

    if (!normalizedUserId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    const existingResult = await db.query(
      `SELECT id
       FROM "UserCredentials"
       WHERE id = $1
       LIMIT 1`,
      [normalizedUserId]
    );

    if (existingResult.rows.length === 0) {
      throwGraphQLError(res).message('User not found').status(404).throw();
    }

    const nextStatus = shouldLock ? 'Locked' : 'Active';
    await db.query(
      `UPDATE "UserCredentials"
       SET credentials_status = $1::"CredentialStatus",
           locked_until = NULL
       WHERE id = $2`,
      [nextStatus, normalizedUserId]
    );

    logger.info('User account lock status updated by admin', {
      adminId: String(user?.id || ''),
      userId: normalizedUserId,
      locked: shouldLock,
    });

    return {
      ok: true,
      message: shouldLock ? 'Account locked successfully.' : 'Account unlocked successfully.',
    };
  },

  _setUserSuperior: async (_, { userId }, { user, res }) => {
    return Mutation._setUserSuperiorStatus(_, { userId, superior: true }, { user, res });
  },

  _setUserSuperiorStatus: async (_, { userId, superior }, { user, res }) => {
    const normalizedUserId = String(userId || '').trim();
    const shouldBeSuperior = Boolean(superior);

    if (!normalizedUserId) {
      throwGraphQLError(res).message('userId is required').status(400).throw();
    }

    try {
      await ensureUserIdentityEnumValues();
    } catch (error) {
      throwGraphQLError(res)
        .message(error.message || 'Failed to validate userIdentity enum values.')
        .status(500)
        .throw();
    }

    const client = await db.db().connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT id, identity
         FROM "UserCredentials"
         WHERE id = $1
         FOR UPDATE`,
        [normalizedUserId]
      );

      if (existingResult.rows.length === 0) {
        throwGraphQLError(res).message('User not found').status(404).throw();
      }

      const currentIdentity = String(existingResult.rows[0].identity || '').trim();
      const currentIdentityLower = currentIdentity.toLowerCase();

      if (!['student', 'employee', 'superior'].includes(currentIdentityLower)) {
        throwGraphQLError(res)
          .message('Only Student, Employee, and Superior identities are eligible for Superior role toggling.')
          .status(409)
          .throw();
      }

      let nextIdentity = currentIdentity;
      if (shouldBeSuperior) {
        nextIdentity = 'Superior';
      } else if (currentIdentityLower === 'superior') {
        nextIdentity = 'Employee';
      }

      const hasIdentityChanged = String(nextIdentity).toLowerCase() !== currentIdentityLower;

      if (hasIdentityChanged) {
        await client.query(
          `UPDATE "UserCredentials"
           SET identity = $1
           WHERE id = $2`,
          [nextIdentity, normalizedUserId]
        );
      }

      await client.query('COMMIT');

      logger.info('User superior status toggled by admin', {
        adminId: String(user?.id || ''),
        userId: normalizedUserId,
        superior: shouldBeSuperior,
        previousIdentity: currentIdentity,
        nextIdentity,
      });

      if (!hasIdentityChanged) {
        return {
          ok: true,
          message: shouldBeSuperior ? 'User is already Superior.' : 'User is already not Superior.',
        };
      }

      return {
        ok: true,
        message: shouldBeSuperior
          ? 'User set as Superior successfully.'
          : 'Superior role removed successfully.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error?.name === 'GraphQLError') {
        throw error;
      }
      throwGraphQLError(res).message(error.message || 'Failed to toggle Superior identity.').status(500).throw();
    } finally {
      client.release();
    }
  },

  _applySemestralInactivation: async (_, { branch, department }, { user, res }) => {
    const normalizedBranch = normalizeOptionalScopeValue(branch);
    const normalizedDepartment = normalizeOptionalScopeValue(department);

    if (!normalizedBranch && !normalizedDepartment) {
      throwGraphQLError(res)
        .message('Either branch or department must be provided.')
        .status(400)
        .throw();
    }

    if (normalizedBranch && !['Manila', 'QuezonCity', 'Both'].includes(normalizedBranch)) {
      throwGraphQLError(res)
        .message('branch must be one of Manila, QuezonCity, or Both.')
        .status(400)
        .throw();
    }

    const summaryResult = await db.query(
      `WITH scoped_users AS (
         SELECT uc.id
         FROM "UserCredentials" uc
         LEFT JOIN "UsersPersonal" up ON up.id = uc.id
         LEFT JOIN LATERAL (
           SELECT ep.department
           FROM "patientUpdateLog" pul
           JOIN "profileRecord" pr ON pr.id = pul.id
           JOIN "employee_profile" ep ON ep."profileId" = pr.id
           WHERE pul."patientId" = uc.id
             AND pr.profile_type = 'Employee'
           ORDER BY pul.created_at DESC
           LIMIT 1
         ) latest_employee ON true
         WHERE uc.identity::text = ANY($1::text[])
           AND ($2::text IS NULL OR LOWER(COALESCE(up.branch::text, '')) = LOWER($2))
           AND ($3::text IS NULL OR LOWER(COALESCE(latest_employee.department, '')) = LOWER($3))
       ),
       updated_users AS (
         UPDATE "UserCredentials" uc
         SET credentials_status = 'Inactive'::"CredentialStatus",
             locked_until = NULL
         FROM scoped_users su
         WHERE uc.id = su.id
           AND COALESCE(uc.credentials_status::text, '') <> 'Inactive'
         RETURNING uc.id
       )
       SELECT
         (SELECT COUNT(*)::int FROM scoped_users) AS scoped_count,
         (SELECT COUNT(*)::int FROM updated_users) AS updated_count`,
      [['Student', 'Employee'], normalizedBranch, normalizedDepartment]
    );

    const scopedCount = Number(summaryResult.rows?.[0]?.scoped_count) || 0;
    const updatedCount = Number(summaryResult.rows?.[0]?.updated_count) || 0;

    if (scopedCount === 0) {
      return {
        ok: true,
        message: 'No Student or Employee accounts matched the selected scope.',
      };
    }

    logger.info('Semestral inactivation applied by admin', {
      adminId: String(user?.id || ''),
      branch: normalizedBranch,
      department: normalizedDepartment,
      scopedCount,
      updatedCount,
    });

    return {
      ok: true,
      message: `${updatedCount} of ${scopedCount} account(s) set to Inactive.`,
    };
  },

  _createPermissionTemplate: async (_, { input }, { user, res }) => {
    const { label, permissions: permissionsList, defaultBranch = 'Both' } = input;

    // Validate required fields
    if (!label || !permissionsList || permissionsList.length === 0) {
      throwGraphQLError(res)
        .message('label and permissions are required.')
        .status(400)
        .throw();
    }

    try {
      const template = await createPermissionTemplate({
        label,
        permissionsList,
        createdBy: user.id,
        defaultBranch
      });

      logger.info(`Permission template created: templateId=${template.id}, by adminId=${user.id}`);

      return {
        ok: true,
        message: 'Permission template created successfully.',
        template: await getPermissionTemplate(template.id)
      };
    } catch (error) {
      logger.error(`Failed to create permission template: ${error.message}`);
      throwGraphQLError(res)
        .message(`Failed to create template: ${error.message}`)
        .status(500)
        .throw();
    }
  },

  _updatePermissionTemplate: async (_, { templateId, input }, { user, res }) => {
    const { label, permissions: permissionsList, defaultBranch = 'Both' } = input;

    // Validate at least one field provided
    if (label === undefined && (!permissionsList || permissionsList.length === 0)) {
      throwGraphQLError(res)
        .message('At least one field (label, permissions) must be provided.')
        .status(400)
        .throw();
    }

    // Verify template exists
    const existingTemplate = await getPermissionTemplate(templateId);
    if (!existingTemplate) {
      throwGraphQLError(res)
        .message('Permission template not found.')
        .status(404)
        .throw();
    }

    try {
      // Update template (this has its own transaction inside permit.js)
      const template = await updatePermissionTemplate({
        templateId,
        label,
        permissionsList,
        defaultBranch
      });

      // ── Propagate changes to all staff with this role (in transaction) ──

      const client = await db.db().connect();
      try {
        await client.query('BEGIN');

        let affectedStaffCount = 0;

        // If label changed, update MedicalPersonnel.role for all linked staff first
        if (label !== undefined && label !== null && label !== existingTemplate.label) {
          await client.query(
            `UPDATE "MedicalPersonnel" SET role = $1 WHERE role = $2`,
            [label, existingTemplate.label]
          );
          logger.info(`Staff roles renamed from "${existingTemplate.label}" to "${label}"`);
        }

        // If permissions changed, propagate to all staff with this role
        if (permissionsList && permissionsList.length > 0) {
          const roleLabel = label || existingTemplate.label;
          const propagation = await propagateTemplatePermissions({
            templateId,
            roleLabel,
            assignedBy: user.id,
            client  // Pass client for transaction participation
          });
          affectedStaffCount = propagation.affectedCount;
        }

        await client.query('COMMIT');

        logger.info(`Permission template updated: templateId=${templateId}, by adminId=${user.id}, affectedStaff=${affectedStaffCount}`);

        return {
          ok: true,
          message: affectedStaffCount > 0
            ? `Permission template updated successfully. Permissions propagated to ${affectedStaffCount} staff member(s).`
            : 'Permission template updated successfully.',
          template
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to update permission template: ${error.message}`);
      throwGraphQLError(res)
        .message(`Failed to update template: ${error.message}`)
        .status(500)
        .throw();
    }
  },

  _deletePermissionTemplate: async (_, { templateId }, { user, res }) => {
    // Verify template exists
    const existingTemplate = await getPermissionTemplate(templateId);
    if (!existingTemplate) {
      throwGraphQLError(res)
        .message('Permission template not found.')
        .status(404)
        .throw();
    }

    try {
      const deleted = await deletePermissionTemplate(templateId);

      logger.info(`Permission template deleted: templateId=${templateId}, by adminId=${user.id}`);

      return {
        ok: deleted,
        message: deleted
          ? 'Permission template deleted successfully.'
          : 'Permission template not found.'
      };
    } catch (error) {
      logger.error(`Failed to delete permission template: ${error.message}`);
      throwGraphQLError(res)
        .message(`Failed to delete template: ${error.message}`)
        .status(500)
        .throw();
    }
  },

  _applyTemplateToStaff: async (_, { userId, templateId }, { user, res }) => {
    // Verify user exists and is Medical staff - also get their branch designation
    const userResult = await db.query(
      `SELECT uc.id, uc.identity, mp.id AS "medicalId", mp.designation AS branch
       FROM "UserCredentials" uc
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       WHERE uc.id = $1
       `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throwGraphQLError(res).message('User not found.').status(404).throw();
    }

    const targetUser = userResult.rows[0];
    if (targetUser.medicalId === null) {
      throwGraphQLError(res)
        .message('Template can only be applied to Medical staff accounts.')
        .status(403)
        .throw();
    }

    // Verify template exists
    const template = await getPermissionTemplate(templateId);
    if (!template) {
      throwGraphQLError(res)
        .message('Permission template not found.')
        .status(404)
        .throw();
    }

    try {
      const result = await applyTemplateToStaff({
        personnelId: userId,
        templateId,
        assignedBy: user.id,
        staffBranch: targetUser.branch  // Use the staff's branch - all permissions inherit this
      });

      logger.info(`Template applied to staff: userId=${userId}, templateId=${templateId}, staffBranch=${targetUser.branch}, by adminId=${user.id}`);

      return {
        ok: true,
        message: `Successfully applied template "${template.label}" to staff. ${result.appliedCount} permissions were set.`
      };
    } catch (error) {
      logger.error(`Failed to apply template to staff: ${error.message}`);
      throwGraphQLError(res)
        .message(`Failed to apply template: ${error.message}`)
        .status(500)
        .throw();
    }
  },

  _initiateAdminTransfer: async (_, { newAdminUserId, password }, { user, res }) => {
    if (!password) {
      throwGraphQLError(res)
        .message('Password is required to initiate admin transfer.')
        .status(400)
        .throw();
    }

    const oldAdminId = user.id;

    // 🔍 DEBUG: Log argument types at entry
    logger.warn(`[ADMIN_TRANSFER_DEBUG] Entry: oldAdminId=${oldAdminId} (${typeof oldAdminId}), newAdminUserId=${newAdminUserId} (${typeof newAdminUserId}), password type=${typeof password}`);

    try {
      // ✅ RATE LIMIT 1: Check if admin is locked out from password failures
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 1: isAdminTransferPasswordLocked');
      const { locked: pwLocked, ttl: pwLockTTL } = await isAdminTransferPasswordLocked(oldAdminId);
      if (pwLocked) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Admin locked out - too many password failures',
            lockoutRemainingSeconds: pwLockTTL,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        logger.warn(`Admin ${oldAdminId} attempted transfer while password-locked (TTL: ${pwLockTTL}s)`);

        throwGraphQLError(res)
          .message(`Too many password failures. Try again in ${pwLockTTL} seconds.`)
          .status(429)
          .throw();
      }

      // ✅ RATE LIMIT 2: Check initiation cooldown (5-minute minimum between transfers)
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 2: recordAdminTransferAttempt');
      const { allowed: canInitiate, retryAfterSeconds } = await recordAdminTransferAttempt(oldAdminId);
      if (!canInitiate) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Transfer initiation cooldown active',
            retryAfterSeconds,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        logger.info(`Admin ${oldAdminId} on transfer initiation cooldown (${retryAfterSeconds}s remaining)`);

        throwGraphQLError(res)
          .message(`Transfer already initiated. Try again in ${retryAfterSeconds} seconds.`)
          .status(429)
          .throw();
      }

      // ✅ RATE LIMIT 3: Check for active pending transfer
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 3: getAdminActivePendingTransfer');
      const { hasPending, tokenPrefix } = await getAdminActivePendingTransfer(oldAdminId);
      if (hasPending) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Duplicate transfer attempt - transfer already pending',
            existingTokenPrefix: tokenPrefix,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        logger.warn(`Admin ${oldAdminId} attempted duplicate transfer (token: ${tokenPrefix})`);

        throwGraphQLError(res)
          .message('You already have a pending admin transfer. Complete or cancel it first.')
          .status(409)
          .throw();
      }

      // Get current admin's user record for password verification
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 4: findEmailByUserId');
      const oldAdminEmail = await db.findEmailByUserId(oldAdminId);
      if (!oldAdminEmail) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Current admin email not found',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Unable to verify your credentials.')
          .status(500)
          .throw();
      }

      // Fetch admin credentials to verify password
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 5: findUserByEmail');
      const adminCredentials = await db.findUserByEmail(oldAdminEmail);

      if (!adminCredentials || !adminCredentials.password_hash) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Current admin credentials not found',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Unable to verify your credentials.')
          .status(500)
          .throw();
      }

      // ✅ CRITICAL: Verify password
      logger.warn(`[ADMIN_TRANSFER_DEBUG] Step 6: verifyPassword, passwordType=${typeof password}, hashType=${typeof adminCredentials.password_hash}, hashLength=${adminCredentials.password_hash?.length}`);
      const passwordValid = await verifyPassword(password, adminCredentials.password_hash);
      if (!passwordValid) {
        // Record the failed attempt and get updated failure count and lockout status
        const { failures, locked, lockoutTTL } = await recordAdminTransferPasswordFailure(oldAdminId);

        const baseDelayMs = failures * 1000;
        await delayRandom(Math.max(100, baseDelayMs - 100), baseDelayMs + 100);

        // Log failed password attempt
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Invalid password provided',
            passwordFailureCount: failures,
            isLocked: locked,
            lockoutTTL: locked ? lockoutTTL : null,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        logger.warn(`Admin ${oldAdminId} invalid password (attempt ${failures}/${3}${locked ? ' - LOCKED' : ''})`);

        if (locked) {
          throwGraphQLError(res)
            .message(`Too many invalid passwords. Locked for ${lockoutTTL} seconds.`)
            .status(429)
            .throw();
        }

        throwGraphQLError(res)
          .message(`Invalid password. ${3 - failures} attempt(s) remaining before lockout.`)
          .status(403)
          .throw();
      }

      // ✅ Password valid - clear failure counter
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 7: clearAdminTransferPasswordFailures');
      await clearAdminTransferPasswordFailures(oldAdminId);

      // Validate that new admin user exists and is different from current admin
      if (String(oldAdminId) === String(newAdminUserId)) {
        // Log failed attempt
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Cannot transfer to self',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Cannot transfer admin privileges to yourself.')
          .status(400)
          .throw();
      }

      // Check if new admin is an active medical personnel
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 8: isActiveMedicalPersonnel');
      const isActive = await db.isActiveMedicalPersonnel(newAdminUserId);
      if (!isActive) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Target not active medical personnel',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Target user is not an active medical personnel.')
          .status(400)
          .throw();
      }

      // Check if new admin is validated
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 9: isUserValidated');
      const isValidated = await db.isUserValidated(newAdminUserId);
      if (!isValidated) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Target user not validated',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Target user has not been validated.')
          .status(400)
          .throw();
      }

      // Check if new admin has 2FA enabled
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 10: findEmailByUserId(newAdminUserId)');
      const newAdminUser = await db.findEmailByUserId(newAdminUserId);
      if (!newAdminUser) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Target user not found',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Target user not found.')
          .status(404)
          .throw();
      }

      const allowBootstrapAdmin = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true';

      // Check if new admin has 2FA enabled (bypass in bootstrap mode)
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 11: getUserConsentStateByEmail(newAdminUser)');
      const newAdminData = await db.getUserConsentStateByEmail(newAdminUser);
      if (!newAdminData?.allow_email_2fa && !newAdminData?.totp_enabled) {
        if (allowBootstrapAdmin) {
          logger.warn(`[BOOTSTRAP_BYPASS] Target user 2FA check bypassed for newAdminId=${newAdminUserId} (ALLOW_BOOTSTRAP_ADMIN=true)`);
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_BOOTSTRAP_BYPASS',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminUserId,
            action: 'INITIATE_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Bootstrap mode: Target user 2FA check bypassed (ALLOW_BOOTSTRAP_ADMIN=true)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });
        } else {
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_FAILED',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminUserId,
            action: 'INITIATE_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Target user has no 2FA enabled (email 2FA or authenticator app required)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });

          throwGraphQLError(res)
            .message('Target user must have 2FA enabled (email 2FA or authenticator app) before becoming admin.')
            .status(400)
            .throw();
        }
      }

      // Check if current admin has 2FA enabled (bypass in bootstrap mode)
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 12: getUserConsentStateByEmail(oldAdminEmail)');
      const oldAdminData = await db.getUserConsentStateByEmail(oldAdminEmail);

      if (!oldAdminData?.allow_email_2fa && !oldAdminData?.totp_enabled) {
        // Allow bypass if ALLOW_BOOTSTRAP_ADMIN is enabled (for initial admin bootstrap)
        if (allowBootstrapAdmin) {
          logger.warn(`[BOOTSTRAP_BYPASS] Admin 2FA check bypassed for adminId=${oldAdminId} (ALLOW_BOOTSTRAP_ADMIN=true)`);
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_BOOTSTRAP_BYPASS',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminUserId,
            action: 'INITIATE_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Bootstrap admin 2FA check bypassed (ALLOW_BOOTSTRAP_ADMIN=true)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });
        } else {
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_FAILED',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminUserId,
            action: 'INITIATE_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Current admin has no 2FA enabled (email 2FA or authenticator app required)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });

          logger.warn(`Admin ${oldAdminId} attempted transfer without 2FA enabled`);
          throwGraphQLError(res)
            .message('Current admin must have 2FA enabled (email 2FA or authenticator app) to transfer privileges.')
            .status(400)
            .throw();
        }
      }

      // Generate verification token (or use bootstrap marker if enabled)
      let verificationToken;
      const isBootstrapMode = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true';

      if (isBootstrapMode) {
        logger.warn(`[BOOTSTRAP_MODE] Skipping OTP generation for adminId=${oldAdminId}, newAdminId=${newAdminUserId}`);
        verificationToken = 'BOOTSTRAP_ADMIN_TRANSFER';
      } else {
        logger.warn('[ADMIN_TRANSFER_DEBUG] Step 13: generateOTP');
        verificationToken = generateOTP(8);
      }

      // Store transfer session in Redis
      logger.warn('[ADMIN_TRANSFER_DEBUG] Step 14: createAdminTransferSession');
      await createAdminTransferSession(oldAdminId, newAdminUserId, verificationToken);

      // Send verification email to current admin (skip if bootstrap mode)
      if (!isBootstrapMode) {
        logger.warn('[ADMIN_TRANSFER_DEBUG] Step 15: enqueueAdminTransferEmail');
        await enqueueAdminTransferEmail(oldAdminEmail, verificationToken, newAdminUser);
      } else {
        logger.warn(`[BOOTSTRAP_MODE] Skipping email notification for adminId=${oldAdminId}`);
      }

      // Log successful initiation
      await db.setSystemAuditLog({
        eventType: isBootstrapMode ? 'ADMIN_TRANSFER_INITIATED_BOOTSTRAP' : 'ADMIN_TRANSFER_INITIATED',
        actorId: oldAdminId,
        actorType: 'Staff',
        targetId: newAdminUserId,
        action: 'INITIATE_ADMIN_TRANSFER',
        details: JSON.stringify({
          oldAdminEmail,
          newAdminEmail: newAdminUser,
          tokenPrefix: verificationToken.substring(0, 8) + '...',
          bootstrapMode: isBootstrapMode,
          timestamp: new Date().toISOString(),
        }),
        changedBy: 'Medical',
      });

      logger.info(`Admin transfer initiated: oldAdminId=${oldAdminId}, newAdminId=${newAdminUserId}, bootstrapMode=${isBootstrapMode}`);

      return {
        ok: true,
        message: isBootstrapMode
          ? 'Bootstrap mode: Admin transfer ready to confirm (no email required).'
          : 'Verification email sent. Please check your email and use the token to confirm the transfer.',
        verificationRequired: !isBootstrapMode,
        bootstrapMode: isBootstrapMode,
      };
    } catch (error) {
      // 🔍 DEBUG: Full error with stack trace
      logger.error(`[ADMIN_TRANSFER_DEBUG] CAUGHT ERROR: ${error.message}`);
      logger.error(`[ADMIN_TRANSFER_DEBUG] STACK: ${error.stack}`);
      // If error wasn't already logged (non-GraphQL errors)
      if (!error.extensions) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminUserId,
          action: 'INITIATE_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: error.message,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });
      }
      throw error;
    }
  },

  _confirmAdminTransfer: async (_, { verificationToken }, { user, res }) => {
    const currentUserId = user.id;
    const pool = require('../../../../config/db.js');
    const client = await pool.connect();

    const isBootstrapMode = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true';
    const isBootstrapToken = verificationToken === 'BOOTSTRAP_ADMIN_TRANSFER';

    try {
      // Retrieve transfer session from Redis
      const transferSession = await getAdminTransferSession(verificationToken);

      if (!transferSession) {
        // Log failed verification attempt
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: currentUserId,
          actorType: 'Staff',
          targetId: null,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Invalid or expired verification token',
            tokenPrefix: verificationToken.substring(0, 8) + '...',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Invalid or expired verification token.')
          .status(400)
          .throw();
      }

      const { oldAdminId, newAdminId } = transferSession;

      if (isBootstrapMode && isBootstrapToken) {
        logger.warn(`[BOOTSTRAP_MODE] Admin transfer confirmation using bootstrap token for oldAdminId=${oldAdminId}, newAdminId=${newAdminId}`);
      }

      // Verify that the current user is the old admin
      if (String(currentUserId) !== String(oldAdminId)) {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: currentUserId,
          actorType: 'Staff',
          targetId: newAdminId,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Unauthorized confirmation attempt',
            expectedAdminId: oldAdminId,
            attemptedByUserId: currentUserId,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('You are not authorized to confirm this transfer.')
          .status(403)
          .throw();
      }

      // Verify that the old admin still has admin privileges
      const {permitted: isCurrentlyAdmin} = await isMedicalPermitted(
        oldAdminId,
        permissions.is_admin
      );

      if (!isCurrentlyAdmin) {
        await deleteAdminTransferSession(verificationToken);
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminId,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Old admin no longer has admin privileges',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('You no longer have admin privileges.')
          .status(403)
          .throw();
      }

      // Re-validate new admin (in case status changed during verification period)
      const isActive = await db.isActiveMedicalPersonnel(newAdminId);
      if (!isActive) {
        await deleteAdminTransferSession(verificationToken);
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminId,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Target user no longer active medical personnel',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Target user is no longer an active medical personnel.')
          .status(400)
          .throw();
      }

      const isValidated = await db.isUserValidated(newAdminId);
      if (!isValidated) {
        await deleteAdminTransferSession(verificationToken);
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: oldAdminId,
          actorType: 'Staff',
          targetId: newAdminId,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Target user no longer validated',
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });

        throwGraphQLError(res)
          .message('Target user is no longer validated.')
          .status(400)
          .throw();
      }

      const newAdminEmail = await db.findEmailByUserId(newAdminId);
      const newAdminData = await db.getUserConsentStateByEmail(newAdminEmail);
      if (!newAdminData?.allow_email_2fa && !newAdminData?.totp_enabled) {
        // Allow bypass in bootstrap mode
        if (isBootstrapMode && isBootstrapToken) {
          logger.warn(`[BOOTSTRAP_BYPASS] Target user 2FA check bypassed for newAdminId=${newAdminId} (ALLOW_BOOTSTRAP_ADMIN=true)`);
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_BOOTSTRAP_BYPASS',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminId,
            action: 'CONFIRM_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Bootstrap mode: Target user 2FA check bypassed (ALLOW_BOOTSTRAP_ADMIN=true)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });
        } else {
          await deleteAdminTransferSession(verificationToken);
          await db.setSystemAuditLog({
            eventType: 'ADMIN_TRANSFER_FAILED',
            actorId: oldAdminId,
            actorType: 'Staff',
            targetId: newAdminId,
            action: 'CONFIRM_ADMIN_TRANSFER',
            details: JSON.stringify({
              reason: 'Target user no longer has 2FA enabled (email 2FA or authenticator app required)',
              timestamp: new Date().toISOString(),
            }),
            changedBy: 'Medical',
          });

          throwGraphQLError(res)
            .message('Target user no longer has 2FA enabled (email 2FA or authenticator app required).')
            .status(400)
            .throw();
        }
      }

      const oldAdminEmail = await db.findEmailByUserId(oldAdminId);

      // Perform atomic transfer using database transaction with raw SQL
      await client.query('BEGIN');

      // Grant admin to new user - raw SQL
      await client.query(
        `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
         SELECT $1, r.id, 'Both'::"UserDesignation", $2
         FROM "rolesTable" r
         WHERE r.label = $3
         ON CONFLICT ("personnelId", "rolesId") DO UPDATE
           SET branch = EXCLUDED.branch,
               "assignedBy" = EXCLUDED."assignedBy"`,
        [newAdminId, oldAdminId, permissions.is_admin]
      );

      // Remove admin from old user - raw SQL
      await client.query(
        `DELETE FROM "rolesMap"
         WHERE "personnelId" = $1
         AND "rolesId" = (SELECT id FROM "rolesTable" WHERE label = $2)`,
        [oldAdminId, permissions.is_admin]
      );

      // Update designations: new admin gets Both, old admin defaults to Manila
      await client.query(
        `UPDATE "MedicalPersonnel" SET designation = 'Both'::"UserDesignation" WHERE id = $1`,
        [newAdminId]
      );
      await client.query(
        `UPDATE "MedicalPersonnel" SET designation = NULL WHERE id = $1`,
        [oldAdminId]
      );

      // Update roles: new admin gets Admin role, old admin reverts to their previous role (or Staff)
      await client.query(
        `UPDATE "MedicalPersonnel" SET role = 'Admin' WHERE id = $1`,
        [newAdminId]
      );
      // Old admin keeps their role (don't change it) - they may have been a Doctor, Nurse, etc.
      // Only change designation, not role

      // Log audit trail within transaction
      await db.setSystemAuditLog({
        client: client,
        eventType: isBootstrapMode && isBootstrapToken ? 'ADMIN_TRANSFER_SUCCESS_BOOTSTRAP' : 'ADMIN_TRANSFER_SUCCESS',
        actorId: oldAdminId,
        actorType: 'Staff',
        targetId: newAdminId,
        action: 'TRANSFER_ADMIN_PRIVILEGES',
        details: JSON.stringify({
          oldAdminId,
          oldAdminEmail,
          newAdminId,
          newAdminEmail,
          verificationTokenPrefix: verificationToken.substring(0, 8) + '...',
          bootstrapMode: isBootstrapMode && isBootstrapToken,
          timestamp: new Date().toISOString(),
        }),
        changedBy: 'Medical',
      });

      await client.query('COMMIT');

      // Delete the transfer session
      await deleteAdminTransferSession(verificationToken);

      // Assign default staff role to old admin after losing admin privileges
      try {
        const templatesResult = await listPermissionTemplates();
        if (templatesResult.templates && templatesResult.templates.length > 0) {
          const defaultTemplate = templatesResult.templates[0];

          // Update old admin's role to match the default template
          await client.query(
            `UPDATE "MedicalPersonnel" SET role = $1 WHERE id = $2`,
            [defaultTemplate.label, oldAdminId]
          );

          await applyTemplateToStaff({
            personnelId: oldAdminId,
            templateId: defaultTemplate.id,
            assignedBy: newAdminId,
          });
          logger.info(`Default template "${defaultTemplate.label}" applied to past admin: userId=${oldAdminId}`);
        }
        // Always ensure is_staff is set regardless of template availability
        await setStaffPermissionsExtended({
          personnelId: String(oldAdminId),
          permissionsList: [{ key: 'is_staff', enabled: true }],
          assignedBy: String(newAdminId),
          defaultBranch: 'Both',
        });
        logger.info(`is_staff permission ensured for past admin: userId=${oldAdminId}`);
      } catch (defaultRoleError) {
        logger.error(`Failed to assign default staff role to past admin ${oldAdminId}: ${defaultRoleError.message}`);
        // Non-critical — transfer already completed successfully
      }

      logger.info(`Admin transfer completed successfully: oldAdminId=${oldAdminId}, newAdminId=${newAdminId}, bootstrapMode=${isBootstrapMode && isBootstrapToken}`);

      return {
        ok: true,
        message: isBootstrapMode && isBootstrapToken
          ? 'Admin privileges transferred successfully (bootstrap mode).'
          : 'Admin privileges transferred successfully.',
        oldAdminId: oldAdminId.toString(),
        newAdminId: newAdminId.toString(),
        bootstrapMode: isBootstrapMode && isBootstrapToken,
      };
    } catch (error) {
      await client.query('ROLLBACK');

      // Log rollback failure
      try {
        await db.setSystemAuditLog({
          eventType: 'ADMIN_TRANSFER_FAILED',
          actorId: currentUserId,
          actorType: 'Staff',
          targetId: null,
          action: 'CONFIRM_ADMIN_TRANSFER',
          details: JSON.stringify({
            reason: 'Transaction failed and rolled back',
            error: error.message,
            timestamp: new Date().toISOString(),
          }),
          changedBy: 'Medical',
        });
      } catch (logError) {
        logger.error(`Failed to log admin transfer failure: ${logError.message}`);
      }

      logger.error(`Admin transfer failed: ${error.message}`);

      // Only throw GraphQL error if it's not already a GraphQL error
      if (!error.extensions) {
        throwGraphQLError(res)
          .message(`Admin transfer failed: ${error.message}`)
          .status(500)
          .throw();
      }
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = { Query, Mutation };
