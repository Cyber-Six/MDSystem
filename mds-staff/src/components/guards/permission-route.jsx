import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../context/permissions-context';
import { useBanner } from '../../context/use-banner';

/**
 * PermissionRoute — wraps a route element and checks module permissions.
 * If the user lacks the required module, shows a toast and redirects to dashboard.
 *
 * @param {string} moduleId - The module permission required (e.g. 'appointments')
 * @param {boolean} requireSearchPatientAccess - If true, checks the composite Search Patient access gate
 * @param {React.ReactNode} children - The route element to render if permitted
 * @param {boolean} adminOnly - If true, only admins can access this route
 */
const PermissionRoute = ({ moduleId, adminOnly = false, requireSearchPatientAccess = false, children }) => {
  const { hasPermission, hasSearchPatientAccess, isAdmin, isLoading } = usePermissions();
  const { showBanner } = useBanner();
  const location = useLocation();

  let isAllowed = false;
  if (adminOnly) {
    isAllowed = isAdmin;
  } else if (requireSearchPatientAccess) {
    isAllowed = hasSearchPatientAccess;
  } else if (Array.isArray(moduleId)) {
    isAllowed = moduleId.some((id) => hasPermission(id));
  } else if (!moduleId) {
    isAllowed = true;
  } else {
    isAllowed = hasPermission(moduleId);
  }

  useEffect(() => {
    if (!isLoading && !isAllowed) {
      showBanner({
        type: 'error',
        message: 'You do not have permission to access this page.',
        duration: 5000,
      });
    }
  }, [isLoading, isAllowed, showBanner]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAllowed) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default PermissionRoute;
