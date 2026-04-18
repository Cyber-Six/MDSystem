import { useState, useEffect } from 'react';
import { getPendingTickets } from '../health-chat-service';
import { useStaffProfile } from '../../../hooks/use-staff-profile';
import { usePermissions } from '../../../context/permissions-context';

const HEALTH_CHAT_BADGE_CACHE_KEY = 'staff_health_chat_badge_count';

function loadCachedBadgeCount() {
  try {
    const raw = sessionStorage.getItem(HEALTH_CHAT_BADGE_CACHE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function persistBadgeCount(count) {
  try {
    sessionStorage.setItem(HEALTH_CHAT_BADGE_CACHE_KEY, String(count));
  } catch {
    // ignore storage write failures
  }
}

/**
 * Lightweight hook to track pending health chat ticket count.
 * Designed to work outside HealthChatProvider (e.g., sidebar badge).
 * Fetches the pending count when mounted, passing the staff's branch for permission alignment.
 */
export function useHealthChatBadge(options = {}) {
  const enabled = options.enabled !== false;
  const [count, setCount] = useState(() => loadCachedBadgeCount());
  const { profile } = useStaffProfile();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const hasHealthChatPermission = hasPermission('healthChat');

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      if (!enabled) return;

      // Don't request if permissions are still loading or staff lacks health chat access
      if (permissionsLoading || !hasHealthChatPermission) {
        persistBadgeCount(0);
        return;
      }

      try {
        // Pass staff member's branch to align with permissions
        const location = profile?.branch || 'Both';
        const result = await getPendingTickets(0, 1, location);
        const nextCount = Number(result?.total ?? 0);
        if (cancelled) return;
        setCount(nextCount);
        persistBadgeCount(nextCount);
      } catch {
        // Silently ignore — badge is non-critical
      }
    };

    fetchCount();

    return () => {
      cancelled = true;
    };
  }, [enabled, permissionsLoading, hasHealthChatPermission, profile?.branch]);

  if (!enabled || permissionsLoading || !hasHealthChatPermission) {
    return 0;
  }

  return count;
}
