import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { axiosRequest } from '../packages-core-adapter';

const PermissionsContext = createContext(null);

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

/**
 * PermissionsProvider — fetches and caches the current user's module permissions.
 * Wraps the app to provide permission checks via usePermissions().
 */
export const PermissionsProvider = ({ children }) => {
  const [modules, setModules] = useState(null); // { moduleId: boolean }
  const [isAdmin, setIsAdmin] = useState(false);
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

      setModules(flat);
      setIsAdmin(data.isAdmin || false);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError(err.message || 'Failed to load permissions');
      // Default to no permissions on error
      setModules({});
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Check if the user has access to a specific module.
   * Admins have access to everything.
   */
  const hasPermission = useCallback(
    (moduleId) => {
      if (isAdmin) return true;
      if (!modules) return false;
      return !!modules[moduleId];
    },
    [modules, isAdmin]
  );

  /**
   * Check if the user can access a specific route path.
   * Returns true if no module restricts this path, or if the user has the required module.
   */
  const canAccessRoute = useCallback(
    (path) => {
      if (isAdmin) return true;
      if (!modules) return false;

      // Dashboard is always accessible
      if (path === '/' || path === '') return true;

      // Admin-only routes — only accessible via is_admin
      if (path === '/settings/roles' || path.startsWith('/settings/roles/')) return false;

      // Check if any module maps to this path
      for (const [moduleId, paths] of Object.entries(MODULE_ROUTE_MAP)) {
        if (paths.some((p) => path === p || path.startsWith(p + '/'))) {
          if (!modules[moduleId]) return false;
        }
      }

      return true;
    },
    [modules, isAdmin]
  );

  const value = {
    modules,
    isAdmin,
    isLoading,
    error,
    hasPermission,
    canAccessRoute,
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
