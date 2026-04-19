const ExcelJS = require('exceljs');
const logger = require('../utils/logger.js');
const analytics = require('./analytics-query.js');
const chart = require('./chart.js');
const pdf = require('./pdfkit.js');
const docGen = require('./doc-generate-module/index.js');

// ============================================================
// EXPORT CONFIGURATION
// ============================================================

/**
 * Maps dataType → display metadata used across all export formats.
 * Adding a new query here automatically enables it for CSV/Excel/PDF export.
 */
const EXPORT_META = {
  'consultations-by-type':    { label: 'Consultations by Service Type (Medical vs Dental)', xAxis: 'Service Type', yAxis: 'Count', chartType: 'pie' },
  'consultations-by-mode':    { label: 'Consultations by Mode of Delivery (Onsite vs Virtual)', xAxis: 'Mode of Delivery', yAxis: 'Count', chartType: 'doughnut' },
  'consultation-trends':      { label: 'Consultation Trends Over Time', xAxis: 'Period', yAxis: 'Count', chartType: 'line' },
  'top-diagnoses':            { label: 'Most Frequent Diagnoses Recorded', xAxis: 'Diagnosis', yAxis: 'Count', chartType: 'bar' },
  'diagnoses-by-type':        { label: 'Diagnoses by Type',           xAxis: 'Type',          yAxis: 'Count',   chartType: 'pie' },
  'bmi-trends':               { label: 'BMI Trends',                  xAxis: 'Period',        yAxis: 'Avg BMI', chartType: 'line' },
  'blood-pressure-trends':    { label: 'Blood Pressure Trends',       xAxis: 'Period',        yAxis: 'Avg BP',  chartType: 'line' },
  'immunization-coverage':    { label: 'Immunization Coverage',       xAxis: 'Vaccine',       yAxis: 'Patients',chartType: 'bar' },
  'dental-procedures':        { label: 'Top Dental Procedures',       xAxis: 'Procedure',     yAxis: 'Count',   chartType: 'bar' },
  'lifestyle-risks':          { label: 'Lifestyle Risk Factors',      xAxis: 'Risk Factor',   yAxis: 'Count',   chartType: 'bar' },
  'allergy-by-type':          { label: 'Allergies by Type',           xAxis: 'Type',          yAxis: 'Count',   chartType: 'pie' },
  'allergy-by-severity':      { label: 'Allergies by Severity',       xAxis: 'Severity',      yAxis: 'Count',   chartType: 'doughnut' },
  'appointments-by-category': { label: 'Appointments by Category',    xAxis: 'Category',      yAxis: 'Count',   chartType: 'pie' },
  'appointments-by-status':   { label: 'Appointments by Status',      xAxis: 'Status',        yAxis: 'Count',   chartType: 'doughnut' },
  'appointments-by-session':  { label: 'Appointments by Session',     xAxis: 'Session',       yAxis: 'Count',   chartType: 'pie' },
  'appointments-accommodated-trends': { label: 'Appointments Accommodated Trends', xAxis: 'Period', yAxis: 'Count', chartType: 'line', hasSeries: true },

  // EMR / General / Inventory
  'female-reproductive-health': { label: 'Female Reproductive Health', xAxis: 'Metric', yAxis: 'Count', chartType: 'doughnut' },
  'lifestyle-statistics':       { label: 'Lifestyle Statistics',       xAxis: 'Metric', yAxis: 'Value', chartType: 'bar', hasSeries: true },
  'oral-findings-percentages':  { label: 'Oral Findings Prevalence',   xAxis: 'Oral Finding', yAxis: 'Prevalence (%)', chartType: 'bar' },
  'vital-signs-box-plot':       { label: 'Vital Signs Box Plot',       xAxis: 'Vital', yAxis: 'Median', chartType: 'bar' },
  'patient-credential-status':  { label: 'Patient Credential Status',  xAxis: 'Status', yAxis: 'Patients', chartType: 'pie' },
  'patient-population-by-branch': { label: 'Patient Population by Branch', xAxis: 'Branch', yAxis: 'Patients', chartType: 'bar' },
  'most-consumed-medicine':     { label: 'Most Consumed Medicine',     xAxis: 'Medicine', yAxis: 'Units', chartType: 'bar' },
  'most-consumed-supply':       { label: 'Most Consumed Supply',       xAxis: 'Supply', yAxis: 'Units', chartType: 'bar' },
  'inventory-consumption-trends': { label: 'Inventory Consumption Trends', xAxis: 'Period', yAxis: 'Units', chartType: 'line', hasSeries: true },
  'inventory-report-summary':   { label: 'Inventory Report Summary',   xAxis: 'Metric', yAxis: 'Value', chartType: 'bar' },

  // Demographics
  'patients-by-sex':              { label: 'Patients by Sex',                xAxis: 'Sex',             yAxis: 'Patients', chartType: 'bar' },
  'consultations-by-sex':         { label: 'Consultations by Sex',           xAxis: 'Sex',             yAxis: 'Count',    chartType: 'bar' },
  'top-diagnoses-by-sex':         { label: 'Top Diagnoses by Sex',           xAxis: 'Diagnosis',       yAxis: 'Count',    chartType: 'bar', hasSeries: true },
  'patients-by-age-group':        { label: 'Patients by Age Group',          xAxis: 'Age Group',       yAxis: 'Patients', chartType: 'bar' },
  'consultations-by-age-group':   { label: 'Consultations by Age Group',     xAxis: 'Age Group',       yAxis: 'Count',    chartType: 'bar' },
  'bmi-by-age-group':             { label: 'Average BMI by Age Group',       xAxis: 'Age Group',       yAxis: 'Avg BMI',  chartType: 'bar' },
  'diagnoses-by-age-group':       { label: 'Diagnoses by Age Group',         xAxis: 'Age Group',       yAxis: 'Count',    chartType: 'bar', hasSeries: true },
  'consultations-by-department':  { label: 'Consultations by Department',    xAxis: 'Department',      yAxis: 'Count',    chartType: 'bar' },
  'consultations-by-program':     { label: 'Consultations by Program',       xAxis: 'Program',         yAxis: 'Count',    chartType: 'bar' },
  'lifestyle-risks-by-department':{ label: 'Lifestyle Risks by Department',  xAxis: 'Department',      yAxis: 'Count',    chartType: 'bar', hasSeries: true },
  'sex-age-group-matrix':         { label: 'Sex × Age Group Matrix',         xAxis: 'Age Group',       yAxis: 'Count',    chartType: 'bar', hasSeries: true },
  'diagnoses-sex-age':            { label: 'Diagnoses by Sex & Age',         xAxis: 'Diagnosis',       yAxis: 'Count',    chartType: 'bar', hasSeries: true },
};

