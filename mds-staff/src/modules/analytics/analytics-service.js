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
    queries: ['consultations-by-type', 'consultations-by-mode', 'consultation-trends'],
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
  'consultations-by-mode': 'doughnut',
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

// ── Period Preset Options ────────────────────────────────────────────────────

export const PERIOD_PRESETS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Calculate start/end dates based on a period preset
 */
export function getDateRangeForPeriod(period) {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  let start = new Date(now);

  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 7); // last 7 days
      break;
    case 'weekly':
      start.setDate(start.getDate() - 28); // last 4 weeks
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 6); // last 6 months
      break;
    case 'quarterly':
      start.setFullYear(start.getFullYear() - 1); // last year
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 5); // last 5 years
      break;
    default:
      start.setMonth(start.getMonth() - 6);
      break;
  }

  return { startDate: start.toISOString().slice(0, 10), endDate };
}

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
 * @param {string} [groupBy] - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @returns {Promise<{labels: string[], values: number[], total: number}>}
 */
export async function fetchQueryData(dataType, branch, startDate, endDate, groupBy) {
  const response = await axiosRequest.get(`/analytics/query/${encodeURIComponent(dataType)}`, {
    params: { branch, startDate, endDate, groupBy },
  });
  return response.data;
}

/**
 * Fetch multiple queries in a single batch request (reduces HTTP overhead)
 * @param {string[]} dataTypes - Array of query type keys
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [groupBy] - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @returns {Promise<Map<string, object>>} Map of dataType -> response data
 */
export async function fetchMultipleQueries(dataTypes, branch, startDate, endDate, groupBy) {
  const results = new Map();

  try {
    const response = await axiosRequest.post('/analytics/batch', {
      dataTypes,
      branch,
      startDate,
      endDate,
      groupBy,
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
        const data = await fetchQueryData(dataType, branch, startDate, endDate, groupBy);
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

// ── Export Functions ──────────────────────────────────────────────────────────

/** Export presets mirror – used to populate presets in the UI without an API call */
export const EXPORT_PRESETS = {
  'full-report':    { label: 'Full Analytics Report',       description: 'All 15 analytics metrics combined' },
  'consultations':  { label: 'Consultations Report',        description: 'Consultation metrics: type, status, trends' },
  'diagnoses':      { label: 'Diagnoses Report',            description: 'Diagnosis metrics: top ICD-10, type distribution' },
  'vitals':         { label: 'Vital Signs Report',          description: 'BMI and blood pressure trend analysis' },
  'appointments':   { label: 'Appointments Report',         description: 'Appointment category, status, and session data' },
  'clinical':       { label: 'Clinical Data Report',        description: 'Immunization coverage and dental procedures' },
  'lifestyle':      { label: 'Lifestyle & Allergies Report', description: 'Lifestyle risk factors and allergy data' },
};

/**
 * Download analytics data as CSV / Excel / PDF.
 * The response is a Blob (binary file) that gets saved by the browser.
 *
 * @param {'csv'|'excel'|'pdf'} format
 * @param {Object} opts - { branch, startDate, endDate, dataTypes?, preset?, groupBy? }
 */
export async function exportAnalytics(format, opts) {
  const { branch, startDate, endDate, dataTypes, preset, groupBy } = opts;
  const response = await axiosRequest.post(
    '/analytics/export',
    { format, branch, startDate, endDate, dataTypes, preset, groupBy },
    { responseType: 'blob' },
  );

  triggerDownload(response);
}

/**
 * Download a focused single-metric PDF report.
 * @param {string} dataType
 * @param {Object} opts - { branch, startDate, endDate, groupBy? }
 */
export async function exportSingleMetric(dataType, opts) {
  const { branch, startDate, endDate, groupBy } = opts;
  const response = await axiosRequest.post(
    '/analytics/export/single',
    { dataType, branch, startDate, endDate, groupBy },
    { responseType: 'blob' },
  );

  triggerDownload(response);
}

/**
 * Trigger browser file download from an Axios blob response.
 * Extracts filename from Content-Disposition header or falls back.
 */
function triggerDownload(response) {
  const disposition = response.headers?.['content-disposition'] || '';
  let filename = 'analytics_export';

  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  if (match) filename = match[1];

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
