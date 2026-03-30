/**
 * Analytics Service
 * Handles all REST API calls for the analytics module.
 * Endpoint: GET /analytics/* (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── Query Category Mapping ───────────────────────────────────────────────────

export const QUERY_CATEGORIES = {
  consultations: {
    label: 'Consultations',
    queries: ['consultations-by-type', 'consultations-by-status', 'consultation-trends'],
  },
  diagnoses: {
    label: 'Diagnoses',
    queries: ['top-diagnoses', 'diagnoses-by-type'],
  },
  vitals: {
    label: 'Vital Signs',
    queries: ['bmi-trends', 'blood-pressure-trends'],
  },
  appointments: {
    label: 'Appointments',
    queries: ['appointments-by-category', 'appointments-by-status', 'appointments-by-session'],
  },
  clinical: {
    label: 'Clinical Data',
    queries: ['immunization-coverage', 'dental-procedures'],
  },
  lifestyle: {
    label: 'Lifestyle & Allergies',
    queries: ['lifestyle-risks', 'allergy-by-type', 'allergy-by-severity'],
  },
};

// ── Chart Type Recommendations ───────────────────────────────────────────────

export const CHART_TYPE_MAP = {
  'consultations-by-type': 'pie',
  'consultations-by-status': 'doughnut',
  'consultation-trends': 'line',
  'top-diagnoses': 'bar',
  'diagnoses-by-type': 'pie',
  'bmi-trends': 'line',
  'blood-pressure-trends': 'line',
  'immunization-coverage': 'bar',
  'dental-procedures': 'bar',
  'lifestyle-risks': 'bar',
  'allergy-by-type': 'pie',
  'allergy-by-severity': 'doughnut',
  'appointments-by-category': 'pie',
  'appointments-by-status': 'doughnut',
  'appointments-by-session': 'pie',
};

// ── Branch Options ───────────────────────────────────────────────────────────

export const BRANCHES = [
  { value: 'Both', label: 'All Branches' },
  { value: 'Manila', label: 'Manila' },
  { value: 'QuezonCity', label: 'Quezon City' },
];

// ── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch available query types from backend
 */
export async function fetchAvailableQueries() {
  const response = await axiosRequest.get('/analytics/queries');
  return response.data.queries;
}

/**
 * Fetch analytics data for a specific query type
 * @param {string} dataType - Query type key (e.g. 'consultations-by-type')
 * @param {string} branch - 'Manila' | 'QuezonCity' | 'Both'
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<{labels: string[], values: number[], total: number}>}
 */
export async function fetchQueryData(dataType, branch, startDate, endDate) {
  const response = await axiosRequest.get(`/analytics/query/${encodeURIComponent(dataType)}`, {
    params: { branch, startDate, endDate },
  });
  return response.data;
}

/**
 * Fetch multiple queries in a single batch request (reduces HTTP overhead)
 * @param {string[]} dataTypes - Array of query type keys
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<Map<string, object>>} Map of dataType -> response data
 */
export async function fetchMultipleQueries(dataTypes, branch, startDate, endDate) {
  const results = new Map();

  try {
    const response = await axiosRequest.post('/analytics/batch', {
      dataTypes,
      branch,
      startDate,
      endDate,
    });

    if (response.data.success && response.data.results) {
      for (const [dataType, result] of Object.entries(response.data.results)) {
        if (result.success) {
          results.set(dataType, {
            success: true,
            dataType,
            branch: response.data.branch,
            dateRange: response.data.dateRange,
            data: result.data,
          });
        } else {
          results.set(dataType, { success: false, error: true, dataType });
        }
      }
    }
  } catch {
    // Fallback: if batch endpoint fails, fetch individually
    const promises = dataTypes.map(async (dataType) => {
      try {
        const data = await fetchQueryData(dataType, branch, startDate, endDate);
        // Guard: if the backend returned HTML instead of JSON (e.g. not yet deployed),
        // treat it as an error so charts show an empty/error state instead of crashing.
        if (typeof data !== 'object' || data === null) {
          results.set(dataType, { success: false, error: true, dataType });
          return;
        }
        results.set(dataType, data);
      } catch {
        results.set(dataType, { success: false, error: true, dataType });
      }
    });
    await Promise.all(promises);
  }

  return results;
}
