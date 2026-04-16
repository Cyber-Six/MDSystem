import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { axiosRequest } from '../packages-core-adapter';
import {
  MODULE_ENTANGLED_PERMISSION_MAP,
  deriveEntangledPermissionsFromModules,
  fetchEntangledPermissions,
  isEntangledPermissionAllowed,
  mergeEntangledPermissionMaps,
} from '../services/entangled-permissions-service';

const PermissionsContext = createContext(null);

const SEARCH_PATIENT_PERMISSION_KEYS = Object.freeze([
  'profile_allow_view',
  'emr_allow_view',
  'consultation_allow_view',
  'appointment_allow_view_records',
  'inventory_allow_manage_requests',
  'document_allow_view',
]);

const PERMISSION_DENIED_MESSAGE_REGEX = /unauthorized|forbidden|not permitted|insufficient permissions|admin access required/i;
const GRAPHQL_SCHEMA_ERROR_REGEX = /cannot query field|unknown argument|unknown type|syntax error|validation error/i;

function isPermissionDeniedMessage(message) {
  if (typeof message !== 'string') return false;
  return PERMISSION_DENIED_MESSAGE_REGEX.test(message);
}

function isGraphQLSchemaOrValidationMessage(message) {
  if (typeof message !== 'string') return false;
  return GRAPHQL_SCHEMA_ERROR_REGEX.test(message);
}

function isPermissionDeniedError(error) {
  const status = Number(error?.response?.status || 0);
  if (status === 401 || status === 403) return true;

  const payloadMessage =
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || '';

  return isPermissionDeniedMessage(String(payloadMessage));
}

function hasSearchPatientGranularSnapshot(permissionMap = {}) {
  return SEARCH_PATIENT_PERMISSION_KEYS.every((key) => Object.prototype.hasOwnProperty.call(permissionMap, key));
}

async function probeGraphQLPermission(endpoint, query, variables = {}) {
  try {
    const response = await axiosRequest.post(endpoint, { query, variables });
    const errors = Array.isArray(response?.data?.errors) ? response.data.errors : [];
    if (errors.length === 0) return true;

    const denied = errors.some((entry) => isPermissionDeniedMessage(entry?.message || ''));
    if (denied) return false;

    const schemaOrValidationOnly = errors.every((entry) => {
      const message = String(entry?.message || '');
      return isGraphQLSchemaOrValidationMessage(message);
    });
    if (schemaOrValidationOnly) return null;

    // Non-authorization GraphQL errors imply auth passed but payload/business constraints failed.
    return true;
  } catch (error) {
    if (isPermissionDeniedError(error)) return false;

    return null;
  }
}

async function probeRestPermission(url, params = null) {
  try {
    await axiosRequest.get(url, params ? { params } : undefined);
    return true;
  } catch (error) {
    if (isPermissionDeniedError(error)) return false;
    return null;
  }
}

async function fetchSearchPatientCandidateIds(branch) {
  const safeBranch = branch || 'Both';
  const searchTerms = ['a', '1', 'e'];
  const ids = new Set();

  for (const term of searchTerms) {
    try {
      const response = await axiosRequest.get('/staff/id/search', {
        params: {
          query: term,
          branch: safeBranch,
        },
      });

      const users = Array.isArray(response?.data?.users) ? response.data.users : [];
      for (const user of users) {
        if (user?.id === undefined || user?.id === null) continue;
        ids.add(String(user.id));
        if (ids.size >= 5) break;
      }
      if (ids.size >= 5) break;
    } catch {
      // Ignore per-term lookup failures and continue with other terms.
    }
  }

  return Array.from(ids);
}

async function probePatientScopedPermission(endpoint, query, variableName, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return null;

  let sawDenied = false;
  let sawUnknown = false;

  // Try a few patients to avoid false negatives if one candidate is Superior-restricted.
  for (const candidateId of candidateIds.slice(0, 3)) {
    const allowed = await probeGraphQLPermission(endpoint, query, { [variableName]: String(candidateId) });
    if (allowed) return true;

    if (allowed === false) {
      sawDenied = true;
    } else {
      sawUnknown = true;
    }
  }

  if (sawDenied && !sawUnknown) return false;
  return null;
}

