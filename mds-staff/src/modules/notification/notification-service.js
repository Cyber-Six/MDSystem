/**
 * Notification Service
 * Handles REST API calls to the staff notification broadcast endpoints,
 * and GraphQL queries for fetching available recipients.
 *
 * Endpoints (mounted under /staff in staff.js):
 *   POST /staff/notify-staffs   — admin only, broadcasts to staff
 *   POST /staff/notify-patients — any staff, broadcasts to patients in their branch/location
 *
 * GraphQL endpoints:
 *   POST /rolemanagement/admin  — admin only, lists staff accounts
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── GraphQL: Staff listing (admin-only) ──────────────────────────────────────

const LIST_STAFF_QUERY = `
  query ListStaffAccounts {
    listStaffAccounts {
      staff {
        id
        name
        email
        role
        branch
      }
      count
    }
  }
`;

/**
 * Fetch all staff accounts for recipient selection (admin only).
 * Uses the role-management GraphQL endpoint.
 *
 * @returns {Promise<Array<{ id: string, name: string, email: string, role: string, branch: string }>>}
 */
export const fetchAllStaff = async () => {
  const response = await axiosRequest.post('/rolemanagement/admin', {
    query: LIST_STAFF_QUERY,
  });
  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'Failed to load staff list');
  }
  return response.data.data.listStaffAccounts.staff || [];
};

// ── Notification send functions ───────────────────────────────────────────────

/**
 * Send a broadcast notification to staff members.
 * Requires admin permission — the backend will reject non-admins with 403.
 *
 * @param {string} message - Freeform message text
 * @param {string[]|null} [recipientIds] - Specific staff IDs to notify.
 *   If null/omitted, notifies all staff.
 * @returns {Promise<{ notificationId: string, totalRecipients: number, delivery: object }>}
 */
export const notifyStaffs = async (message, recipientIds = null) => {
  const payload = { message };
  if (recipientIds && recipientIds.length > 0) {
    payload.recipientIds = recipientIds;
  }
  const response = await axiosRequest.post('/staff/notify-staffs', payload);
  return response.data;
};

/**
 * Send a broadcast notification to patients under the current staff member's
 * branch and location.
 *
 * @param {string} message - Freeform message text
 * @param {string[]|null} [recipientIds] - Specific patient IDs to notify.
 *   If null/omitted, notifies all patients in the staff's branch/location.
 * @returns {Promise<{ notificationId: string, totalRecipients: number, delivery: object }>}
 */
export const notifyPatients = async (message, recipientIds = null) => {
  const payload = { message };
  if (recipientIds && recipientIds.length > 0) {
    payload.recipientIds = recipientIds;
  }
  const response = await axiosRequest.post('/staff/notify-patients', payload);
  return response.data;
};