/**
 * Predefined export presets for quick export options
 */
const EXPORT_PRESETS = {
  'full-report': {
    label: 'Full Analytics Report',
    description: 'All analytics metrics combined',
    dataTypes: Object.keys(EXPORT_META),
  },
  'consultations': {
    label: 'Consultations Report',
    description: 'Consultation metrics: service type, mode of delivery, and trends',
    dataTypes: ['consultations-by-type', 'consultations-by-mode', 'consultation-trends'],
  },
  'diagnoses': {
    label: 'Diagnoses Report',
    description: 'Diagnosis metrics: top ICD-10, type distribution',
    dataTypes: ['top-diagnoses', 'diagnoses-by-type'],
  },
  'vitals': {
    label: 'Vital Signs Report',
    description: 'BMI, blood pressure, and vital-sign distribution analysis',
    dataTypes: ['bmi-trends', 'blood-pressure-trends', 'vital-signs-box-plot'],
  },
  'appointments': {
    label: 'Appointments Report',
    description: 'Appointment category, status, session, and accommodated trend data',
    dataTypes: ['appointments-by-category', 'appointments-by-status', 'appointments-by-session', 'appointments-accommodated-trends'],
  },
  'clinical': {
    label: 'Clinical Data Report',
    description: 'Immunization coverage, dental procedures, and oral findings prevalence',
    dataTypes: ['immunization-coverage', 'dental-procedures', 'oral-findings-percentages'],
  },
  'lifestyle': {
    label: 'Lifestyle & Allergies Report',
    description: 'Lifestyle prevalence, statistics, and allergy data',
    dataTypes: ['lifestyle-risks', 'lifestyle-statistics', 'allergy-by-type', 'allergy-by-severity'],
  },
  'emr': {
    label: 'EMR Report',
    description: 'Female reproductive, oral findings, lifestyle statistics, and vital-sign distribution analytics',
    dataTypes: ['female-reproductive-health', 'lifestyle-statistics', 'oral-findings-percentages', 'vital-signs-box-plot'],
  },
  'general': {
    label: 'General Population Report',
    description: 'Credential status and branch population comparison',
    dataTypes: ['patient-credential-status', 'patient-population-by-branch'],
  },
  'inventory': {
    label: 'Inventory Report',
    description: 'Consumption trends, top consumed items, and stock summary',
    dataTypes: ['most-consumed-medicine', 'most-consumed-supply', 'inventory-consumption-trends', 'inventory-report-summary'],
  },
  'demographics': {
    label: 'Demographics Report',
    description: 'Sex, age group, department, and program distribution analytics',
    dataTypes: [
      'patients-by-sex', 'consultations-by-sex', 'top-diagnoses-by-sex',
      'patients-by-age-group', 'consultations-by-age-group', 'bmi-by-age-group', 'diagnoses-by-age-group',
      'consultations-by-department', 'consultations-by-program', 'lifestyle-risks-by-department',
      'sex-age-group-matrix', 'diagnoses-sex-age',
    ],
  },
};

const EXPORT_CATEGORIES = [
  {
    name: 'Consultations',
    metrics: [
      'consultations-by-type',
      'consultations-by-mode',
      'consultation-trends',
      'consultations-by-sex',
      'consultations-by-department',
      'consultations-by-program',
      'consultations-by-age-group',
    ],
  },
  {
    name: 'Diagnoses',
    metrics: [
      'top-diagnoses',
      'diagnoses-by-type',
      'top-diagnoses-by-sex',
      'diagnoses-by-age-group',
      'diagnoses-sex-age',
    ],
  },
  {
    name: 'Patients',
    metrics: [
      'patients-by-sex',
      'patients-by-age-group',
      'patient-population-by-branch',
      'patient-credential-status',
      'sex-age-group-matrix',
    ],
  },
  {
    name: 'Appointments',
    metrics: [
      'appointments-by-status',
      'appointments-by-category',
      'appointments-by-session',
      'appointments-accommodated-trends',
    ],
  },
  {
    name: 'Vitals & BMI',
    metrics: [
      'vital-signs-box-plot',
      'bmi-trends',
      'bmi-by-age-group',
      'blood-pressure-trends',
    ],
  },
  {
    name: 'Lifestyle & Risks',
    metrics: [
      'lifestyle-risks',
      'lifestyle-statistics',
      'lifestyle-risks-by-department',
    ],
  },
  {
    name: 'Inventory',
    metrics: [
      'inventory-report-summary',
      'most-consumed-medicine',
      'most-consumed-supply',
      'inventory-consumption-trends',
    ],
  },
  {
    name: 'Clinical Others',
    metrics: [
      'immunization-coverage',
      'dental-procedures',
      'oral-findings-percentages',
      'allergy-by-type',
      'allergy-by-severity',
      'female-reproductive-health',
    ],
  },
];

const METRIC_CATEGORY_MAP = Object.freeze(
  EXPORT_CATEGORIES.reduce((acc, category) => {
    for (const metricKey of category.metrics) {
      acc[metricKey] = category.name;
    }
    return acc;
  }, {})
);