async function probePatientScopedRestPermission(url, patientIdParamName, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return null;

  let sawDenied = false;
  let sawUnknown = false;

  for (const candidateId of candidateIds.slice(0, 3)) {
    const allowed = await probeRestPermission(url, { [patientIdParamName]: String(candidateId) });
    if (allowed) return true;

    if (allowed === false) {
      sawDenied = true;
    } else {
      sawUnknown = true;
    }
  }

  if (sawDenied && !sawUnknown) return false;
  return null;
}

function toEntangledRecord(code, enabled) {
  return {
    code,
    enabled: Boolean(enabled),
    hardBlocked: false,
  };
}

async function fetchSearchPatientPermissionProbeMap({ branch, existingPermissions = {} }) {
  const missingKeys = SEARCH_PATIENT_PERMISSION_KEYS.filter(
    (key) => !Object.prototype.hasOwnProperty.call(existingPermissions, key)
  );

  if (missingKeys.length === 0) return {};

  const needsPatientScopedProbe =
    missingKeys.includes('profile_allow_view')
    || missingKeys.includes('emr_allow_view')
    || missingKeys.includes('consultation_allow_view')
    || missingKeys.includes('appointment_allow_view_records')
    || missingKeys.includes('inventory_allow_manage_requests')
    || missingKeys.includes('document_allow_view');

  const candidateIds = needsPatientScopedProbe
    ? await fetchSearchPatientCandidateIds(branch)
    : [];

  const probeResults = {};

  const probeTasks = [];

  if (missingKeys.includes('emr_allow_view')) {
    probeTasks.push(
      probePatientScopedPermission(
        '/emr/medical',
        `query ProbeEmrAllowView($userId: ID!) { getPatientBasicInfo(userId: $userId) { id access_denied } }`,
        'userId',
        candidateIds,
      ).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.emr_allow_view = allowed;
        }
      })
    );
  }

  if (missingKeys.includes('appointment_allow_view_records')) {
    probeTasks.push(
      probePatientScopedPermission(
        '/appointment/medical',
        `query ProbeAppointmentView($userId: ID!) { getUserAppointmentStatus(userId: $userId) }`,
        'userId',
        candidateIds,
      ).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.appointment_allow_view_records = allowed;
        }
      })
    );
  }

  if (missingKeys.includes('inventory_allow_manage_requests')) {
    probeTasks.push(
      probePatientScopedPermission(
        '/medical-inventory/medicine-request/medical',
        `query ProbeMedicineRequestManage($patientId: ID!) { getMedicineRequests(patientId: $patientId, offset: 0, limit: 1) { id } }`,
        'patientId',
        candidateIds,
      ).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.inventory_allow_manage_requests = allowed;
        }
      })
    );
  }

  if (missingKeys.includes('document_allow_view')) {
    probeTasks.push(
      probePatientScopedRestPermission('/documents/required', 'patientId', candidateIds).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.document_allow_view = allowed;
        }
      })
    );
  }

  if (missingKeys.includes('profile_allow_view')) {
    probeTasks.push(
      probePatientScopedPermission(
        '/profile/medical',
        `query ProbeProfileView($userId: ID!) { getUserPersonalRecord(userId: $userId) { id } }`,
        'userId',
        candidateIds,
      ).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.profile_allow_view = allowed;
        }
      })
    );
  }

  if (missingKeys.includes('consultation_allow_view')) {
    probeTasks.push(
      probePatientScopedPermission(
        '/consultation',
        `query ProbeConsultationView($patientId: ID!) { getConsultations(patientId: $patientId, limit: 1) { id } }`,
        'patientId',
        candidateIds,
      ).then((allowed) => {
        if (typeof allowed === 'boolean') {
          probeResults.consultation_allow_view = allowed;
        }
      })
    );
  }

  await Promise.all(probeTasks);

  const map = {};
  for (const [key, enabled] of Object.entries(probeResults)) {
    map[key] = toEntangledRecord(key, enabled);
  }

  return map;
}

/**
 * Map from module IDs to sidebar route paths.
 * Used to check if a route requires a specific module permission.
 */
