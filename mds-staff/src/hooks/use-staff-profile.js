import { useState, useEffect, useCallback } from 'react';
import { axiosRequest } from '../packages-core-adapter';

let cachedProfile = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch and cache the current staff member's profile.
 * Returns { profile, isLoading, error, refetch }.
 *
 * profile shape:
 *   { email, name, firstName, lastName, role, branch, isActive }
 */
export function useStaffProfile() {
  const [profile, setProfile] = useState(cachedProfile);
  const [isLoading, setIsLoading] = useState(!cachedProfile);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedProfile && now - cacheTimestamp < CACHE_TTL_MS) {
      setProfile(cachedProfile);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosRequest.get('/staff/me/profile');
      cachedProfile = response.data;
      cacheTimestamp = Date.now();
      setProfile(cachedProfile);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refetch: () => fetchProfile(true) };
}
