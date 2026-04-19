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
    queries: ['bmi-trends', 'blood-pressure-trends', 'vital-signs-box-plot'],
  },
  appointments: {
    label: 'Appointments',
    queries: ['appointments-by-category', 'appointments-by-status', 'appointments-by-session', 'appointments-accommodated-trends'],
  },
  clinical: {
    label: 'Clinical Data',
    queries: ['immunization-coverage', 'dental-procedures', 'oral-findings-percentages'],
  },
  lifestyle: {
    label: 'Lifestyle & Allergies',
    queries: ['lifestyle-risks', 'lifestyle-statistics', 'allergy-by-type', 'allergy-by-severity'],
  },
  emr: {
    label: 'EMR',
    queries: ['female-reproductive-health', 'oral-findings-percentages', 'vital-signs-box-plot', 'lifestyle-statistics'],
  },
  general: {
    label: 'General',
    queries: ['patient-credential-status', 'patient-population-by-branch'],
  },
  inventory: {
    label: 'Inventory',
    queries: ['most-consumed-medicine', 'most-consumed-supply', 'inventory-consumption-trends', 'inventory-report-summary'],
  },
  demographics: {
    label: 'Demographics',
    queries: [
      'patients-by-sex', 'consultations-by-sex', 'top-diagnoses-by-sex',
      'patients-by-age-group', 'consultations-by-age-group', 'bmi-by-age-group', 'diagnoses-by-age-group',
      'consultations-by-department', 'consultations-by-program', 'lifestyle-risks-by-department',
      'sex-age-group-matrix', 'diagnoses-sex-age',
    ],
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
  'appointments-accommodated-trends': 'stacked-area',
  // EMR / General / Inventory
  'female-reproductive-health': 'doughnut',
  'lifestyle-statistics': 'grouped-bar',
  'oral-findings-percentages': 'bar',
  'vital-signs-box-plot': 'box-plot',
  'patient-credential-status': 'pie',
  'patient-population-by-branch': 'pie',
  'most-consumed-medicine': 'bar',
  'most-consumed-supply': 'bar',
  'inventory-consumption-trends': 'stacked-area',
  'inventory-report-summary': 'stacked-area',
  // Demographics
  'patients-by-sex': 'pie',
  'consultations-by-sex': 'pie',
  'top-diagnoses-by-sex': 'grouped-bar',
  'patients-by-age-group': 'pie',
  'consultations-by-age-group': 'pie',
  'bmi-by-age-group': 'box-plot',
  'diagnoses-by-age-group': 'heatmap',
  'consultations-by-department': 'bar',
  'consultations-by-program': 'bar',
  'lifestyle-risks-by-department': 'grouped-bar',
  'sex-age-group-matrix': 'heatmap',
  'diagnoses-sex-age': 'heatmap',
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

export const SEX_FILTER_OPTIONS = ['Male', 'Female'];

// Canonical program list required in department/program analytics filter.
export const ACADEMIC_PROGRAM_FILTER_OPTIONS = [
  'BS Architecture',
  'BS Chemical Engineering',
  'BS Civil Engineering',
  'BS Computer Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Industrial Engineering',
  'BS Mechanical Engineering',
  'BS Environmental and Sanitary Engineering',
  'BS Computer Science',
  'BS Data Science and Analytics',
  'BS Entertainment and Multimedia Computing',
  'BS Information Technology',
  'BS Information Systems',
  'BS Accountancy',
  'BS Accounting Information Systems',
  'BSBA Financial Management',
  'BSBA Human Resource Management',
  'BSBA Logistics and Supply Chain Management',
  'BSBA Marketing Management',
  'Bachelor of Arts in English Language',
  'Bachelor of Arts in Political Science',
  'Bachelor of Secondary Education Major in English',
  'Bachelor of Secondary Education Major in Mathematics',
  'Bachelor of Secondary Education Major in Sciences',
  'Bachelor of Special Needs Education',
  'Teaching Certificate Program',
];

function normalizeSexOption(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm') return 'Male';
  if (normalized === 'female' || normalized === 'f') return 'Female';
  return '';
}

// ── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch available query types from backend
 */
export async function fetchAvailableQueries() {
  const response = await axiosRequest.get('/analytics/queries');
  return response.data.queries;
}

/**
 * Fetch distinct departments and sex values for demographic filter dropdowns
 */
export async function fetchFilterOptions() {
  try {
    const response = await axiosRequest.get('/analytics/filter-options');
    const backendDepartmentOptions = Array.isArray(response.data.departments) ? response.data.departments : [];
    const mergedDepartmentOptions = Array.from(
      new Set(
        [...backendDepartmentOptions, ...ACADEMIC_PROGRAM_FILTER_OPTIONS]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const backendSexOptions = Array.isArray(response.data.sexes) ? response.data.sexes : [];
    const mergedSexOptions = Array.from(
      new Set(
        [...backendSexOptions, ...SEX_FILTER_OPTIONS]
          .map(normalizeSexOption)
          .filter(Boolean)
      )
    );
    const orderedSexOptions = SEX_FILTER_OPTIONS.filter((sex) => mergedSexOptions.includes(sex));

    return {
      departments: mergedDepartmentOptions,
      sexes: orderedSexOptions.length > 0 ? orderedSexOptions : [...SEX_FILTER_OPTIONS],
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    // Keep required program options available even if backend filter API fails.
    return {
      departments: [...ACADEMIC_PROGRAM_FILTER_OPTIONS],
      sexes: [...SEX_FILTER_OPTIONS],
    };
  }
}

/**
 * Fetch analytics data for a specific query type
 * @param {string} dataType - Query type key (e.g. 'consultations-by-type')
 * @param {string} branch - 'Manila' | 'QuezonCity' | 'Both'
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @param {string} [groupBy] - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @param {object} [filters] - Optional { department, sex } filters
 * @returns {Promise<{labels: string[], values: number[], total: number}>}
 */
export async function fetchQueryData(dataType, branch, startDate, endDate, groupBy, filters = {}) {
  const params = { branch, startDate, endDate, groupBy };
  if (filters.department) params.department = filters.department;
  if (filters.sex) params.sex = filters.sex;

  const response = await axiosRequest.get(`/analytics/query/${encodeURIComponent(dataType)}`, { params });
  return response.data;
}

/**
 * Fetch multiple queries in a single batch request (reduces HTTP overhead)
 * @param {string[]} dataTypes - Array of query type keys
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [groupBy] - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @param {object} [filters] - Optional { department, sex } filters
 * @returns {Promise<Map<string, object>>} Map of dataType -> response data
 */
export async function fetchMultipleQueries(dataTypes, branch, startDate, endDate, groupBy, filters = {}) {
  const results = new Map();

  try {
    const body = {
      dataTypes,
      branch,
      startDate,
      endDate,
      groupBy,
    };
    if (filters.department) body.department = filters.department;
    if (filters.sex) body.sex = filters.sex;

    const response = await axiosRequest.post('/analytics/batch', body);

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
        const data = await fetchQueryData(dataType, branch, startDate, endDate, groupBy, filters);
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
  'full-report':    { label: 'Full Analytics Report',       description: 'All analytics metrics combined' },
  'consultations':  { label: 'Consultations Report',        description: 'Consultation metrics: service type, mode of delivery, and trends' },
  'diagnoses':      { label: 'Diagnoses Report',            description: 'Diagnosis metrics: top ICD-10, type distribution' },
  'vitals':         { label: 'Vital Signs Report',          description: 'BMI, blood pressure, and distribution analysis' },
  'appointments':   { label: 'Appointments Report',         description: 'Appointment category, status, and accommodated trends' },
  'clinical':       { label: 'Clinical Data Report',        description: 'Immunization, dental procedures, and oral findings prevalence' },
  'lifestyle':      { label: 'Lifestyle & Allergies Report', description: 'Lifestyle risk factors, statistics, and allergy data' },
  'emr':            { label: 'EMR Report',                  description: 'Reproductive health, oral findings, and vital-sign analytics' },
  'general':        { label: 'General Population Report',   description: 'Credential status and branch population comparison' },
  'inventory':      { label: 'Inventory Report',            description: 'Most consumed items, trends, and stock summary' },
  'demographics':   { label: 'Demographics Report',         description: 'Sex, age group, department, and program analytics' },
};

/**
 * Download analytics data as CSV / Excel / PDF.
 * The response is a Blob (binary file) that gets saved by the browser.
 *
 * @param {'csv'|'excel'|'pdf'} format
 * @param {Object} opts - { branch, startDate, endDate, dataTypes?, preset?, groupBy?, department?, sex? }
 */
export async function exportAnalytics(format, opts) {
  const { branch, startDate, endDate, dataTypes, preset, groupBy, department, sex, ageGroup } = opts;
  const body = {
    format,
    branch,
    startDate,
    endDate,
    dataTypes,
    preset,
    groupBy
  };
  const filters = {};
  if (department) {
    body.department = department;
    filters.department = department;
  }
  if (sex) {
    body.sex = sex;
    filters.sex = sex;
  }
  if (ageGroup) {
    body.ageGroup = ageGroup;
    filters.ageGroup = ageGroup;
  }
  if (Object.keys(filters).length > 0) {
    body.filters = filters;
  }

  const response = await axiosRequest.post('/analytics/export', body, { responseType: 'blob' });
  triggerDownload(response);
}

/**
 * Download a focused single-metric PDF report.
 * @param {string} dataType
 * @param {Object} opts - { branch, startDate, endDate, groupBy?, department?, sex? }
 */
export async function exportSingleMetric(dataType, opts) {
  const { branch, startDate, endDate, groupBy, department, sex, ageGroup } = opts;
  const body = {
    dataType,
    branch,
    startDate,
    endDate,
    groupBy,
  };
  const filters = {};
  if (department) {
    body.department = department;
    filters.department = department;
  }
  if (sex) {
    body.sex = sex;
    filters.sex = sex;
  }
  if (ageGroup) {
    body.ageGroup = ageGroup;
    filters.ageGroup = ageGroup;
  }
  if (Object.keys(filters).length > 0) {
    body.filters = filters;
  }

  const response = await axiosRequest.post('/analytics/export/single', body, { responseType: 'blob' });
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
