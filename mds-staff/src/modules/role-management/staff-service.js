/**
 * Staff Service — GraphQL client for the role-management module
 * Endpoint: /rolemanagement/admin (staff-only, admin-required)
 */
import { axiosRequest } from '../../packages-core-adapter';

const ENDPOINT = '/rolemanagement/admin';

const sendGraphQL = async (query, variables = {}) => {
  let response;
  try {
    response = await axiosRequest.post(ENDPOINT, { query, variables });
  } catch (err) {
    // Extract GraphQL error message from non-2xx responses when available
    const gqlMsg = err.response?.data?.errors?.[0]?.message;
    const error = new Error(gqlMsg || err.message || 'Network error');
    error.status = err.response?.status;
    throw error;
  }

  if (response.data.errors) {
    const error = new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
    error.status = response.status;
    throw error;
  }

  return response.data.data;
};

// ─── FRAGMENTS ────────────────────────────────────────────────────────────────

const STAFF_FIELDS = `
  id
  email
  name
  role
  branch
  identity
  status
  permissions {
    permissions { key enabled }
    count
  }
  credentialsStatus
  lastLogin
`;

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const GQL_LIST_STAFF_ACCOUNTS = `
  query ListStaffAccounts {
    listStaffAccounts {
      staff { ${STAFF_FIELDS} }
      count
    }
  }
`;

const GQL_SEARCH_USERS = `
  query SearchUsers($query: String!, $mdsOnly: Boolean) {
    searchUsers(query: $query, mdsOnly: $mdsOnly) {
      users {
        id
        email
        name
        identity
        credentialsStatus
        isMedicalPersonnel
      }
      count
    }
  }
`;

const GQL_CREATE_MEDICAL_PERSONNEL = `
  mutation CreateMedicalPersonnel($input: CreateMedicalPersonnelInput!) {
    createMedicalPersonnel(input: $input) {
      ok
      message
      personnel {
        id
        role
        title
        designation
        isActive
      }
    }
  }
`;

const GQL_GET_STAFF_ACCOUNT = `
  query GetStaffAccount($userId: ID!) {
    getStaffAccount(userId: $userId) {
      ${STAFF_FIELDS}
    }
  }
`;

const GQL_COUNT_ACTIVE_REFRESH_TOKENS = `
  query CountActiveRefreshTokens {
    countActiveRefreshTokens
  }
`;

const GQL_COUNT_MAX_ACTIVE_USERS_IN_HOURS = `
  query CountMaxActiveUsersInHours($hours: Int!) {
    countMaxActiveUsersInHours(hours: $hours)
  }
`;

const GQL_LIST_USERS = `
  query ListUsers($offset: Int!, $limit: Int!, $search: String, $branch: String, $type: String, $status: String, $includeUnverified: Boolean) {
    listUsers(offset: $offset, limit: $limit, search: $search, branch: $branch, type: $type, status: $status, includeUnverified: $includeUnverified) {
      users {
        id
        name
        email
        branch
        type
        userType
        status
        inactiveExpiresAt
        lastLogin
      }
      totalCount
    }
  }
`;

const GQL_LIST_USER_SESSIONS = `
  query ListUserSessions($userId: ID!, $offset: Int!, $limit: Int!) {
    listUserSessions(userId: $userId, offset: $offset, limit: $limit) {
      deviceId
      refreshToken
      status
      createdAt
      updatedAt
      ttlSeconds
      expiresAt
    }
  }
`;

const GQL_LIST_USER_LOGIN_ATTEMPTS = `
  query UserLoginHistory($userId: ID!, $offset: Int!, $limit: Int!) {
    listUserLoginAttempts(userId: $userId, offset: $offset, limit: $limit) {
      timestamp
      ip
      device
      status
    }
  }
`;

const GQL_LIST_ALL_SESSIONS = `
  query ListAllSessions($offset: Int!, $limit: Int!) {
    listAllSessions(offset: $offset, limit: $limit) {
      sessions {
        sessionId
        userId
        email
        role
        device
        refreshToken
        ttlSeconds
        numberOfSessions
        status
        lastActive
        exp
      }
      totalCount
    }
  }
`;

