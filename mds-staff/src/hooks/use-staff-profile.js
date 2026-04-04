import { useState, useEffect, useRef, useCallback } from 'react';
import { axiosRequest } from '../packages-core-adapter';

// Module-level cache shared across all hook instances
let cachedProfile = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-flight promise: deduplicates concurrent requests from multiple components
let inFlight = null;

/**
 * Clear the cached profile — call this on logout so the next
 * login session always fetches fresh data.
 */
export function clearStaffProfileCache() {
  cachedProfile = null;
  cacheTimestamp = 0;
  inFlight = null;
}

/**
 * Hook to fetch and cache the current staff member's profile.
 * Returns { profile, isLoading, error, refetch }.
 *
 * profile shape:
 *   { email, name, firstName, lastName, role, branch, isActive }
 */
export function useStaffProfile() {
  const isCached = cachedProfile && Date.now() - cacheTimestamp < CACHE_TTL_MS;
  const [profile, setProfile] = useState(isCached ? cachedProfile : null);
  const [isLoading, setIsLoading] = useState(!isCached);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchProfile = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedProfile && now - cacheTimestamp < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setProfile(cachedProfile);
        setIsLoading(false);
      }
      return;
    }

    // Reuse the same in-flight promise if one is already running
    if (!inFlight) {
      inFlight = axiosRequest.get('/staff/me/profile').then((res) => {
        cachedProfile = res.data;
        cacheTimestamp = Date.now();
        return cachedProfile;
      }).finally(() => {
        inFlight = null;
      });
    }

    if (mountedRef.current) setIsLoading(true);

    try {
      const data = await inFlight;
      if (mountedRef.current) {
        setProfile(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to load profile');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refetch: () => fetchProfile(true) };
}
