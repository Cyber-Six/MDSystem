/**
 * Dashboard Service
 * Fetches aggregated dashboard statistics from the staff backend using GraphQL.
 * Endpoint: POST /dashboard (GraphQL)
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * GraphQL query for dashboard statistics
 */
const GET_DASHBOARD_STATS_QUERY = `
  query GetDashboardStats {
    getDashboardStats {
      pendingRequests
      pendingBreakdown {
        emr
        appointments
        medicine
      }
      todayAppointments
      todayRemaining
      activeConsultations
      lowStockItems
      tomorrowAvailability {
        label
        open
        total
      }
      recentPatients {
        id
        name
        identifier
        program
        lastVisit
      }
      recentRequests {
        id
        name
        type
        status
        submitted
      }
    }
  }
`;

/**
 * Fetch all dashboard statistics in a single GraphQL query.
 * Returns stats, tomorrow's availability, recent patients, and pending requests.
 *
 * @returns {Promise<{
 *   pendingRequests: number,
 *   pendingBreakdown: { emr: number, appointments: number, medicine: number },
 *   todayAppointments: number,
 *   todayRemaining: number,
 *   activeConsultations: number,
 *   lowStockItems: number,
 *   tomorrowAvailability: Array<{ label: string, open: number, total: number }>,
 *   recentPatients: Array<{ id: string, name: string, identifier: string, program: string, lastVisit: string }>,
 *   recentRequests: Array<{ id: string, name: string, type: string, status: string, submitted: string }>,
 * }>}
 */
export const fetchDashboardStats = async () => {
  try {
    const response = await axiosRequest.post('/dashboard', {
      query: GET_DASHBOARD_STATS_QUERY,
    });

    // Handle GraphQL errors
    if (response.data.errors) {
      const error = new Error(response.data.errors[0]?.message || 'GraphQL error');
      error.graphQLErrors = response.data.errors;
      throw error;
    }

    // Return the data from the query
    return response.data.data.getDashboardStats;
  } catch (error) {
    // Re-throw with context
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }
};