const GQL_REVOKE_USER_SESSION = `
  mutation RevokeUserSession($userId: ID!, $deviceId: String!) {
    revokeUserSession(userId: $userId, deviceId: $deviceId) {
      ok
      message
    }
  }
`;

const GQL_SET_USER_SESSION_REVOKED = `
  mutation SetUserSessionRevoked($userId: ID!, $deviceId: String!, $revoked: Boolean!) {
    setUserSessionRevoked(userId: $userId, deviceId: $deviceId, revoked: $revoked) {
      ok
      message
    }
  }
`;

const GQL_SET_USER_ACCOUNT_LOCKED = `
  mutation SetUserAccountLocked($userId: ID!, $locked: Boolean!) {
    setUserAccountLocked(userId: $userId, locked: $locked) {
      ok
      message
    }
  }
`;

const GQL_SET_USER_SUPERIOR = `
  mutation SetUserSuperior($userId: ID!) {
    setUserSuperior(userId: $userId) {
      ok
      message
    }
  }
`;

const GQL_SET_USER_SUPERIOR_STATUS = `
  mutation SetUserSuperiorStatus($userId: ID!, $superior: Boolean!) {
    setUserSuperiorStatus(userId: $userId, superior: $superior) {
      ok
      message
    }
  }
`;

const GQL_SET_ALL_USER_SESSIONS_REVOKED = `
  mutation SetAllUserSessionsRevoked($userId: ID!, $revoked: Boolean!) {
    setAllUserSessionsRevoked(userId: $userId, revoked: $revoked) {
      ok
      message
    }
  }
`;

const GQL_APPLY_SEMESTRAL_INACTIVATION = `
  mutation ApplySemestralInactivation($branch: String, $department: String, $identities: [Identity!]) {
    applySemestralInactivation(branch: $branch, department: $department, identities: $identities) {
      ok
      message
    }
  }
`;

const GQL_PREVIEW_SEMESTRAL_INACTIVATION = `
  query PreviewSemestralInactivation($branch: String, $department: String, $identities: [Identity!]) {
    previewSemestralInactivation(branch: $branch, department: $department, identities: $identities) {
      ok
      message
      scopedCount
      willUpdateCount
    }
  }
`;

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const GQL_UPDATE_STAFF_ACCOUNT = `
  mutation UpdateStaffAccount($userId: ID!, $status: AccountStatus, $role: String, $templateId: ID, $designation: Designation) {
    updateStaffAccount(userId: $userId, status: $status, role: $role, templateId: $templateId, designation: $designation) {
      ok
      message
      warnings
      staff { ${STAFF_FIELDS} }
    }
  }
`;

const GQL_LIST_TEMPLATES = `
  query ListPermissionTemplates {
    listPermissionTemplates {
      templates {
        id
        label
        createdBy
        createdAt
        permissions { key enabled branch }
        permissionGroups {
          id
          label
          enabled
          fullyEnabled
          childCount
          enabledChildCount
          children { key enabled branch }
        }
        permissionCount
      }
      count
    }
  }
`;

const GQL_CREATE_TEMPLATE = `
  mutation CreatePermissionTemplate($input: CreateTemplateInput!) {
    createPermissionTemplate(input: $input) {
      ok
      message
      template {
        id
        label
        createdBy
        createdAt
        permissions { key enabled branch }
        permissionGroups {
          id
          label
          enabled
          fullyEnabled
          childCount
          enabledChildCount
          children { key enabled branch }
        }
        permissionCount
      }
    }
  }
`;

const GQL_UPDATE_TEMPLATE = `
  mutation UpdatePermissionTemplate($templateId: ID!, $input: UpdateTemplateInput!) {
    updatePermissionTemplate(templateId: $templateId, input: $input) {
      ok
      message
      template {
        id
        label
        createdBy
        createdAt
        permissions { key enabled branch }
        permissionGroups {
          id
          label
          enabled
          fullyEnabled
          childCount
          enabledChildCount
          children { key enabled branch }
        }
        permissionCount
      }
    }
  }
`;

