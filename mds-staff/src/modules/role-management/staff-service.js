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
    throw new Error(gqlMsg || err.message || 'Network error');
  }

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
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

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const GQL_UPDATE_STAFF_ACCOUNT = `
  mutation UpdateStaffAccount($userId: ID!, $status: AccountStatus, $role: String, $templateId: ID) {
    updateStaffAccount(userId: $userId, status: $status, role: $role, templateId: $templateId) {
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
 * Save staff role and/or status changes.
 * Permissions are always derived from role templates — no per-staff overrides.
 * @param {string} userId
 * @param {string} [status] - 'Active' or 'Suspended'
 * @param {string} [role] - New role name (must match a template label)
 * @param {string} [templateId] - Template ID to apply
 */
export const updateStaffAccount = async (userId, status, role, templateId) => {
  const data = await sendGraphQL(GQL_UPDATE_STAFF_ACCOUNT, { userId, status, role, templateId });
  const result = data.updateStaffAccount;
  if (result.staff) result.staff = enrichStaff(result.staff);
  return result;
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
  const t = data.updatePermissionTemplate.template;
  return t ? {
    id: t.id, label: t.label, createdBy: t.createdBy, createdAt: t.createdAt,
    permissions: templatePermsToGranular(t.permissions),
    permissionCount: t.permissionCount,
  } : null;
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
