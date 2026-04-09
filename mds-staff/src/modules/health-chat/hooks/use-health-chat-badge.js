import { useState, useEffect, useCallback } from 'react';
import { getPendingTickets } from '../health-chat-service';
import { useStaffProfile } from '../../../hooks/use-staff-profile';
import { usePermissions } from '../../../context/permissions-context';

/**
 * Lightweight hook to track pending health chat ticket count.
 * Designed to work outside HealthChatProvider (e.g., sidebar badge).
 * Fetches the pending count when mounted, passing the staff's branch for permission alignment.
 */
export function useHealthChatBadge() {
  const [count, setCount] = useState(0);
  const { profile } = useStaffProfile();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const fetchCount = useCallback(async () => {
    // Don't request if permissions are still loading or staff lacks health chat access
    if (permissionsLoading || !hasPermission('healthChat')) {
      setCount(0);
      return;
    }
    try {
      // Pass staff member's branch to align with permissions
      const location = profile?.branch || 'Both';
      const result = await getPendingTickets(0, 1, location);
      setCount(result?.total ?? 0);
    } catch {
      // Silently ignore — badge is non-critical
    }
  }, [profile?.branch, hasPermission, permissionsLoading]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return count;
}
