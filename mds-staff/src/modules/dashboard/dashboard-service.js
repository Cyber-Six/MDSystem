/**
 * Dashboard Service
 * Fetches aggregated dashboard statistics from the staff backend.
 * Endpoint: GET /dashboard/stats (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * Fetch all dashboard statistics in a single API call.
 * Returns stats, tomorrow's availability, recent patients, and pending requests.
 * @returns {Promise<{
 *   stats: { pendingRequests: number, pendingBreakdown: object, todayAppointments: number, todayRemaining: number, activeConsultations: number, lowStockItems: number },
 *   tomorrowAvailability: Object<string, { open: number, total: number }>,
 *   recentPatients: Array<{ id: string, name: string, identifier: string, program: string, lastVisit: string }>,
 *   pendingRequests: Array<{ id: string, name: string, type: string, status: string, submitted: string }>,
 * }>}
 */
export const fetchDashboardStats = async () => {
  const response = await axiosRequest.get('/dashboard/stats');
  return response.data;
};
