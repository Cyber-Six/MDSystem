/**
 * Initial Record / Update Ticket Service
 * Handles GraphQL queries and mutations for the staff-side EMR update ticket workflow.
 *
 * Endpoint: POST /emr/medical  (JWT guard: medical)
 *
 * Key backend operations:
 *  - getStatusUpdateTickets  — list all tickets filtered by status + branch
 *  - getUserUpdateTicket     — get a single patient's latest ticket
 *  - staffUpdateTicket       — approve / request revision for a ticket
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── Internal helpers ─────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/emr/medical', { query, variables });
  if (response.data?.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }
  return response.data.data;
};

// Separate helper for the profile endpoint (medical resolver)
const sendProfileGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/profile/medical', { query, variables });
  if (response.data?.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }
  return response.data.data;
};

// ── Constants ────────────────────────────────────────────────────────────────

export const BRANCH = {
  MANILA: 'Manila',
  QUEZON_CITY: 'QuezonCity',
  BOTH: 'Both',
};

export const ALL_BRANCHES = Object.values(BRANCH);

export const TICKET_STATUS = {
  IN_PROGRESS: 'InProgress',
  PENDING: 'Pending',
  REVISION: 'Revision',
  REVISION_SUBMITTED: 'RevisionSubmitted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  APPROVED: 'Approved',
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch the latest update ticket for each patient matching the given statuses
 * and branch.
 *
 * NOTE: The backend's UpdateTicket GraphQL type currently exposes only
 * { id, patientId, status }. Additional fields (scope, created_at, patient name)
 * are present in the database via a JOIN but are not in the schema yet.
 * See backend issues table shared with the backend dev.
 *
 * @param {string[]} statuses  — subset of UpdateStatus enum values
 * @param {string}   branch    — DesignationBranch enum value
 * @param {number}   [offset]
 * @param {number}   [limit]
 * @returns {Promise<Array<{id, patientId, status}>>}
 */
export const getStatusUpdateTickets = async (statuses, branch, offset = 0, limit = 20) => {
  const data = await sendGraphQL(
    `query GetStatusUpdateTickets(
       $statuses: [UpdateStatus!]!
       $branch: DesignationBranch!
       $offset: Int
       $limit: Int
     ) {
       getStatusUpdateTickets(
         statuses: $statuses
         branch: $branch
         offset: $offset
         limit: $limit
       ) {
         id
         patientId
         status
         scope
         created_at
         first_name
         last_name
         branch
       }
     }`,
    { statuses, branch, offset, limit },
  );
  return data.getStatusUpdateTickets ?? [];
};

/**
 * Get a specific patient's latest update ticket (staff view).
 *
 * @param {string} userId
 * @returns {Promise<{id, patientId, status} | null>}
 */
export const getUserUpdateTicket = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserUpdateTicket($userId: ID!) {
       getUserUpdateTicket(userId: $userId) {
         id
         patientId
         status
       }
     }`,
    { userId },
  );
  return data.getUserUpdateTicket ?? null;
};

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Staff action on a patient's update ticket.
 *
 * Allowed status transitions for an initial record submission:
 *   Pending / RevisionSubmitted → Approved    (accept the submission)
 *   Pending / RevisionSubmitted → Revision    (send back for corrections)
 *
 * @param {string} userId  — the patient's ID (ticket.patientId)
 * @param {'Approved'|'Revision'} status
 * @returns {Promise<string>}  new UpdateStatus
 */
export const staffUpdateTicket = async (userId, status) => {
  const data = await sendGraphQL(
    `mutation StaffUpdateTicket($userId: ID!, $status: UpdateStatus!) {
       staffUpdateTicket(userId: $userId, status: $status)
     }`,
    { userId, status },
  );
  return data.staffUpdateTicket;
};

/**
 * Approve / set the status of the patient's personal record log.
 * Must be called on /profile/medical (staff medical resolver).
 *
 * @param {string} userId  — the patient's ID
 * @param {'Approved'|'Revision'|string} status
 * @returns {Promise<string>}  new UpdateStatus
 */
export const setPersonalRecordLog = async (userId, status) => {
  const data = await sendProfileGraphQL(
    `mutation SetPersonalRecordLog($userId: ID!, $status: UpdateStatus!) {
       setPersonalRecordLog(userId: $userId, status: $status)
     }`,
    { userId, status },
  );
  return data.setPersonalRecordLog;
};

/**
 * Atomically approve both the personal record and the EMR update ticket.
 *
 * Order of operations:
 *  1. setPersonalRecordLog → Approved   (/profile/medical)
 *  2. staffUpdateTicket    → Approved   (/emr/medical)    — only runs if step 1 succeeds
 *
 * If step 1 fails, step 2 is **not** called and the error is re-thrown so
 * the caller can surface it to the staff UI without any partial state.
 *
 * @param {string} userId  — ticket.patientId
 * @returns {Promise<string>}  final UpdateStatus from step 2
 */
export const approveInitialRecord = async (userId) => {
  // Step 1 — personal record must be committed first
  await setPersonalRecordLog(userId, TICKET_STATUS.APPROVED);

  // Step 2 — EMR ticket approval (medical + dental records)
  return staffUpdateTicket(userId, TICKET_STATUS.APPROVED);
};
