/**
 * ticket-type-helper.jsx
 *
 * Frontend-only utility to tell apart Initial Record submissions from
 * Record Update requests — no backend changes required.
 *
 * Logic:
 *   - Initial-record tickets and personal-record logs are created as part of
 *     the same workflow and share near-identical creation timestamps.
 *   - Update-request tickets are created later, while personal-record log
 *     creation time remains anchored to the initial workflow.
 *
 * We therefore classify scope='Both' tickets by comparing ticket.created_at
 * to the latest personal-record-log created_at for the same user.
 *
 * Shortcut (always safe):
 *   scope === 'Medical' | 'Dental' → always UPDATE
 *   The backend blocks unverified patients from creating partial-scope tickets,
 *   so Medical/Dental scope is 100% guaranteed to come from a verified patient.
 */

import { axiosRequest } from '../../../packages-core-adapter';

/**
 * Calls /profile/medical → getUserCredentialStatus(userId).
 * Returns null on any error so callers can degrade gracefully.
 *
 * @param {string} userId
 * @returns {Promise<string|null>}  e.g. 'Unverified' | 'active' | null
 */
export const getUserCredentialStatus = async (userId) => {
  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `query GetUserCredentialStatus($userId: ID!) {
        getUserCredentialStatus(userId: $userId)
      }`,
      variables: { userId },
    });
    return response.data?.data?.getUserCredentialStatus ?? null;
  } catch (err) {
    console.error('[MDSystem] ticket-type-helper getUserCredentialStatus error:', err?.message ?? err);
    return null;
  }
};

/**
 * Fetches the latest personal-record log metadata for a patient.
 * We only need created_at/status for initial-vs-update classification.
 *
 * @param {string} userId
 * @returns {Promise<{created_at?: string, status?: string}|null>}
 */
export const getLatestPersonalRecordLogMeta = async (userId) => {
  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `query GetLatestPersonalRecordLogMeta($userId: ID!, $limit: Int) {
        getUserPersonalRecordLog(userId: $userId, limit: $limit) {
          id
          status
          created_at
        }
      }`,
      variables: { userId, limit: 1 },
    });

    const rows = response.data?.data?.getUserPersonalRecordLog;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[MDSystem] ticket-type-helper getLatestPersonalRecordLogMeta error:', err?.message ?? err);
    return null;
  }
};

const INITIAL_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour window for initial record submission

const isNearSameTimestamp = (a, b) => {
  const aMs = a ? new Date(a).getTime() : NaN;
  const bMs = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return false;
  return Math.abs(aMs - bMs) <= INITIAL_MATCH_WINDOW_MS;
};

/**
 * Adds `is_initial: boolean` to every ticket in the list.
 * All look-ups run in parallel.
 *
 * Fallback strategy when timestamp-based check is unavailable:
 * use credential-status heuristic for backward compatibility.
 *
 * @param {Array<{patientId: string, scope: string, created_at?: string}>} tickets
 * @returns {Promise<Array<{...ticket, is_initial: boolean}>>}
 */
export const enrichWithInitialFlag = async (tickets) => {
  const logMetaCache = new Map();
  const credentialCache = new Map();

  const getCachedLogMeta = async (userId) => {
    if (!logMetaCache.has(userId)) {
      logMetaCache.set(userId, await getLatestPersonalRecordLogMeta(userId));
    }
    return logMetaCache.get(userId);
  };

  const getCachedCredentialStatus = async (userId) => {
    if (!credentialCache.has(userId)) {
      credentialCache.set(userId, await getUserCredentialStatus(userId));
    }
    return credentialCache.get(userId);
  };

  return Promise.all(
    tickets.map(async (ticket) => {
      // Partial-scope tickets are only submitted by verified patients → always UPDATE
      if (ticket.scope === 'Medical' || ticket.scope === 'Dental') {
        return { ...ticket, is_initial: false };
      }

      const latestPersonalLog = await getCachedLogMeta(ticket.patientId);

      if (latestPersonalLog?.created_at && isNearSameTimestamp(ticket.created_at, latestPersonalLog.created_at)) {
        return { ...ticket, is_initial: true };
      }

      // Backward-compatible fallback when log metadata is unavailable.
      if (!latestPersonalLog) {
        const status = await getCachedCredentialStatus(ticket.patientId);
        return { ...ticket, is_initial: status?.toLowerCase() !== 'active' };
      }

      return { ...ticket, is_initial: false };
    }),
  );
};