const CATEGORY_ORDER = Object.freeze(
  EXPORT_CATEGORIES.reduce((acc, category, index) => {
    acc[category.name] = index;
    return acc;
  }, {})
);

// ============================================================
// SHARED HELPERS
// ============================================================

/**
 * Fetch analytics results for requested data types
 * @param {string[]} dataTypes
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} [options] - Extra options (e.g. { groupBy: 'weekly' })
 * @returns {Promise<Object>} Map of dataType → { labels, values, total }
 */
async function fetchExportData(dataTypes, branch, startDate, endDate, options = {}) {
  const results = await analytics.executeBatchQueries(dataTypes, branch, startDate, endDate, options);
  const filtered = {};

  for (const [key, result] of Object.entries(results)) {
    if (result.success && result.data) {
      filtered[key] = result.data;
    }
  }

  return filtered;
}

/**
 * Generate a safe filename string
 */
function buildFilename(prefix, branch, startDate, endDate, ext) {
  const branchSlug = (branch || 'all').replace(/\s+/g, '_').toLowerCase();
  const dateSlug = `${startDate}_to_${endDate}`;
  return `${prefix}_${branchSlug}_${dateSlug}.${ext}`;
}

/**
 * Resolve data types from either preset name or explicit list
 */
function resolveDataTypes(dataTypes, preset) {
  if (preset && EXPORT_PRESETS[preset]) {
    return EXPORT_PRESETS[preset].dataTypes;
  }
  if (Array.isArray(dataTypes) && dataTypes.length > 0) {
    return dataTypes.filter(dt => EXPORT_META[dt]);
  }
  return Object.keys(EXPORT_META);
}

/**
 * Build the display label for a branch
 */
function branchLabel(branch) {
  if (branch === 'Both') return 'All Branches';
  if (branch === 'QuezonCity') return 'Quezon City';
  return branch;
}

function formatFilterValue(value, fallback = 'All') {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}

function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumSeriesValues(values = []) {
  return values.reduce((sum, value) => sum + normalizeNumeric(value), 0);
}

function metricTrendType(dataType) {
  return [
    'consultation-trends',
    'bmi-trends',
    'blood-pressure-trends',
    'inventory-consumption-trends',
    'appointments-accommodated-trends',
  ].includes(dataType);
}

function percentOfTotal(value, total) {
  const parsedTotal = normalizeNumeric(total);
  if (parsedTotal <= 0) return '';
  return Number(((normalizeNumeric(value) / parsedTotal) * 100).toFixed(2));
}

/**
 * Flatten analytics result maps into row-based records so CSV and Excel can
 * include the same chart-level details users see in the UI.
 */
function buildDetailedRows(data, meta = {}) {
  const rows = [];
  const branch = branchLabel(meta.branch);
  const startDate = meta.startDate || '';
  const endDate = meta.endDate || '';
  const groupBy = formatFilterValue(meta.groupBy, 'Default');
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');
  const ageGroupFilter = formatFilterValue(meta.ageGroup, 'All');

  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType] || {};
    const labels = Array.isArray(result?.labels) ? result.labels : [];
    const values = Array.isArray(result?.values) ? result.values : [];
    const series = Array.isArray(result?.series) ? result.series : [];
    const boxPlot = Array.isArray(result?.boxPlot) ? result.boxPlot : [];
    const rawCounts = Array.isArray(result?.rawCounts) ? result.rawCounts : [];
    const diastolicValues = Array.isArray(result?.diastolicValues) ? result.diastolicValues : [];
    const metricTotal = normalizeNumeric(result?.total);
    const chartContext = result?.chartContext || {};
    const chartTitle = chartContext.title || exportMeta.label || dataType;
    const datasetContext = chartContext.datasetContext || chartContext.key || dataType;
    const filterParameters = `branch=${branch};startDate=${startDate};endDate=${endDate};groupBy=${groupBy};department=${departmentFilter};sex=${sexFilter};ageGroup=${ageGroupFilter}`;
    const chartType = exportMeta.chartType || '';
    const chartVariant = result?.chartVariant || chartType || 'bar';
    const isTrend = metricTrendType(dataType);
    const isBP = dataType === 'blood-pressure-trends';
    const isBoxPlot = dataType === 'vital-signs-box-plot';
    const showPercentage = shouldShowPercentageColumn(result, { isTrend, isBP, isBoxPlot });

    const baseRow = {
      metricKey: dataType,
      metric: exportMeta.label || dataType,
      chartType,
      chartVariant,
      xAxis: exportMeta.xAxis || 'Label',
      yAxis: exportMeta.yAxis || 'Value',
      metricTotal,
      itemCount: labels.length,
      chartTitle,
      datasetContext,
      filterParameters,
      branch,
      startDate,
      endDate,
      groupBy,
      departmentFilter,
      sexFilter,
      ageGroupFilter,
    };

    if (boxPlot.length > 0) {
      for (const item of boxPlot) {
        rows.push({
          ...baseRow,
          rowType: 'box-plot',
          label: item.name || '',
          series: '',
          value: normalizeNumeric(item.median),
          rawCount: '',
          diastolicValue: '',
          min: normalizeNumeric(item.min),
          q1: normalizeNumeric(item.q1),
          median: normalizeNumeric(item.median),
          q3: normalizeNumeric(item.q3),
          max: normalizeNumeric(item.max),
          sampleCount: normalizeNumeric(item.count),
          percentOfTotal: '',
        });
      }
      continue;
    }

    if (series.length > 0) {
      const longestSeriesLength = Math.max(
        labels.length,
        ...series.map((entry) => (Array.isArray(entry.values) ? entry.values.length : 0)),
        0
      );

      for (let i = 0; i < longestSeriesLength; i++) {
        const label = labels[i] || `Item ${i + 1}`;
        for (const entry of series) {
          const entryValues = Array.isArray(entry.values) ? entry.values : [];
          const value = normalizeNumeric(entryValues[i]);
          rows.push({
            ...baseRow,
            rowType: chartVariant === 'heatmap' ? 'matrix-value' : 'series-value',
            label,
            series: entry.name || 'Series',
            value,
            rawCount: '',
            diastolicValue: '',
            min: '',
            q1: '',
            median: '',
            q3: '',
            max: '',
            sampleCount: '',
            percentOfTotal: showPercentage ? percentOfTotal(value, metricTotal) : '',
          });
        }
      }
      continue;
    }

    const rowCount = Math.max(labels.length, values.length, rawCounts.length, diastolicValues.length);
    if (rowCount === 0) {
      rows.push({
        ...baseRow,
        rowType: 'no-data',
        label: '',
        series: '',
        value: '',
        rawCount: '',
        diastolicValue: '',
        min: '',
        q1: '',
        median: '',
        q3: '',
        max: '',
        sampleCount: '',
        percentOfTotal: '',
      });
      continue;
    }

    for (let i = 0; i < rowCount; i++) {
      const label = labels[i] || `Item ${i + 1}`;
      const value = normalizeNumeric(values[i]);
      rows.push({
        ...baseRow,
        rowType: isBP ? 'blood-pressure' : (rawCounts.length > 0 ? 'percentage-with-count' : 'value'),
        label,
        series: '',
        value,
        rawCount: rawCounts.length > 0 ? normalizeNumeric(rawCounts[i]) : '',
        diastolicValue: diastolicValues.length > 0 ? normalizeNumeric(diastolicValues[i]) : '',
        min: '',
        q1: '',
        median: '',
        q3: '',
        max: '',
        sampleCount: '',
        percentOfTotal: showPercentage ? percentOfTotal(value, metricTotal) : '',
      });
    }
  }

  return rows;
}

