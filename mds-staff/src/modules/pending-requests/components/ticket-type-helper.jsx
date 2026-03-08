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
      return { ...ticket, is_initial: status?.toLowerCase() !== 'active' };
    }),
  );
