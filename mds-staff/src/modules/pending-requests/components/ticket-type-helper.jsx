/**
 * ticket-type-helper.jsx
 *
 * Frontend-only utility to tell apart Initial Record submissions from
 * Record Update requests — no backend changes required.
 *
 * Logic (mirrors what the backend already enforces):
 *   - A patient whose credentials_status is 'Unverified' has never had a
 *     ticket approved.  Their submission is an INITIAL record.
 *   - Any patient with credentials_status !== 'Unverified' already has an
 *     approved record in the DB.  Their submission is an UPDATE request.
 *
 * Shortcut (always safe):
 *   scope === 'Medical' | 'Dental' → always UPDATE
 *   The backend blocks unverified patients from creating partial-scope tickets,
 *   so Medical/Dental scope is 100% guaranteed to come from a verified patient.
 */

import { axiosRequest } from '../../../packages-core-adapter';

/**
 * Session-level circuit-breaker.
 * null  = not yet tested
 * true  = at least one call succeeded (staff has profile_allow_view)
 * false = got a 401 (staff lacks profile_allow_view); skip all further calls
 *         to avoid cascading token-refresh loops across parallel ticket requests.
 */
let _credentialCheckAvailable = null;

/**
 * Calls /profile/medical → getUserCredentialStatus(userId).
 *
 * On a 401 (permission denied) the circuit-breaker is tripped and subsequent
 * calls skip the network round-trip entirely, returning null immediately.
 * On any other error null is also returned so callers can degrade gracefully.
 *
 * @param {string} userId
 * @returns {Promise<string|null>}  e.g. 'Unverified' | 'active' | null
 */
export const getUserCredentialStatus = async (userId) => {
  // Short-circuit once we know the endpoint is off-limits for this session
  if (_credentialCheckAvailable === false) return null;

  try {
    const response = await axiosRequest.post('/profile/medical', {
      query: `query GetUserCredentialStatus($userId: ID!) {
        getUserCredentialStatus(userId: $userId)
      }`,
      variables: { userId },
    });
    _credentialCheckAvailable = true;
    return response.data?.data?.getUserCredentialStatus ?? null;
  } catch (err) {
    if (err?.response?.status === 401) {
      // Permission denied — trip the circuit-breaker so we don't repeat the
      // refresh-and-retry cycle for every remaining ticket in the batch.
      _credentialCheckAvailable = false;
      console.warn(
        '[MDSystem] ticket-type-helper: Staff lacks the profile_allow_view permission ' +
        '(ALLOW_TO_VIEW_PROFILE). Falling back to scope-based ticket classification. ' +
        'Grant that role to the staff account to enable precise Initial / Update separation.',
      );
    } else {
      console.error('[MDSystem] ticket-type-helper getUserCredentialStatus error:', err?.message ?? err);
    }
    return null;
  }
};

/**
 * Adds `is_initial: boolean` to every ticket in the list.
 * All credential-status look-ups run in parallel.
 *
 * Fallback when the credential check is unavailable (null return):
 *   status !== 'active'  ←→  treat as initial.
 * This means scope='Both' tickets from verified patients will appear in the
 * Initial tab when the permission check cannot be performed — an acceptable
 * trade-off vs. the worse outcome of the Initial tab being completely empty.
 *
 * @param {Array<{patientId: string, scope: string}>} tickets
 * @returns {Promise<Array<{...ticket, is_initial: boolean}>>}
 */
export const enrichWithInitialFlag = async (tickets) =>
  Promise.all(
    tickets.map(async (ticket) => {
      // Partial-scope tickets are only submitted by verified patients → always UPDATE
      if (ticket.scope === 'Medical' || ticket.scope === 'Dental') {
        return { ...ticket, is_initial: false };
      }

      // scope === 'Both': check whether the patient has been verified before
      const status = await getUserCredentialStatus(ticket.patientId);

      // 'Unverified'       → patient has never had a ticket approved → INITIAL
      // 'active'           → patient already has approved records   → UPDATE
      // null (call failed) → unknown; fall back to treating as INITIAL (safer than
      //                      hiding the record from the Initial tab entirely)
      return { ...ticket, is_initial: status !== 'active' };
    }),
  );