/**
 * Percent-of-total is only meaningful for count-like distributions.
 * Avoid rendering % for derived metrics (e.g. medians, averages, precomputed percentages).
 */
function shouldShowPercentageColumn(result, { isTrend = false, isBP = false, isBoxPlot = false } = {}) {
  if (isTrend || isBP || isBoxPlot) return false;
  if (String(result?.unit || '').toLowerCase() === 'percentage') return false;

  const values = Array.isArray(result?.values)
    ? result.values.map((value) => Number(value))
    : [];
  if (values.length === 0) return false;

  if (values.some((value) => !Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
    return false;
  }

  const total = Number(result?.total);
  if (!Number.isFinite(total) || total <= 0) return false;
  if (values.some((value) => value > total)) return false;

  return true;
}

function normalizeNumericOrBlank(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' && value.trim() === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

function isBlankValue(value) {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim() === '');
}

function isGhostDateRangeLabel(label) {
  return /^\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}$/i.test(String(label || '').trim());
}

function categoryForMetric(metricKey) {
  return METRIC_CATEGORY_MAP[metricKey] || 'Clinical Others';
}

function excelColumnName(index) {
  let value = Math.max(1, Number(index) || 1);
  let columnName = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    value = Math.floor((value - 1) / 26);
  }
  return columnName;
}

function autoFitWorksheetColumns(sheet, { minWidth = 12, maxWidth = 45 } = {}) {
  sheet.columns.forEach((column) => {
    let widest = minWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      let text = '';

      if (value && typeof value === 'object' && value.richText) {
        text = value.richText.map((item) => item.text || '').join('');
      } else {
        text = value === undefined || value === null ? '' : String(value);
      }

      widest = Math.max(widest, text.length + 2);
    });

    column.width = Math.min(maxWidth, Math.max(minWidth, widest));
  });
}

function buildResearchRows(data) {
  const rows = [];

  for (const [metricKey, result] of Object.entries(data || {})) {
    const exportMeta = EXPORT_META[metricKey] || {};
    const metric = exportMeta.label || metricKey;
    const chartContext = result?.chartContext || {};
    const chartTitle = chartContext.title || metric;
    const datasetContext = chartContext.datasetContext || chartContext.key || metricKey;
    const labels = Array.isArray(result?.labels) ? result.labels : [];
    const values = Array.isArray(result?.values) ? result.values : [];
    const series = Array.isArray(result?.series) ? result.series : [];
    const boxPlot = Array.isArray(result?.boxPlot) ? result.boxPlot : [];
    const isTrend = metricTrendType(metricKey);
    const isBP = metricKey === 'blood-pressure-trends';
    const isBoxPlot = metricKey === 'vital-signs-box-plot';
    const showPercentage = shouldShowPercentageColumn(result, { isTrend, isBP, isBoxPlot });

    const pushRow = ({ label, value, percentOfTotal = '', min = '', q1 = '', median = '', q3 = '', max = '', sampleCount = '' }) => {
      if (isGhostDateRangeLabel(label)) return;
      if (isBlankValue(value)) return;

      rows.push({
        category: categoryForMetric(metricKey),
        metricKey,
        metric,
        chartTitle,
        datasetContext,
        label,
        value,
        percentOfTotal,
        min,
        q1,
        median,
        q3,
        max,
        sampleCount,
      });
    };

    if (boxPlot.length > 0) {
      for (const item of boxPlot) {
        const medianValue = normalizeNumericOrBlank(item?.median);
        pushRow({
          label: item?.name || '',
          value: medianValue,
          min: normalizeNumericOrBlank(item?.min),
          q1: normalizeNumericOrBlank(item?.q1),
          median: medianValue,
          q3: normalizeNumericOrBlank(item?.q3),
          max: normalizeNumericOrBlank(item?.max),
          sampleCount: normalizeNumericOrBlank(item?.count),
        });
      }
      continue;
    }

    if (series.length > 0) {
      const longestSeriesLength = Math.max(
        labels.length,
        ...series.map((entry) => (Array.isArray(entry.values) ? entry.values.length : 0)),
        0
      );

      for (let i = 0; i < longestSeriesLength; i++) {
        const label = labels[i] || `Item ${i + 1}`;
        for (const entry of series) {
          const value = normalizeNumericOrBlank(Array.isArray(entry.values) ? entry.values[i] : undefined);
          pushRow({
            label,
            value,
            percentOfTotal: showPercentage ? percentOfTotal(value, result?.total) : '',
          });
        }
      }
      continue;
    }

    const rowCount = Math.max(labels.length, values.length);
    for (let i = 0; i < rowCount; i++) {
      const label = labels[i] || `Item ${i + 1}`;
      const value = normalizeNumericOrBlank(values[i]);
      pushRow({
        label,
        value,
        percentOfTotal: showPercentage ? percentOfTotal(value, result?.total) : '',
      });
    }
  }

  rows.sort((left, right) => {
    const categoryDelta = (CATEGORY_ORDER[left.category] || 999) - (CATEGORY_ORDER[right.category] || 999);
    if (categoryDelta !== 0) return categoryDelta;

    if (left.metric !== right.metric) {
      return String(left.metric).localeCompare(String(right.metric));
    }

    return String(left.label).localeCompare(String(right.label));
  });

  return rows;
}