const GQL_DELETE_TEMPLATE = `
  mutation DeletePermissionTemplate($templateId: ID!) {
    deletePermissionTemplate(templateId: $templateId) {
      ok
      message
    }
  }
`;

const GQL_INITIATE_ADMIN_TRANSFER = `
  mutation InitiateAdminTransfer($newAdminUserId: ID!, $password: String!) {
    initiateAdminTransfer(newAdminUserId: $newAdminUserId, password: $password) {
      ok
      message
      verificationRequired
      bootstrapMode
    }
  }
`;

const GQL_CONFIRM_ADMIN_TRANSFER = `
  mutation ConfirmAdminTransfer($verificationToken: String!) {
    confirmAdminTransfer(verificationToken: $verificationToken) {
      ok
      message
      oldAdminId
      newAdminId
    }
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Convert backend Permissions { permissions: [{ key, enabled }] } to flat { key: boolean }.
 */
function toGranularPermissions(permsResponse) {
  const flat = {};
  if (permsResponse?.permissions) {
    for (const p of permsResponse.permissions) {
      flat[p.key] = p.enabled;
    }
  }
  return flat;
}

/**
 * Convert flat { key: boolean } to ExtendedPermissionInput[] for template mutations.
 */
function granularToTemplatePerms(granularPerms, branch = 'Both') {
  return Object.entries(granularPerms).map(([key, enabled]) => ({
    key,
    enabled: Boolean(enabled),
    branch,
  }));
}

/**
 * Convert BranchPermission[] from backend to flat { key: boolean }.
 */
function templatePermsToGranular(branchPermissions) {
  const flat = {};
  for (const p of branchPermissions) {
    flat[p.key] = p.enabled;
  }
  return flat;
}

function enrichStaff(s) {
  return { ...s, permissions: toGranularPermissions(s.permissions) };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

/**
 * Fetch all staff accounts with granular permissions.
 */
export const fetchStaffAccounts = async () => {
  const data = await sendGraphQL(GQL_LIST_STAFF_ACCOUNTS);
  return (data.listStaffAccounts.staff || []).map(enrichStaff);
};

/**
 * Search users by email, name, or ID (for adding new staff).
 */
export const searchUsers = async (query, mdsOnly = false) => {
  const data = await sendGraphQL(GQL_SEARCH_USERS, { query, mdsOnly });
  return data.searchUsers.users || [];
};

/**
 * Create a new medical personnel record (add staff).
 * @param {Object} input - { userId, title, role, designation, templateId? }
 */
export const createMedicalPersonnel = async (input) => {
  const data = await sendGraphQL(GQL_CREATE_MEDICAL_PERSONNEL, { input });
  return data.createMedicalPersonnel;
};

/**
 * Fetch a single staff account by ID.
 */
export const fetchStaffAccount = async (userId) => {
  const data = await sendGraphQL(GQL_GET_STAFF_ACCOUNT, { userId });
  const staff = data.getStaffAccount;
  return staff ? enrichStaff(staff) : null;
};

/**
 * Save staff role, status, and/or branch designation changes.
 * Permissions are always derived from role templates — no per-staff overrides.
 * @param {string} userId
 * @param {string} [status] - 'Active' or 'Suspended'
 * @param {string} [role] - New role name (must match a template label)
 * @param {string} [templateId] - Template ID to apply
 * @param {string} [designation] - Branch designation: 'Manila', 'QuezonCity', or 'Both'
 */
export const updateStaffAccount = async (userId, status, role, templateId, designation) => {
  const data = await sendGraphQL(GQL_UPDATE_STAFF_ACCOUNT, { userId, status, role, templateId, designation });
  const result = data.updateStaffAccount;
  if (result.staff) result.staff = enrichStaff(result.staff);
  return result;
};

// ─── USER MANAGEMENT (READ-ONLY) ─────────────────────────────────────────────

export const fetchActiveRefreshTokenCount = async () => {
  const data = await sendGraphQL(GQL_COUNT_ACTIVE_REFRESH_TOKENS);
  return data.countActiveRefreshTokens || 0;
};

export const fetchMaxActiveUsersInHours = async (hours = 24) => {
  const data = await sendGraphQL(GQL_COUNT_MAX_ACTIVE_USERS_IN_HOURS, { hours });
  return Number(data.countMaxActiveUsersInHours) || 0;
};

export const fetchUsers = async (offset = 0, limit = 100, filters = {}) => {
  const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';
  const branchFilter = typeof filters.branch === 'string' ? filters.branch.trim() : '';
  const typeFilter = typeof filters.type === 'string' ? filters.type.trim() : '';
  const statusFilter = typeof filters.status === 'string' ? filters.status.trim() : '';
  const includeUnverified = Boolean(filters.includeUnverified);

  const data = await sendGraphQL(GQL_LIST_USERS, {
    offset,
    limit,
    search: normalizedSearch || null,
    branch: branchFilter && branchFilter.toLowerCase() !== 'all' ? branchFilter : null,
    type: typeFilter && typeFilter.toLowerCase() !== 'all' ? typeFilter : null,
    status: statusFilter && statusFilter.toLowerCase() !== 'all' ? statusFilter : null,
    includeUnverified,
  });

  return data.listUsers || { users: [], totalCount: 0 };
};

export const fetchUserSessions = async (userId, offset = 0, limit = 10) => {
  const effectiveLimit = Math.max(1, Number(limit) + 1);
  const data = await sendGraphQL(GQL_LIST_USER_SESSIONS, { userId, offset, limit: effectiveLimit });
  const sessions = Array.isArray(data.listUserSessions) ? data.listUserSessions : [];

  return {
    sessions: sessions.slice(0, limit),
    hasMore: sessions.length > limit,
  };
};

export const fetchUserLoginAttempts = async (userId, offset = 0, limit = 10) => {
  const effectiveLimit = Math.max(1, Number(limit) + 1);
  const data = await sendGraphQL(GQL_LIST_USER_LOGIN_ATTEMPTS, { userId, offset, limit: effectiveLimit });
  const attempts = Array.isArray(data.listUserLoginAttempts) ? data.listUserLoginAttempts : [];

  return {
    attempts: attempts.slice(0, limit),
    hasMore: attempts.length > limit,
  };
};

export const fetchAllSessions = async (offset = 0, limit = 10) => {
  const data = await sendGraphQL(GQL_LIST_ALL_SESSIONS, { offset, limit });
  return data.listAllSessions || { sessions: [], totalCount: 0 };
};

export const revokeUserSession = async (userId, deviceId) => {
  const data = await sendGraphQL(GQL_REVOKE_USER_SESSION, { userId, deviceId });
  return data.revokeUserSession || { ok: false, message: 'Failed to revoke session.' };
};

export const setUserSessionRevoked = async (userId, deviceId, revoked) => {
  const data = await sendGraphQL(GQL_SET_USER_SESSION_REVOKED, { userId, deviceId, revoked: Boolean(revoked) });
  return data.setUserSessionRevoked || { ok: false, message: 'Failed to update session status.' };
};

export const setUserAccountLocked = async (userId, locked) => {
  const data = await sendGraphQL(GQL_SET_USER_ACCOUNT_LOCKED, { userId, locked: Boolean(locked) });
  return data.setUserAccountLocked || { ok: false, message: 'Failed to update account lock status.' };
};

export const setUserSuperior = async (userId) => {
  const data = await sendGraphQL(GQL_SET_USER_SUPERIOR, { userId });
  return data.setUserSuperior || { ok: false, message: 'Failed to set Superior account.' };
};

export const setUserSuperiorStatus = async (userId, superior) => {
  const data = await sendGraphQL(GQL_SET_USER_SUPERIOR_STATUS, { userId, superior: Boolean(superior) });
  return data.setUserSuperiorStatus || { ok: false, message: 'Failed to update Superior role.' };
};

export const setAllUserSessionsRevoked = async (userId, revoked) => {
  const data = await sendGraphQL(GQL_SET_ALL_USER_SESSIONS_REVOKED, { userId, revoked: Boolean(revoked) });
  return data.setAllUserSessionsRevoked || { ok: false, message: 'Failed to update all session tickets.' };
};

export const applySemestralInactivation = async ({ branch = null, department = null, identities = null } = {}) => {
  const normalizedBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : null;
  const normalizedDepartment = typeof department === 'string' && department.trim() ? department.trim() : null;
  const normalizedIdentities = Array.isArray(identities) && identities.length > 0
    ? identities.map((value) => String(value || '').trim()).filter(Boolean)
    : null;

  const data = await sendGraphQL(GQL_APPLY_SEMESTRAL_INACTIVATION, {
    branch: normalizedBranch,
    department: normalizedDepartment,
    identities: normalizedIdentities,
  });

  return data.applySemestralInactivation || { ok: false, message: 'Failed to apply semestral inactivation.' };
};

export const previewSemestralInactivation = async ({ branch = null, department = null, identities = null } = {}) => {
  const normalizedBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : null;
  const normalizedDepartment = typeof department === 'string' && department.trim() ? department.trim() : null;
  const normalizedIdentities = Array.isArray(identities) && identities.length > 0
    ? identities.map((value) => String(value || '').trim()).filter(Boolean)
    : null;

  const data = await sendGraphQL(GQL_PREVIEW_SEMESTRAL_INACTIVATION, {
    branch: normalizedBranch,
    department: normalizedDepartment,
    identities: normalizedIdentities,
  });

  return data.previewSemestralInactivation || {
    ok: false,
    message: 'Failed to preview semestral inactivation.',
    scopedCount: 0,
    willUpdateCount: 0,
  };
};

// ─── TEMPLATE OPERATIONS ──────────────────────────────────────────────────────

export const fetchTemplates = async () => {
  const data = await sendGraphQL(GQL_LIST_TEMPLATES);
  return (data.listPermissionTemplates.templates || []).map((t) => ({
    id: t.id,
    label: t.label,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    permissions: templatePermsToGranular(t.permissions),
    permissionGroups: t.permissionGroups || [],
    permissionCount: t.permissionCount,
  }));
};

export const createTemplate = async (label, granularPerms) => {
  const data = await sendGraphQL(GQL_CREATE_TEMPLATE, {
    input: {
      label,
      permissions: granularToTemplatePerms(granularPerms),
      defaultBranch: 'Both',
    },
  });
  const t = data.createPermissionTemplate.template;
  return t ? {
    id: t.id, label: t.label, createdBy: t.createdBy, createdAt: t.createdAt,
    permissions: templatePermsToGranular(t.permissions),
    permissionGroups: t.permissionGroups || [],
    permissionCount: t.permissionCount,
  } : null;
};

export const updateTemplate = async (templateId, label, granularPerms) => {
  const input = {};
  if (label !== undefined) input.label = label;
  if (granularPerms) {
    input.permissions = granularToTemplatePerms(granularPerms);
    input.defaultBranch = 'Both';
  }
  const data = await sendGraphQL(GQL_UPDATE_TEMPLATE, { templateId, input });
  const result = data.updatePermissionTemplate;
  const t = result.template;
  return {
    message: result.message,
    template: t ? {
      id: t.id, label: t.label, createdBy: t.createdBy, createdAt: t.createdAt,
      permissions: templatePermsToGranular(t.permissions),
      permissionGroups: t.permissionGroups || [],
      permissionCount: t.permissionCount,
    } : null,
  };
};

export const deleteTemplate = async (templateId) => {
  const data = await sendGraphQL(GQL_DELETE_TEMPLATE, { templateId });
  return data.deletePermissionTemplate;
};

// ─── ADMIN TRANSFER ───────────────────────────────────────────────────────────

export const initiateAdminTransfer = async (newAdminUserId, password) => {
  const data = await sendGraphQL(GQL_INITIATE_ADMIN_TRANSFER, { newAdminUserId, password });
  return data.initiateAdminTransfer;
};

export const confirmAdminTransfer = async (verificationToken) => {
  const data = await sendGraphQL(GQL_CONFIRM_ADMIN_TRANSFER, { verificationToken });
  return data.confirmAdminTransfer;
};
