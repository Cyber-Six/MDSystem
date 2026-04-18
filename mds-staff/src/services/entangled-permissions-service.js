import { TokenStorage, axiosRequest } from '../packages-core-adapter';

// Module-level entangled permission codes.
// Extend this map as more modules become entangled.
export const MODULE_ENTANGLED_PERMISSION_MAP = {
  patientSearch: 'SEARCH_PATIENT',
};

const PERMISSION_DENIED_MESSAGE_REGEX = /unauthorized|forbidden|not permitted|insufficient permissions|admin access required/i;

const STAFF_PERMISSION_QUERY = `
  query GetStaffPermissions($userId: ID!) {
    getStaffPermissions(userId: $userId) {
      permissions {
        code: key
        enabled
      }
    }
  }
`;

// Prefer role-management admin GraphQL for canonical staff permissions.
// Override with VITE_ENTANGLED_PERMISSION_ENDPOINTS="/custom/a,/custom/b" when needed.
const configuredEndpoints = String(import.meta.env.VITE_ENTANGLED_PERMISSION_ENDPOINTS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const GRAPHQL_ENDPOINTS = configuredEndpoints.length > 0
  ? configuredEndpoints
  : ['/rolemanagement/admin'];

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isPermissionDeniedMessage(message) {
  if (typeof message !== 'string') return false;
  return PERMISSION_DENIED_MESSAGE_REGEX.test(message);
}

function isUnauthorizedError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  if (status === 401 || status === 403) return true;

  const message = String(
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || ''
  );

  return isPermissionDeniedMessage(message);
}

async function getCurrentUserId() {
  const accessToken = await Promise.resolve(TokenStorage.getAccessToken());
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.id) return null;
  return String(payload.id);
}

function toPermissionRecord(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const code = typeof entry.code === 'string' ? entry.code.trim() : '';
  if (!code) return null;

  return {
    code,
    enabled: Boolean(entry.enabled),
    hardBlocked: Boolean(entry.hardBlocked),
  };
}

function toPermissionMap(records = []) {
  const map = {};

  for (const record of records) {
    const normalized = toPermissionRecord(record);
    if (!normalized) continue;

    map[normalized.code] = normalized;
  }

  return map;
}

async function sendGraphQL(endpoint, query, variables = {}) {
  let response;

  try {
    response = await axiosRequest.post(endpoint, { query, variables });
  } catch (error) {
    const wrappedError = new Error(
      error?.response?.data?.errors?.[0]?.message
      || error?.response?.data?.message
      || error?.message
      || 'GraphQL request failed'
    );
    wrappedError.status = error?.response?.status;
    throw wrappedError;
  }

  if (Array.isArray(response?.data?.errors) && response.data.errors.length > 0) {
    const message = response.data.errors[0]?.message || 'GraphQL error occurred';
    const error = new Error(message);
    if (isPermissionDeniedMessage(message)) {
      error.status = 403;
    }
    throw error;
  }

  return response?.data?.data || null;
}

async function fetchFromEndpoint(endpoint, options = {}) {
  if (!options?.isAdmin) return {};

  const userId = await getCurrentUserId();
  if (!userId) return {};

  const data = await sendGraphQL(endpoint, STAFF_PERMISSION_QUERY, { userId });
  const records = data?.getStaffPermissions?.permissions || [];
  return toPermissionMap(records);
}

export function deriveEntangledPermissionsFromModules(modules = {}) {
  const map = {};

  for (const [moduleId, code] of Object.entries(MODULE_ENTANGLED_PERMISSION_MAP)) {
    map[code] = {
      code,
      enabled: Boolean(modules?.[moduleId]),
      hardBlocked: false,
    };
  }

  return map;
}

export function mergeEntangledPermissionMaps(baseMap = {}, overrideMap = {}) {
  return {
    ...baseMap,
    ...overrideMap,
  };
}

export async function fetchEntangledPermissions(options = {}) {
  if (!options?.isAdmin) return {};

  let lastError = null;

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const map = await fetchFromEndpoint(endpoint, options);
      if (Object.keys(map).length > 0) return map;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return {};
      }

      lastError = error;
    }
  }

  if (lastError) throw lastError;

  return {};
}

export function isEntangledPermissionAllowed(record) {
  if (!record) return false;
  if (!record.enabled) return false;
  if (record.hardBlocked) return false;
  return true;
}
