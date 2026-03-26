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
    }
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
  return data.updateStaffAccount;
};