const MODULE_ROUTE_MAP = {
  patientSearch: ['/search', '/patient'],
  pendingRequests: ['/pending'],
  medicalRecords: ['/patient'],
  appointments: ['/appointments'],
  inventory: ['/inventory'],
  announcements: ['/announcements'],
  healthChat: ['/health-chat'],
  sendNotification: ['/notifications'],
  analytics: ['/analytics'],
  // roleManagement: '/settings/roles' — handled via isAdmin check, not module permissions
};

// Maps Search Patient sub-tab permission keys to module fallbacks.
// If granular keys are available from the entangled permission payload,
// those are used as the source of truth instead of these fallbacks.
const SEARCH_PATIENT_PERMISSION_FALLBACK_MODULES = Object.freeze({
  profile_allow_view: Object.freeze(['personalRecords']),
  emr_allow_view: Object.freeze(['medicalRecords', 'dentalRecords']),
  consultation_allow_view: Object.freeze(['consultation']),
  appointment_allow_view_records: Object.freeze(['appointments']),
  inventory_allow_manage_requests: Object.freeze(['inventory']),
  document_allow_view: Object.freeze(['documents']),
});

/**
 * PermissionsProvider — fetches and caches the current user's module permissions.
 * Wraps the app to provide permission checks via usePermissions().
 */
