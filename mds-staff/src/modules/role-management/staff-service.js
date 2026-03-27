/**
 * Staff Service — GraphQL client for the role-management module
 * Endpoint: /rolemanagement/admin (staff-only, admin-required)
 */
import { axiosRequest } from '../../packages-core-adapter';

const ENDPOINT = '/rolemanagement/admin';

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post(ENDPOINT, {
    query,
    variables,
  });

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }

  return response.data.data;
};

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const GQL_LIST_STAFF_ACCOUNTS = `
  query ListStaffAccounts {
    listStaffAccounts {
      staff {
        id
        email
        name
        branch
        identity
        status
        modulePermissions {
          modules {
            moduleId
            enabled
          }
        }
        credentialsStatus
        lastLogin
      }
      count
    }
  }
`;

const GQL_GET_STAFF_ACCOUNT = `
  query GetStaffAccount($userId: ID!) {
    getStaffAccount(userId: $userId) {
      id
      email
      name
      branch
      identity
      status
      modulePermissions {
        modules {
          moduleId
          enabled
        }
      }
      credentialsStatus
      lastLogin
    }
  }
`;

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const GQL_UPDATE_STAFF_ACCOUNT = `
  mutation UpdateStaffAccount($userId: ID!, $modules: [ModulePermissionInput!], $status: AccountStatus) {
    updateStaffAccount(userId: $userId, modules: $modules, status: $status) {
      ok
      message
      warnings
      staff {
        id
        email
        name
        branch
        identity
        status
        modulePermissions {
          modules {
            moduleId
            enabled
          }
        }
        credentialsStatus
        lastLogin
      }
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
        permissions {
          key
          enabled
          branch
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
        permissions {
          key
          enabled
          branch
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
        permissions {
          key
          enabled
          branch
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Module → backend permission key mapping.
 * Keep in sync with Backend/services/permit.js MODULE_PERMISSION_MAP.
 */
const MODULE_PERMISSION_MAP = {
  patientSearch: ['profile_allow_view', 'emr_allow_view'],
  pendingRequests: ['emr_allow_approval', 'profile_allow_approval', 'appointment_allow_approval', 'medicine_request_allow_approve'],
  medicalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_edit_catalogs', 'consultation_allow_view', 'consultation_allow_edit', 'profile_allow_view', 'profile_allow_edit'],
  dentalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_set_dental_record', 'consultation_allow_view', 'consultation_allow_edit'],
  appointments: ['appointment_allow_approval', 'appointment_allow_view_records', 'appointment_allow_view_configuration', 'appointment_allow_edit_configuration'],
  inventory: ['inventory_allow_view', 'inventory_allow_edit', 'inventory_allow_dispense', 'inventory_allow_manage_requests', 'inventory_allow_prescribe'],
  healthChat: [],
  analytics: [],
  roleManagement: ['is_admin'],
};

/**
 * Transform GraphQL modulePermissions into flat { moduleId: boolean } object
 * that the frontend Permission Matrix expects.
 */
function toFlatPermissions(modulePermissions) {
  const flat = {};
  if (modulePermissions?.modules) {
    for (const mod of modulePermissions.modules) {
      flat[mod.moduleId] = mod.enabled;
    }
  }
  return flat;
}

/**
 * Transform flat { moduleId: boolean } object into GraphQL ModulePermissionInput array.
 */
function toModuleInputArray(flatPerms) {
  return Object.entries(flatPerms).map(([moduleId, enabled]) => ({
    moduleId,
    enabled: Boolean(enabled),
  }));
}

/**
 * Derive module toggles from BranchPermission[] (template permissions format).
 * A module is enabled if ALL its mapped keys are enabled.
 */
function templatePermsToModules(branchPermissions) {
  const enabledKeys = new Set();
  for (const p of branchPermissions) {
    if (p.enabled) enabledKeys.add(p.key);
  }
  const flat = {};
  for (const [moduleId, keys] of Object.entries(MODULE_PERMISSION_MAP)) {
    flat[moduleId] = keys.length > 0 && keys.every(k => enabledKeys.has(k));
  }
  return flat;
}

/**
 * Convert module toggles to ExtendedPermissionInput[] for template creation/update.
 * Uses union logic: a key is enabled if ANY module mapping to it is ON.
 */
function modulesToTemplatePerms(flatPerms, branch = 'Both') {
  const keyStates = new Map();
  for (const [moduleId, keys] of Object.entries(MODULE_PERMISSION_MAP)) {
    const enabled = Boolean(flatPerms[moduleId]);
    for (const key of keys) {
      if (enabled) {
        keyStates.set(key, true);
      } else if (!keyStates.has(key)) {
        keyStates.set(key, false);
      }
    }
  }
  return Array.from(keyStates.entries()).map(([key, enabled]) => ({
    key,
    enabled,
    branch,
  }));
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

/**
 * Fetch all staff accounts with module-level permissions.
 * Returns array of staff objects with flat `permissions` field.
 */
export const fetchStaffAccounts = async () => {
  const data = await sendGraphQL(GQL_LIST_STAFF_ACCOUNTS);
  const staffList = data.listStaffAccounts.staff || [];

  return staffList.map((s) => ({
    ...s,
    permissions: toFlatPermissions(s.modulePermissions),
  }));
};

/**
 * Fetch a single staff account by ID.
 * Returns staff object with flat `permissions` field, or null.
 */
export const fetchStaffAccount = async (userId) => {
  const data = await sendGraphQL(GQL_GET_STAFF_ACCOUNT, { userId });
  const staff = data.getStaffAccount;
  if (!staff) return null;

  return {
    ...staff,
    permissions: toFlatPermissions(staff.modulePermissions),
  };
};

/**
 * Update a staff member's module permissions and/or status.
 * @param {string} userId - Staff user ID
 * @param {Object} flatPerms - Flat permissions object { moduleId: boolean }
 * @param {string} [status] - 'Active' or 'Suspended'
 */
export const updateStaffAccount = async (userId, flatPerms, status) => {
  const variables = { userId };

  if (flatPerms) {
    variables.modules = toModuleInputArray(flatPerms);
  }

  if (status) {
    variables.status = status;
  }

  const data = await sendGraphQL(GQL_UPDATE_STAFF_ACCOUNT, variables);
  const result = data.updateStaffAccount;

  // If the mutation returned the updated staff, attach flat permissions for the UI
  if (result.staff) {
    result.staff = {
      ...result.staff,
      permissions: toFlatPermissions(result.staff.modulePermissions),
    };
  }

  return result;
};

// ─── TEMPLATE OPERATIONS ──────────────────────────────────────────────────────

/**
 * Fetch all permission templates. Returns array of templates
 * with flat module-level permissions.
 */
export const fetchTemplates = async () => {
  const data = await sendGraphQL(GQL_LIST_TEMPLATES);
  const templates = data.listPermissionTemplates.templates || [];
  return templates.map((t) => ({
    id: t.id,
    label: t.label,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    permissions: templatePermsToModules(t.permissions),
    permissionCount: t.permissionCount,
  }));
};

/**
 * Create a new permission template from module toggles.
 * @param {string} label - Template name
 * @param {Object} flatPerms - { moduleId: boolean }
 */
export const createTemplate = async (label, flatPerms) => {
  const data = await sendGraphQL(GQL_CREATE_TEMPLATE, {
    input: {
      label,
      permissions: modulesToTemplatePerms(flatPerms),
      defaultBranch: 'Both',
    },
  });
  const t = data.createPermissionTemplate.template;
  return t ? {
    id: t.id,
    label: t.label,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    permissions: templatePermsToModules(t.permissions),
    permissionCount: t.permissionCount,
  } : null;
};

/**
 * Update an existing permission template.
 * @param {string} templateId
 * @param {string} [label] - Optional new label
 * @param {Object} [flatPerms] - Optional new module toggles
 */
export const updateTemplate = async (templateId, label, flatPerms) => {
  const input = {};
  if (label !== undefined) input.label = label;
  if (flatPerms) {
    input.permissions = modulesToTemplatePerms(flatPerms);
    input.defaultBranch = 'Both';
  }
  const data = await sendGraphQL(GQL_UPDATE_TEMPLATE, { templateId, input });
  const t = data.updatePermissionTemplate.template;
  return t ? {
    id: t.id,
    label: t.label,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    permissions: templatePermsToModules(t.permissions),
    permissionCount: t.permissionCount,
  } : null;
};

/**
 * Delete a permission template.
 * @param {string} templateId
 */
export const deleteTemplate = async (templateId) => {
  const data = await sendGraphQL(GQL_DELETE_TEMPLATE, { templateId });
  return data.deletePermissionTemplate;
};
