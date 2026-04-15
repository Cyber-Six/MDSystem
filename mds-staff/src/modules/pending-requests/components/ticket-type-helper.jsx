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
 *   3. scope === 'Both' + credentials_status != 'Unverified' + ticket.status ≠ 'Approved'
 *      → always UPDATE — backend validation treats any non-Unverified status as
 *      already validated. Any new pending/revision ticket from a validated patient
 *      is an update request.
 *
 *   4. scope === 'Both' + credentials_status != 'Unverified' + ticket.status === 'Approved'
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

// ── Module-level per-user caches ─────────────────────────────────────────────
const _credStore = new Map(); // userId → { val: any, ts: number }
const _logStore  = new Map(); // userId → { val: any, ts: number }
const _CRED_TTL  = 5 * 60_000; // 5 min
const _LOG_TTL   = 2 * 60_000; // 2 min

const normalizeCredentialStatus = (status) => (
  typeof status === 'string' ? status.trim().toLowerCase() : null
);

const isUnverifiedCredential = (status) => normalizeCredentialStatus(status) === 'unverified';

const isValidatedCredential = (status) => {
  const normalized = normalizeCredentialStatus(status);
  return normalized !== null && normalized !== 'unverified';
};

// Converts a userId (UUID with hyphens, numeric id, etc.) into a valid
// GraphQL field alias: letters/digits/underscores only, must start with a letter.
const _toAlias = (userId) => 'u_' + String(userId).replace(/[^a-zA-Z0-9]/g, '_');

/**
 * Sends ONE batched GraphQL request that fetches credential statuses for
 * every supplied userId using field aliases.  Reduces N round-trips to 1.
 *
 * @param {string[]} userIds
 * @returns {Promise<Record<string, string|null>>}
 */
const _batchGetCredentialStatuses = async (userIds) => {
  if (userIds.length === 0) return {};
  const fields = userIds
    .map((id) => `${_toAlias(id)}: getUserCredentialStatus(userId: "${id}")`)
    .join('\n  ');
  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `{ ${fields} }`,
    });
    const data = response.data?.data ?? {};
    return Object.fromEntries(userIds.map((id) => [id, data[_toAlias(id)] ?? null]));
  } catch (err) {
    console.error('[MDSystem] _batchGetCredentialStatuses error:', err?.message ?? err);
    return Object.fromEntries(userIds.map((id) => [id, null]));
  }
};

/**
 * Sends ONE batched GraphQL request that fetches personal-record logs for
 * every supplied userId using field aliases.  Reduces M round-trips to 1.
 *
 * @param {string[]} userIds
 * @returns {Promise<Record<string, Array|null>>}
 */
const _batchGetPersonalRecordLogs = async (userIds) => {
  if (userIds.length === 0) return {};
  const fields = userIds
    .map((id) => `${_toAlias(id)}: getUserPersonalRecordLog(userId: "${id}", limit: 50) { id status created_at }`)
    .join('\n  ');
  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `{ ${fields} }`,
    });
    const data = response.data?.data ?? {};
    return Object.fromEntries(
      userIds.map((id) => [id, Array.isArray(data[_toAlias(id)]) ? data[_toAlias(id)] : null]),
    );
  } catch (err) {
    console.error('[MDSystem] _batchGetPersonalRecordLogs error:', err?.message ?? err);
    return Object.fromEntries(userIds.map((id) => [id, null]));
  }
};

/**
 * Adds `is_initial: boolean` to every ticket in the list.
 *
 * Optimisation strategy (replaces per-ticket individual HTTP calls):
 *  1. Collect all unique patientIds that need enrichment (scope = 'Both').
 *  2. Check module-level cache; batch-fetch only the stale/missing entries in
 *     ONE network request for credential statuses.
 *  3. Identify which patients additionally need log data (validated + Approved).
 *  4. Batch-fetch those logs in ONE additional network request.
 *  5. Classify every ticket synchronously from the pre-fetched data.
 *
 * Worst-case: 2 HTTP requests regardless of list length (down from N×2).
 * Cache hits: 0 HTTP requests.
 *
 * @param {Array<{patientId: string, scope: string, status: string, created_at?: string}>} tickets
 * @returns {Promise<Array<{...ticket, is_initial: boolean}>>}
 */
