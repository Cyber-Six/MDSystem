/**
 * Notification Service
 * Handles REST API calls to the staff notification broadcast endpoints.
 *
 * Endpoints (mounted under /staff in staff.js):
 *   POST /staff/notify-staffs   — admin only, broadcasts to all staff
 *   POST /staff/notify-patients — any staff, broadcasts to patients in their branch/location
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * Send a broadcast notification to all staff members.
 * Requires admin permission — the backend will reject non-admins with 403.
 *
 * @param {string} message - Freeform message text
 * @returns {Promise<{ notificationId: string, totalRecipients: number, delivery: object }>}
 */
export const notifyStaffs = async (message) => {
  const response = await axiosRequest.post('/staff/notify-staffs', { message });
  return response.data;
};

/**
 * Send a broadcast notification to patients under the current staff member's
 * branch and location.
 *
 * @param {string} message - Freeform message text
 * @returns {Promise<{ notificationId: string, totalRecipients: number, delivery: object }>}
 */
export const notifyPatients = async (message) => {
  const response = await axiosRequest.post('/staff/notify-patients', { message });
  return response.data;
};
