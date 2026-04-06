import { useState, useEffect, useCallback } from 'react';
import { getPendingTickets } from '../health-chat-service';

/**
 * Lightweight hook to track pending health chat ticket count.
 * Designed to work outside HealthChatProvider (e.g., sidebar badge).
 * Fetches the pending count when mounted.
 */
export function useHealthChatBadge() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const result = await getPendingTickets(0, 1);
      setCount(result?.total ?? 0);
    } catch {
      // Silently ignore — badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return count;
}
