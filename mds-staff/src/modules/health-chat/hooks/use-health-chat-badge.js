import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingTickets } from '../health-chat-service';

const POLL_INTERVAL = 60_000; // 60 seconds

/**
 * Lightweight hook to track pending health chat ticket count.
 * Designed to work outside HealthChatProvider (e.g., sidebar badge).
 * Polls every 60s for the pending count.
 */
export function useHealthChatBadge() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

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
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchCount]);

  return count;
}
