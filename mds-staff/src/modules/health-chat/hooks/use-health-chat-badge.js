import { useState, useEffect, useCallback } from 'react';
import { getPendingTickets } from '../health-chat-service';
import { useStaffProfile } from '../../../hooks/use-staff-profile';

/**
 * Lightweight hook to track pending health chat ticket count.
 * Designed to work outside HealthChatProvider (e.g., sidebar badge).
 * Fetches the pending count when mounted, passing the staff's branch for permission alignment.
 */
export function useHealthChatBadge() {
  const [count, setCount] = useState(0);
  const { profile } = useStaffProfile();

  const fetchCount = useCallback(async () => {
    try {
      // Pass staff member's branch to align with permissions
      const location = profile?.branch || 'Both';
      const result = await getPendingTickets(0, 1, location);
      setCount(result?.total ?? 0);
    } catch {
      // Silently ignore — badge is non-critical
    }
  }, [profile?.branch]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return count;
}