export const PermissionsProvider = ({ children }) => {
  const [modules, setModules] = useState(null); // { moduleId: boolean }
  const [entangledPermissions, setEntangledPermissions] = useState({}); // { code: { code, enabled, hardBlocked } }
  const [isAdmin, setIsAdmin] = useState(false);
  const [branch, setBranch] = useState(null); // 'Manila' | 'QuezonCity' | 'Both'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosRequest.get('/staff/me/permissions');
      const data = response.data;

      // Convert modules array to flat { moduleId: boolean } map
      const flat = {};
      for (const mod of data.modules || []) {
        flat[mod.moduleId] = mod.enabled;
      }

      const nextIsAdmin = Boolean(data.isAdmin);
      const derivedEntangled = deriveEntangledPermissionsFromModules(flat, { isAdmin: nextIsAdmin });

      setModules(flat);
      setIsAdmin(nextIsAdmin);
      setBranch(data.branch || 'Both');
      setEntangledPermissions(derivedEntangled);

      let resolvedEntangled = derivedEntangled;

      try {
        const fetchedEntangled = await fetchEntangledPermissions();
        resolvedEntangled = mergeEntangledPermissionMaps(derivedEntangled, fetchedEntangled);
      } catch (entangledError) {
        // Keep derived entangled states so existing flows remain stable if GraphQL entangled fetch fails.
        console.warn('Failed to fetch entangled permissions:', entangledError);
      }

      if (!nextIsAdmin && !hasSearchPatientGranularSnapshot(resolvedEntangled)) {
        try {
          const probedSearchPermissions = await fetchSearchPatientPermissionProbeMap({
            branch: data.branch || 'Both',
            existingPermissions: resolvedEntangled,
          });

          if (Object.keys(probedSearchPermissions).length > 0) {
            resolvedEntangled = mergeEntangledPermissionMaps(resolvedEntangled, probedSearchPermissions);
          }
        } catch (probeError) {
          console.warn('Failed to probe Search Patient granular permissions:', probeError);
        }
      }

      setEntangledPermissions(resolvedEntangled);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError(err.message || 'Failed to load permissions');
      // Default to no permissions on error
      setModules({});
      setEntangledPermissions({});
      setIsAdmin(false);
      setBranch('Both');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const getEntangledPermission = useCallback(
    (code) => {
      if (!code || typeof code !== 'string') return null;
      return entangledPermissions?.[code] || null;
    },
    [entangledPermissions]
  );

  const hasEntangledPermission = useCallback(
    (code) => {
      const record = getEntangledPermission(code);
      return isEntangledPermissionAllowed(record);
    },
    [getEntangledPermission]
  );

  /**
   * Check if the user has access to a specific module.
   * Admins have access to everything.
   */
  const hasPermission = useCallback(
    (moduleId) => {
      const entangledCode = MODULE_ENTANGLED_PERMISSION_MAP[moduleId];

      if (entangledCode) {
        if (!isAdmin && !modules?.[moduleId]) return false;
        // Fail-safe: undefined/disabled/hardBlocked entangled state denies access.
        return hasEntangledPermission(entangledCode);
      }

      if (isAdmin) return true;
      if (!modules) return false;
      return Boolean(modules[moduleId]);
    },
    [modules, isAdmin, hasEntangledPermission]
  );

  const resolveSearchPatientPermission = useCallback(
    (permissionKey) => {
      if (isAdmin) return true;

      // Prefer granular key states when available.
      const granularRecord = entangledPermissions?.[permissionKey];
      if (granularRecord) {
        return isEntangledPermissionAllowed(granularRecord);
      }

      const fallbackModules = SEARCH_PATIENT_PERMISSION_FALLBACK_MODULES[permissionKey] || [];
      return fallbackModules.some((moduleId) => hasPermission(moduleId));
    },
    [isAdmin, entangledPermissions, hasPermission]
  );

  const searchPatientPermissionFlags = useMemo(() => ({
    profile_allow_view: resolveSearchPatientPermission('profile_allow_view'),
    emr_allow_view: resolveSearchPatientPermission('emr_allow_view'),
    consultation_allow_view: resolveSearchPatientPermission('consultation_allow_view'),
    appointment_allow_view_records: resolveSearchPatientPermission('appointment_allow_view_records'),
    inventory_allow_manage_requests: resolveSearchPatientPermission('inventory_allow_manage_requests'),
    document_allow_view: resolveSearchPatientPermission('document_allow_view'),
  }), [resolveSearchPatientPermission]);

  const hasSearchPatientAccess = useMemo(
    () => Object.values(searchPatientPermissionFlags).some(Boolean),
    [searchPatientPermissionFlags]
  );

  /**
   * Check if the user can access a specific route path.
   * Returns true if no module restricts this path, or if the user has the required module.
   */
  const canAccessRoute = useCallback(
    (path) => {
      if (!isAdmin && !modules) return false;

      // Dashboard is always accessible
      if (path === '/' || path === '') return true;

      // Role management route is guarded by admin + entangled permission.
      if (path === '/settings/roles' || path.startsWith('/settings/roles/')) {
        return hasPermission('roleManagement');
      }

      if (path === '/search' || path.startsWith('/search/') || path.startsWith('/patient/')) {
        return hasSearchPatientAccess;
      }

      // Check if any module maps to this path
      for (const [moduleId, paths] of Object.entries(MODULE_ROUTE_MAP)) {
        if (paths.some((p) => path === p || path.startsWith(p + '/'))) {
          if (!hasPermission(moduleId)) return false;
        }
      }

      return true;
    },
    [modules, isAdmin, hasPermission, hasSearchPatientAccess]
  );

  /**
   * Check if the user can access a specific branch location.
   * Staff with 'Both' can access any branch. Otherwise must match exactly.
   */
  const canAccessBranch = useCallback(
    (targetBranch) => {
      if (isAdmin) return true;
      if (!branch) return false;
      if (branch === 'Both') return true;
      if (targetBranch === 'Both') return false; // Branch-restricted staff can't access 'Both' scope
      return branch === targetBranch;
    },
    [branch, isAdmin]
  );

  /**
   * Get the list of branch options available to the current user.
   */
  const allowedBranches = useCallback(() => {
    if (isAdmin || branch === 'Both') return ['Both', 'Manila', 'QuezonCity'];
    if (branch === 'Manila') return ['Manila'];
    if (branch === 'QuezonCity') return ['QuezonCity'];
    return ['Both', 'Manila', 'QuezonCity'];
  }, [branch, isAdmin]);

  const value = {
    modules,
    isAdmin,
    branch,
    entangledPermissions,
    searchPatientPermissionFlags,
    hasSearchPatientAccess,
    isLoading,
    error,
    hasPermission,
    getEntangledPermission,
    hasEntangledPermission,
    canAccessRoute,
    canAccessBranch,
    allowedBranches,
    refetch: fetchPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

/**
 * Force refresh permissions from server
 * Call this after admin changes are made (role updates, permission changes)
 * Usage: const { refetch } = usePermissions(); await refetch();
 */
export const refetchPermissions = async () => {
  const context = useContext(PermissionsContext);
  if (context) {
    await context.refetch();
  }
};