function buildSummaryRows(data, researchRows) {
  const itemCounts = researchRows.reduce((acc, row) => {
    acc[row.metricKey] = (acc[row.metricKey] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(data || {})
    .map(([metricKey, result]) => ({
      metricName: EXPORT_META[metricKey]?.label || metricKey,
      category: categoryForMetric(metricKey),
      totalValue: normalizeNumeric(result?.total),
      itemCount: itemCounts[metricKey] || 0,
    }))
    .sort((left, right) => {
      const categoryDelta = (CATEGORY_ORDER[left.category] || 999) - (CATEGORY_ORDER[right.category] || 999);
      if (categoryDelta !== 0) return categoryDelta;
      return String(left.metricName).localeCompare(String(right.metricName));
    });
}

// ============================================================
// CSV EXPORT
// ============================================================

/**
 * Generate cleaned CSV from analytics data.
 * The first 8 rows are metadata comments, followed by analysis-ready rows.
 *
 * @param {Object} data - Map of dataType → { labels, values, total }
 * @param {Object} meta - { branch, startDate, endDate }
 * @returns {string} CSV content
 */
function generateCSV(data, meta) {
  const lines = [];
  const researchRows = buildResearchRows(data);
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const branch = branchLabel(meta.branch);
  const dateRange = `${meta.startDate} to ${meta.endDate}`;
  const groupBy = formatFilterValue(meta.groupBy, 'Default');
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');
  const ageGroupFilter = formatFilterValue(meta.ageGroup, 'All');
  const filterParameters = `branch=${branch};startDate=${meta.startDate};endDate=${meta.endDate};groupBy=${groupBy};department=${departmentFilter};sex=${sexFilter};ageGroup=${ageGroupFilter}`;

  // 8 metadata lines (kept as comments for easy skipping in external tools).
  lines.push(`# MDSystem Analytics Clean Export`);
  lines.push(`# Branch: ${branch}`);
  lines.push(`# Date Range: ${dateRange}`);
  lines.push(`# Group By: ${groupBy}`);
  lines.push(`# Department Filter: ${departmentFilter}`);
  lines.push(`# Sex Filter: ${sexFilter}`);
  lines.push(`# Age Group Filter: ${ageGroupFilter}`);
  lines.push(`# Generated: ${generatedAt}`);
  lines.push('# Columns: Category,Metric,Chart Title,Dataset Context,Label,Value,% of Total,Min,Q1,Median,Q3,Max,Sample Count,Filter Parameters');

  // Clean research table.
  lines.push([
    'Category',
    'Metric',
    'Chart Title',
    'Dataset Context',
    'Label',
    'Value',
    '% of Total',
    'Min',
    'Q1',
    'Median',
    'Q3',
    'Max',
    'Sample Count',
    'Filter Parameters',
  ].map(csvEscape).join(','));

  for (const row of researchRows) {
    lines.push([
      row.category,
      row.metric,
      row.chartTitle,
      row.datasetContext,
      row.label,
      row.value,
      row.percentOfTotal,
      row.min,
      row.q1,
      row.median,
      row.q3,
      row.max,
      row.sampleCount,
      filterParameters,
    ].map(csvEscape).join(','));
  }

  return lines.join('\r\n');
}

function csvEscape(value) {
  const str = String(value || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================================
// EXCEL EXPORT
// ============================================================

/**
 * Generate Excel workbook with a Summary sheet and category-based worksheets.
 *
 * @param {Object} data - Map of dataType → { labels, values, total }
 * @param {Object} meta - { branch, startDate, endDate }
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateExcel(data, meta) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MDSystem Analytics';
  workbook.created = new Date();

  const researchRows = buildResearchRows(data);
  const summaryRows = buildSummaryRows(data, researchRows);

  const headerStyle = Object.freeze({
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    },
  });

  const baseBorder = Object.freeze({
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  });

  const applyHeaderRow = (row) => {
    row.eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });
  };

  const applyAlternatingDataStyle = (row, dataIndex) => {
    const fillColor = dataIndex % 2 === 0 ? 'FFF3F4F6' : 'FFFFFFFF';
    row.eachCell((cell) => {
      cell.border = baseBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.alignment = { vertical: 'middle' };
    });
  };

  const setSheetTitle = (sheet, title, columnCount) => {
    const safeColumns = Math.max(1, columnCount);
    const endColumn = excelColumnName(safeColumns);
    sheet.mergeCells(`A1:${endColumn}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  };

  // ── Summary Sheet (must be first) ───────────────────────
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF4CAF50' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  const summaryHeaders = ['Metric Name', 'Category', 'Total Count/Value', 'Number of Items'];
  setSheetTitle(summarySheet, 'Analytics Summary', summaryHeaders.length);
  const summaryHeaderRow = summarySheet.getRow(2);
  summaryHeaderRow.values = summaryHeaders;
  applyHeaderRow(summaryHeaderRow);

  let summaryRowIndex = 3;
  for (const row of summaryRows) {
    const excelRow = summarySheet.getRow(summaryRowIndex);
    excelRow.values = [row.metricName, row.category, row.totalValue, row.itemCount];
    applyAlternatingDataStyle(excelRow, summaryRowIndex - 3);
    summaryRowIndex++;
  }

  if (summaryRows.length === 0) {
    const emptySummaryRow = summarySheet.getRow(3);
    emptySummaryRow.values = ['No data available for selected filters', '', '', ''];
    applyAlternatingDataStyle(emptySummaryRow, 0);
  }

  summarySheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: summaryHeaders.length },
  };
  autoFitWorksheetColumns(summarySheet);

  // ── Category Sheets ──────────────────────────────────────
  for (const category of EXPORT_CATEGORIES) {
    const sheet = workbook.addWorksheet(category.name.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    const rows = researchRows.filter((row) => row.category === category.name);
    const includesPercent = rows.some((row) => !isBlankValue(row.percentOfTotal));
    const isVitalsSheet = category.name === 'Vitals & BMI';

    const headers = ['Metric', 'Label', 'Value'];
    if (includesPercent) headers.push('% of Total');
    if (isVitalsSheet) {
      headers.push('Min', 'Q1', 'Median', 'Q3', 'Max', 'Sample Count');
    }

    setSheetTitle(sheet, category.name, headers.length);
    const headerRow = sheet.getRow(2);
    headerRow.values = headers;
    applyHeaderRow(headerRow);

    let rowIndex = 3;
    if (rows.length === 0) {
      const emptyRow = sheet.getRow(rowIndex);
      const emptyValues = new Array(headers.length).fill('');
      emptyValues[0] = 'No data available for selected filters';
      emptyRow.values = emptyValues;
      applyAlternatingDataStyle(emptyRow, 0);
      rowIndex++;
    } else {
      for (const row of rows) {
        const output = [row.metric, row.label, row.value];
        if (includesPercent) output.push(row.percentOfTotal);
        if (isVitalsSheet) {
          output.push(row.min, row.q1, row.median, row.q3, row.max, row.sampleCount);
        }

        const dataRow = sheet.getRow(rowIndex);
        dataRow.values = output;
        applyAlternatingDataStyle(dataRow, rowIndex - 3);
        rowIndex++;
      }
    }

    sheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: headers.length },
    };
    autoFitWorksheetColumns(sheet);
  }

  return workbook;
}

// ============================================================
// PDF EXPORT — with tables + embedded charts
// ============================================================

/**
 * Generate PDF report buffer.
 * Each metric gets a ranked data table (sorted desc) and an embedded chart image.
 *
 * @param {Object} data - Map of dataType → { labels, values, total }
 * @param {Object} meta - { branch, startDate, endDate, title, physician, clinic }
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
async function generatePDF(data, meta) {
  const sections = [];
  const groupBy = formatFilterValue(meta.groupBy, 'Default');
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');
  const ageGroupFilter = formatFilterValue(meta.ageGroup, 'All');
  const filterSummary = `Group By: ${groupBy} | Department: ${departmentFilter} | Sex: ${sexFilter}`;

  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType];
    if (!exportMeta || !result.labels || result.labels.length === 0) continue;

    const maxRows = 10;
    const isTrend = metricTrendType(dataType);
    const isBP = dataType === 'blood-pressure-trends';
    const isBoxPlot = dataType === 'vital-signs-box-plot';

    // Sort by value desc for non-trend data; chronological for trends
    let indices = result.labels.map((_, i) => i);
    if (!isTrend && !isBoxPlot) {
      indices.sort((a, b) => (result.values[b] || 0) - (result.values[a] || 0));
    }
    indices = indices.slice(0, maxRows);

    const tableLabels = indices.map(i => result.labels[i]);
    const tableValues = isBoxPlot
      ? indices.map((i) => Number(result.boxPlot?.[i]?.median) || 0)
      : indices.map((i) => result.values[i]);
    const tableBoxPlot = isBoxPlot
      ? indices
        .map((i) => result.boxPlot?.[i])
        .filter((row) => row && typeof row.name === 'string')
      : undefined;
    const showPercentage = shouldShowPercentageColumn(result, { isTrend, isBP, isBoxPlot });

    const chartContext = result.chartContext || {};

    sections.push({
      title: chartContext.title || exportMeta.label,
      chartType: exportMeta.chartType,
      labels: tableLabels,
      values: tableValues,
      diastolicValues: isBP ? indices.map(i => result.diastolicValues?.[i]) : undefined,
      boxPlot: tableBoxPlot,
      total: result.total || 0,
      xAxis: exportMeta.xAxis,
      yAxis: exportMeta.yAxis,
      isTrend,
      isBP,
      isBoxPlot,
      showPercentage,
      chartContext,
      filterParameters: {
        branch: branchLabel(meta.branch),
        startDate: meta.startDate,
        endDate: meta.endDate,
        groupBy,
        department: departmentFilter,
        sex: sexFilter,
        ageGroup: ageGroupFilter,
      },
      summary: `Total Records: ${result.total || 0}  |  Items shown: ${tableLabels.length}${result.labels.length > maxRows ? ` of ${result.labels.length}` : ''}  |  ${filterSummary}`,
    });
  }

  // Build summary KPIs
  const summary = {};
  for (const [dataType, result] of Object.entries(data)) {
    const label = result?.chartContext?.title || EXPORT_META[dataType]?.label || dataType;
    summary[label] = result.total || 0;
  }
  if (data['oral-findings-percentages']) {
    summary.oralFindingsPrevalence = data['oral-findings-percentages']?.summary
      || 'Oral Findings Prevalence (Boolean-based percentages).';
  }
  summary.reportDateRange = `${meta.startDate} to ${meta.endDate}`;
  summary.appliedFilters = `${filterSummary} | Age Group: ${ageGroupFilter}`;

  const docData = {
    report: {
      title: meta.title || 'Analytics Report',
      subtitle: `${meta.startDate} to ${meta.endDate} | ${filterSummary}`,
      branch: branchLabel(meta.branch),
      dateRange: { startDate: meta.startDate, endDate: meta.endDate },
      generatedAt: new Date().toISOString(),
    },
    sections,
    summary,
    physician: meta.physician || undefined,
    clinic: meta.clinic || {
      name: 'TIP Medical-Dental Services',
      address: meta.branch === 'QuezonCity'
        ? 'Quezon City Campus, Philippines'
        : 'Manila Campus, Philippines',
    },
  };

  const { template } = await docGen.generateDocument('staff-report', docData);
  const buffer = await template.toBuffer();
  const filename = buildFilename('analytics_report', meta.branch, meta.startDate, meta.endDate, 'pdf');

  return { buffer, filename };
}

// ============================================================
// SINGLE-METRIC PDF — focused report for one query
// ============================================================

/**
 * Generate a focused PDF for a single analytics metric.
 * Layout: Header → Report Info → Ranked Data Table (sorted desc) → Chart at bottom.
 * Optimized to fit in 1–2 pages.
 *
 * @param {string} dataType
 * @param {Object} result - { labels, values, total, diastolicValues?, groupBy? }
 * @param {Object} meta - { branch, startDate, endDate, physician, groupBy? }
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
async function generateSingleMetricPDF(dataType, result, meta) {
  const exportMeta = EXPORT_META[dataType];
  if (!exportMeta) throw new Error(`Unknown export type: ${dataType}`);

  const isTrend = metricTrendType(dataType);
  const isBP = dataType === 'blood-pressure-trends';
  const isBoxPlot = dataType === 'vital-signs-box-plot';
  const showPercentage = shouldShowPercentageColumn(result, { isTrend, isBP, isBoxPlot });
  const groupBy = result.groupBy || meta.groupBy || 'monthly';
  const groupLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');
  const ageGroupFilter = formatFilterValue(meta.ageGroup, 'All');
  const filterSubtitle = `Dept: ${departmentFilter} | Sex: ${sexFilter} | Age Group: ${ageGroupFilter}`;
  const chartTitle = result?.chartContext?.title || exportMeta.label;
  const datasetContext = result?.chartContext?.datasetContext || result?.chartContext?.key || dataType;

  const doc = pdf.createDocument({ size: 'letter', margins: { top: 50, bottom: 50, left: 54, right: 54 } });

  // ── Header ──────────────────────────────────────────────
  const reportTitle = isTrend
    ? `${chartTitle} (${groupLabel})`
    : chartTitle;

  pdf.addHeader(doc, reportTitle, `${meta.startDate} to ${meta.endDate} | ${filterSubtitle}`, {
    clinicName: 'TIP Medical-Dental Services',
    address: meta.branch === 'QuezonCity'
      ? 'Quezon City Campus, Philippines'
      : 'Manila Campus, Philippines',
  });

  // ── Report Metadata (compact) ──────────────────────────
  pdf.addSectionHeading(doc, 'Report Information');
  pdf.addField(doc, 'Branch', branchLabel(meta.branch));
  pdf.addField(doc, 'Date Range', `${meta.startDate} to ${meta.endDate}`);
  if (isTrend || meta.groupBy) pdf.addField(doc, 'Grouping', groupLabel);
  pdf.addField(doc, 'Department Filter', departmentFilter);
  pdf.addField(doc, 'Sex Filter', sexFilter);
  pdf.addField(doc, 'Age Group Filter', ageGroupFilter);
  pdf.addField(doc, 'Dataset Context', datasetContext);
  pdf.addField(doc, 'Total Records', String(result.total || 0));
  pdf.addField(doc, 'Generated', new Date().toLocaleString('en-US'));
  doc.moveDown(0.5);

  // ── Data Table ─────────────────────────────────────────
  // Sort by value descending for non-trend data; keep chronological for trends
  const maxRows = 15;
  let sortedIndices = result.labels.map((_, i) => i);
  if (!isTrend && !isBoxPlot) {
    sortedIndices.sort((a, b) => (result.values[b] || 0) - (result.values[a] || 0));
  }
  sortedIndices = sortedIndices.slice(0, maxRows);
  const boxPlotRows = isBoxPlot
    ? sortedIndices
      .map((idx) => result.boxPlot?.[idx])
      .filter((row) => row && typeof row.name === 'string')
    : [];

  pdf.addSectionHeading(doc, isTrend ? 'Data Summary' : 'Data Table');

  if (isBP) {
    // Blood Pressure: show Systolic, Diastolic, and combined
    const headers = ['#', 'Period', 'Avg Systolic', 'Avg Diastolic', 'Avg BP'];
    const rows = sortedIndices.map((idx, rank) => [
      String(rank + 1),
      result.labels[idx],
      String(result.values[idx] || 0),
      String(result.diastolicValues?.[idx] || 0),
      `${result.values[idx] || 0}/${result.diastolicValues?.[idx] || 0}`,
    ]);
    if (rows.length > 0) {
      // Column widths must sum to tableWidth = 612 - 54 - 54 = 504
      pdf.addTable(doc, headers, rows, {
        columnWidths: [30, 200, 90, 90, 94],
      });
    }
  } else if (isBoxPlot && boxPlotRows.length > 0) {
    const headers = ['#', 'Vital', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'n'];
    const rows = boxPlotRows.map((item, rank) => [
      String(rank + 1),
      item.name,
      String(item.min ?? 0),
      String(item.q1 ?? 0),
      String(item.median ?? 0),
      String(item.q3 ?? 0),
      String(item.max ?? 0),
      String(item.count ?? 0),
    ]);

    pdf.addTable(doc, headers, rows, {
      // Column widths sum to 504 (letter width minus margins)
      columnWidths: [24, 140, 52, 52, 62, 52, 52, 70],
    });
  } else {
    const headers = isTrend
      ? ['#', 'Period', exportMeta.yAxis]
      : showPercentage
        ? ['#', exportMeta.xAxis, exportMeta.yAxis, '%']
        : ['#', exportMeta.xAxis, exportMeta.yAxis];

    const rows = sortedIndices.map((idx, rank) => {
      if (isTrend) {
        return [String(rank + 1), result.labels[idx], String(result.values[idx] || 0)];
      }
      if (!showPercentage) {
        return [String(rank + 1), result.labels[idx], String(result.values[idx] || 0)];
      }
      const pct = result.total > 0 ? ((result.values[idx] / result.total) * 100).toFixed(1) + '%' : '0%';
      return [String(rank + 1), result.labels[idx], String(result.values[idx] || 0), pct];
    });

    if (rows.length > 0) {
      // Column widths must sum to tableWidth = 612 - 54 - 54 = 504
      const colWidths = isTrend
        ? [30, 330, 144]   // 504 total
        : showPercentage
          ? [30, 300, 90, 84] // 504 total
          : [30, 320, 154]; // 504 total
      pdf.addTable(doc, headers, rows, { columnWidths: colWidths });
    }
  }

  if (result.labels.length > maxRows) {
    doc.fontSize(8).fillColor('#666666')
      .text(`Showing top ${maxRows} of ${result.labels.length} items`, { align: 'center' });
    doc.moveDown(0.3);
  }

  // ── Chart Visualization ────────────────────────────────
  try {
    const chartLabels = isBoxPlot && boxPlotRows.length > 0
      ? boxPlotRows.map((item) => item.name)
      : sortedIndices.map((i) => result.labels[i]);
    const chartValues = isBoxPlot && boxPlotRows.length > 0
      ? boxPlotRows.map((item) => Number(item.median) || 0)
      : sortedIndices.map((i) => result.values[i]);

    let chartBuffer;
    const chartOpts = { width: 460, height: 250, title: reportTitle };

    if (isBP && result.diastolicValues) {
      // Blood Pressure: dual-line chart (systolic + diastolic)
      chartBuffer = await chart.generateLineChart(chartLabels, [
        { label: 'Systolic', data: chartValues, borderColor: '#F44336', fill: false },
        { label: 'Diastolic', data: sortedIndices.map(i => result.diastolicValues[i]), borderColor: '#2196F3', fill: false },
      ], chartOpts);
    } else {
      switch (exportMeta.chartType) {
        case 'pie':
          chartBuffer = await chart.generatePieChart(chartLabels, chartValues, chartOpts);
          break;
        case 'doughnut':
          chartBuffer = await chart.generateDoughnutChart(chartLabels, chartValues, chartOpts);
          break;
        case 'line':
          chartBuffer = await chart.generateLineChart(chartLabels, [{
            label: chartTitle,
            data: chartValues,
            borderColor: '#2196F3',
            fill: false,
          }], chartOpts);
          break;
        case 'bar':
        default:
          chartBuffer = await chart.generateBarChart(chartLabels, [{
            label: chartTitle,
            data: chartValues,
            backgroundColor: '#4CAF50',
          }], chartOpts);
          break;
      }
    }

    // Add page only if chart (250pt) + heading (~20pt) + padding (20pt) won't fit
    const chartNeeds = 290;
    const pageContentBottom = doc.page.height - doc.page.margins.bottom - 20;
    if (doc.y + chartNeeds > pageContentBottom) {
      doc.addPage();
    } else {
      doc.moveDown(0.5);
    }

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2F4F4F').text('Chart Visualization');
    doc.moveDown(0.3);
    doc.font('Helvetica').fillColor('#333333');

    const chartX = (doc.page.width - 460) / 2;
    pdf.embedImage(doc, chartBuffer, { x: chartX, y: doc.y, width: 460, height: 250 });
    doc.y += 260;
  } catch (err) {
    logger.warn('Chart generation failed for single metric PDF', {
      dataType,
      error: err.message,
      stack: err.stack,
    });
    doc.fontSize(8).fillColor('#999999').text('[Chart could not be generated]', { align: 'center' });
  }

  // ── Footer ─────────────────────────────────────────────
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#666666').text(
    'This report is generated for internal use only.',
    { align: 'center' }
  );

  if (meta.physician) {
    doc.moveDown(0.5);
    const name = `Generated by: ${meta.physician.firstName} ${meta.physician.lastName}`;
    doc.fontSize(10).font('Helvetica').fillColor('#333333').text(name, { align: 'right' });
  }

  pdf.addFooter(doc, { text: 'TIP Medical-Dental Services' });

  const buffer = await pdf.toBuffer(doc);
  const slug = dataType.replace(/[^a-z0-9-]/gi, '_');
  const filename = buildFilename(slug, meta.branch, meta.startDate, meta.endDate, 'pdf');

  return { buffer, filename };
}

// ============================================================
// MODULE EXPORTS
// ============================================================

module.exports = {
  // Configuration
  EXPORT_META,
  EXPORT_PRESETS,

  // Data fetch
  fetchExportData,

  // Generators
  generateCSV,
  generateExcel,
  generatePDF,
  generateSingleMetricPDF,

  // Helpers
  resolveDataTypes,
  buildFilename,
  branchLabel,
};
