import { TokenStorage, axiosRequest } from '../packages-core-adapter';

// Module-level entangled permission codes.
// Extend this map as more modules become entangled.
export const MODULE_ENTANGLED_PERMISSION_MAP = {
  patientSearch: 'SEARCH_PATIENT',
};

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
  const response = await axiosRequest.post(endpoint, { query, variables });

  if (Array.isArray(response?.data?.errors) && response.data.errors.length > 0) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }

  return response?.data?.data || null;
}

async function fetchFromEndpoint(endpoint) {
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

export async function fetchEntangledPermissions() {
  let lastError = null;

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const map = await fetchFromEndpoint(endpoint);
      if (Object.keys(map).length > 0) return map;
    } catch (error) {
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