export const enrichWithInitialFlag = async (tickets) => {
  if (tickets.length === 0) return [];

  // Tickets whose scope already determines the answer need no API calls.
  const bothScopeTickets = tickets.filter(
    (t) => t.scope !== 'Medical' && t.scope !== 'Dental',
  );

  if (bothScopeTickets.length === 0) {
    return tickets.map((t) => ({ ...t, is_initial: false }));
  }

  const now = Date.now();
  const uniqueIds = [...new Set(bothScopeTickets.map((t) => t.patientId))];

  // ── Phase 1: Credential statuses ──────────────────────────────────────────
  const staleCreds = uniqueIds.filter((id) => {
    const e = _credStore.get(id);
    return !e || now - e.ts >= _CRED_TTL;
  });

  if (staleCreds.length > 0) {
    const fetched = await _batchGetCredentialStatuses(staleCreds);
    const fetchTs = Date.now();
    for (const [id, val] of Object.entries(fetched)) {
      _credStore.set(id, { val, ts: fetchTs });
    }
  }

  const credStatuses = Object.fromEntries(
    uniqueIds.map((id) => [id, _credStore.get(id)?.val ?? null]),
  );

  // ── Phase 2: Personal-record logs (only for validated + Approved patients) ─
  const needsLog = uniqueIds.filter((id) => {
    const cred = credStatuses[id];
    if (!isValidatedCredential(cred)) return false;
    // Only needed when a ticket for this patient is in Approved status (Step 4),
    // OR when cred is unavailable and we fall back to timestamp comparison (Step 5).
    return bothScopeTickets.some((t) => t.patientId === id && t.status === 'Approved');
  });

  // Also prefetch logs for patients whose credential status is null (Step 5 fallback).
  const needsFallbackLog = uniqueIds.filter((id) => credStatuses[id] === null);

  const allLogIds = [...new Set([...needsLog, ...needsFallbackLog])];
  const staleLogs = allLogIds.filter((id) => {
    const e = _logStore.get(id);
    return !e || now - e.ts >= _LOG_TTL;
  });

  if (staleLogs.length > 0) {
    const fetched = await _batchGetPersonalRecordLogs(staleLogs);
    const fetchTs = Date.now();
    for (const [id, val] of Object.entries(fetched)) {
      _logStore.set(id, { val, ts: fetchTs });
    }
  }

  // ── Phase 3: Synchronous classification ───────────────────────────────────
  return tickets.map((ticket) => {
    // Step 1: partial scope → always UPDATE
    if (ticket.scope === 'Medical' || ticket.scope === 'Dental') {
      return { ...ticket, is_initial: false };
    }

    const credStatus = credStatuses[ticket.patientId];

    // Step 2: Unverified → INITIAL
    if (isUnverifiedCredential(credStatus)) {
      return { ...ticket, is_initial: true };
    }

    if (isValidatedCredential(credStatus)) {
      // Step 3: Validated + non-Approved → UPDATE
      if (ticket.status !== 'Approved') {
        return { ...ticket, is_initial: false };
      }

      // Step 4: Validated + Approved → count Approved log entries
      const logs = _logStore.get(ticket.patientId)?.val ?? null;
      if (logs !== null) {
        const approvedCount = logs.filter((l) => l.status === 'Approved').length;
        return { ...ticket, is_initial: approvedCount === 1 };
      }
    }

    // Step 5: fallback — timestamp comparison
    const logs = _logStore.get(ticket.patientId)?.val ?? null;
    const latestLog = Array.isArray(logs) ? logs[0] : null;
    if (latestLog?.created_at) {
      return { ...ticket, is_initial: isNearSameTimestamp(ticket.created_at, latestLog.created_at) };
    }

    if (credStatus !== null && credStatus !== undefined) {
      return { ...ticket, is_initial: isUnverifiedCredential(credStatus) };
    }

    return { ...ticket, is_initial: false };
  });
};
