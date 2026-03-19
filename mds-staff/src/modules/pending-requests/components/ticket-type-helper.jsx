/**
 * ticket-type-helper.jsx
 *
 * Frontend-only utility to tell apart Initial Record submissions from
 * Record Update requests — no backend changes required.
 *
 * Classification logic (in priority order):
 *
 *   1. scope === 'Medical' | 'Dental'  → always UPDATE
 *      The backend blocks unverified patients from creating partial-scope tickets,
 *      so Medical/Dental scope is 100% guaranteed to come from a verified patient.
 *
 *   2. scope === 'Both' + credentials_status = 'Unverified'
 *      → always INITIAL — patient has never been approved, no ambiguity.
 *
 *   3. scope === 'Both' + credentials_status = 'Active' + ticket.status ≠ 'Approved'
 *      → always UPDATE — the initial record was already approved (that is what made
 *      them Active). Any new pending/revision ticket from an Active patient is an update.
 *
 *   4. scope === 'Both' + credentials_status = 'Active' + ticket.status === 'Approved'
 *      → check count of Approved personal-record-log entries:
 *          count = 1  →  INITIAL  (their initial is the only thing ever approved)
 *          count ≥ 2  →  UPDATE   (at least one update was also approved)
 *      UsersPersonalLog is append-only; only the final approved submission in any
 *      workflow gets status='Approved', so revision cycles do not inflate this count.
 *
 *   5. Fallback (APIs unavailable) → timestamp comparison against the latest
 *      personal-record-log created_at as a last resort.
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
 * Kept as a public export for backward-compatibility and used as a timestamp
 * fallback inside enrichWithInitialFlag when other APIs are unavailable.
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

/**
 * Fetches the personal-record log history for a patient (up to 50 entries).
 * Used internally to count how many submissions have ever been Approved,
 * which is the reliable non-time-based signal for initial-vs-update classification.
 *
 * UsersPersonalLog is append-only — each submission inserts a fresh row. Only the
 * final accepted submission in any workflow ever receives status='Approved', so
 * revision cycles do not inflate the approved count.
 *
 * @param {string} userId
 * @returns {Promise<Array<{id: string, status: string, created_at: string}>|null>}
 */
const _getPersonalRecordLogs = async (userId) => {
  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `query GetPersonalRecordLogs($userId: ID!, $limit: Int) {
        getUserPersonalRecordLog(userId: $userId, limit: $limit) {
          id
          status
          created_at
        }
      }`,
      variables: { userId, limit: 50 },
    });
    const rows = response.data?.data?.getUserPersonalRecordLog;
    return Array.isArray(rows) ? rows : null;
  } catch (err) {
    console.error('[MDSystem] ticket-type-helper _getPersonalRecordLogs error:', err?.message ?? err);
    return null;
  }
};

// Used only as a last-resort fallback when all status-based checks are unavailable.
const INITIAL_MATCH_WINDOW_MS = 10 * 60 * 1000; // 10-minute window

const isNearSameTimestamp = (a, b) => {
  const aMs = a ? new Date(a).getTime() : NaN;
  const bMs = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return false;
  return Math.abs(aMs - bMs) <= INITIAL_MATCH_WINDOW_MS;
};

/**
 * Adds `is_initial: boolean` to every ticket in the list.
 * All look-ups are cached per-user and run in parallel.
 *
 * Primary classification is purely status-based (no time needed for cases 1–4).
 * Timestamp comparison is only used as a last-resort fallback when both the
 * credential-status API and the personal-record-log API are unavailable.
 *
 * @param {Array<{patientId: string, scope: string, status: string, created_at?: string}>} tickets
 * @returns {Promise<Array<{...ticket, is_initial: boolean}>>}
 */
export const enrichWithInitialFlag = async (tickets) => {
  const credentialCache = new Map();
  const logCache = new Map();

  const getCachedCredentialStatus = async (userId) => {
    if (!credentialCache.has(userId)) {
      credentialCache.set(userId, await getUserCredentialStatus(userId));
    }
    return credentialCache.get(userId);
  };

  const getCachedLogs = async (userId) => {
    if (!logCache.has(userId)) {
      logCache.set(userId, await _getPersonalRecordLogs(userId));
    }
    return logCache.get(userId);
  };

  return Promise.all(
    tickets.map(async (ticket) => {
      // ── Step 1 ──────────────────────────────────────────────────────────────
      // Partial-scope tickets are only submitted by verified patients → always UPDATE
      if (ticket.scope === 'Medical' || ticket.scope === 'Dental') {
        return { ...ticket, is_initial: false };
      }

      const credStatus = await getCachedCredentialStatus(ticket.patientId);

      // ── Step 2 ──────────────────────────────────────────────────────────────
      // Unverified → patient has never been approved → definitely INITIAL.
      if (credStatus !== null && credStatus.toLowerCase() !== 'active') {
        return { ...ticket, is_initial: true };
      }

      if (credStatus !== null) {
        // ── Step 3 ────────────────────────────────────────────────────────────
        // Active + non-Approved ticket → UPDATE.
        // The initial was already approved before this patient became Active.
        // Any new pending/revision submission from them is an update.
        if (ticket.status !== 'Approved') {
          return { ...ticket, is_initial: false };
        }

        // ── Step 4 ────────────────────────────────────────────────────────────
        // Active + Approved ticket → count Approved log entries.
        // Exactly 1 Approved entry = only the initial was ever approved → INITIAL.
        // 2 or more = at least one update was also approved → UPDATE.
        const logs = await getCachedLogs(ticket.patientId);
        if (logs !== null) {
          const approvedCount = logs.filter((l) => l.status === 'Approved').length;
          return { ...ticket, is_initial: approvedCount === 1 };
        }
      }

      // ── Step 5 (fallback) ────────────────────────────────────────────────────
      // Both APIs unavailable — fall back to timestamp comparison as last resort.
      const logs = await getCachedLogs(ticket.patientId);
      const latestLog = Array.isArray(logs) ? logs[0] : null;
      if (latestLog?.created_at) {
        return { ...ticket, is_initial: isNearSameTimestamp(ticket.created_at, latestLog.created_at) };
      }

      // Absolute last resort: credential status alone (Unverified=initial, else update).
      if (credStatus !== null) {
        return { ...ticket, is_initial: credStatus.toLowerCase() !== 'active' };
      }

      return { ...ticket, is_initial: false };
    }),
  );
};
