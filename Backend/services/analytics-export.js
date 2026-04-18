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
  'consultations-by-type':    { label: 'Consultations by Type',       xAxis: 'Type',          yAxis: 'Count',   chartType: 'pie' },
  'consultations-by-mode':    { label: 'Consultations by Mode',       xAxis: 'Mode',          yAxis: 'Count',   chartType: 'doughnut' },
  'consultation-trends':      { label: 'Consultation Trends',         xAxis: 'Period',         yAxis: 'Count',   chartType: 'line' },
  'top-diagnoses':            { label: 'Top 10 Diagnoses',            xAxis: 'Diagnosis',     yAxis: 'Count',   chartType: 'bar' },
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
  'oral-findings-percentages':  { label: 'Oral Finding Percentages',   xAxis: 'Finding', yAxis: 'Percentage', chartType: 'bar' },
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
    description: 'Consultation metrics: type, mode, trends',
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
    description: 'Immunization coverage and dental procedures',
    dataTypes: ['immunization-coverage', 'dental-procedures'],
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

  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType] || {};
    const labels = Array.isArray(result?.labels) ? result.labels : [];
    const values = Array.isArray(result?.values) ? result.values : [];
    const series = Array.isArray(result?.series) ? result.series : [];
    const boxPlot = Array.isArray(result?.boxPlot) ? result.boxPlot : [];
    const rawCounts = Array.isArray(result?.rawCounts) ? result.rawCounts : [];
    const diastolicValues = Array.isArray(result?.diastolicValues) ? result.diastolicValues : [];
    const metricTotal = normalizeNumeric(result?.total);
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
      branch,
      startDate,
      endDate,
      groupBy,
      departmentFilter,
      sexFilter,
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

// ============================================================
// CSV EXPORT
// ============================================================

/**
 * Generate CSV string from analytics data.
 * Each data type gets its own section separated by a blank line.
 *
 * @param {Object} data - Map of dataType → { labels, values, total }
 * @param {Object} meta - { branch, startDate, endDate }
 * @returns {string} CSV content
 */
function generateCSV(data, meta) {
  const lines = [];
  const detailRows = buildDetailedRows(data, meta);
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const branch = branchLabel(meta.branch);
  const dateRange = `${meta.startDate} to ${meta.endDate}`;
  const groupBy = formatFilterValue(meta.groupBy, 'Default');
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');

  // Header info
  lines.push(`# Analytics Export`);
  lines.push(`# Branch: ${branch}`);
  lines.push(`# Date Range: ${dateRange}`);
  lines.push(`# Group By: ${groupBy}`);
  lines.push(`# Department Filter: ${departmentFilter}`);
  lines.push(`# Sex Filter: ${sexFilter}`);
  lines.push(`# Generated: ${generatedAt}`);
  lines.push('');

  // Flat detail section first for import-friendly analytics data.
  lines.push([
    'Metric Key',
    'Metric',
    'Chart Type',
    'Chart Variant',
    'Row Type',
    'XAxis',
    'Label',
    'Value',
    'YAxis',
    'Series',
    'Raw Count',
    'Diastolic Value',
    'Min',
    'Q1',
    'Median',
    'Q3',
    'Max',
    'Sample Count',
    'Percent Of Metric Total',
    'Metric Total',
    'Item Count',
    'Branch',
    'Start Date',
    'End Date',
    'Group By',
    'Department Filter',
    'Sex Filter',
  ].map(csvEscape).join(','));

  for (const row of detailRows) {
    lines.push([
      row.metricKey,
      row.metric,
      row.chartType,
      row.chartVariant,
      row.rowType,
      row.xAxis,
      row.label,
      row.value,
      row.yAxis,
      row.series,
      row.rawCount,
      row.diastolicValue,
      row.min,
      row.q1,
      row.median,
      row.q3,
      row.max,
      row.sampleCount,
      row.percentOfTotal,
      row.metricTotal,
      row.itemCount,
      row.branch,
      row.startDate,
      row.endDate,
      row.groupBy,
      row.departmentFilter,
      row.sexFilter,
    ].map(csvEscape).join(','));
  }

  lines.push('');

  // Summary section
  lines.push('Metric Key,Metric,Chart Type,Total,Items,Branch,Date Range,Group By,Department Filter,Sex Filter');
  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType] || {};
    const label = exportMeta.label || dataType;
    const chartType = exportMeta.chartType || '';
    const total = normalizeNumeric(result?.total);
    const items = Array.isArray(result?.labels) ? result.labels.length : 0;
    lines.push([
      dataType,
      label,
      chartType,
      total,
      items,
      branch,
      dateRange,
      groupBy,
      departmentFilter,
      sexFilter,
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
 * Generate Excel workbook with summary + per-metric sheets.
 *
 * @param {Object} data - Map of dataType → { labels, values, total }
 * @param {Object} meta - { branch, startDate, endDate }
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateExcel(data, meta) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MDSystem Analytics';
  workbook.created = new Date();

  const detailRows = buildDetailedRows(data, meta);
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const branch = branchLabel(meta.branch);
  const dateRange = `${meta.startDate} to ${meta.endDate}`;
  const groupBy = formatFilterValue(meta.groupBy, 'Default');
  const departmentFilter = formatFilterValue(meta.department, 'All');
  const sexFilter = formatFilterValue(meta.sex, 'All');

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    },
  };

  const cellBorder = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  };

  const applyHeaderRow = (row) => {
    row.eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });
  };

  const applyDataBorder = (row) => {
    row.eachCell((cell) => {
      cell.border = cellBorder;
    });
  };

  // ── Detailed Breakdown Sheet (first/default tab) ────────
  const detailSheet = workbook.addWorksheet('Detailed Breakdown', {
    properties: { tabColor: { argb: 'FF2563EB' } },
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  detailSheet.mergeCells('A1:H1');
  const detailTitle = detailSheet.getCell('A1');
  detailTitle.value = 'MDSystem Analytics Detailed Breakdown';
  detailTitle.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };

  detailSheet.mergeCells('A2:H2');
  detailSheet.getCell('A2').value = `Branch: ${branch} | Date Range: ${dateRange}`;
  detailSheet.getCell('A2').font = { size: 10, color: { argb: 'FF4B5563' } };

  detailSheet.mergeCells('A3:H3');
  detailSheet.getCell('A3').value = `Group By: ${groupBy} | Department Filter: ${departmentFilter} | Sex Filter: ${sexFilter}`;
  detailSheet.getCell('A3').font = { size: 10, color: { argb: 'FF4B5563' } };

  detailSheet.mergeCells('A4:H4');
  detailSheet.getCell('A4').value = `Generated: ${generatedAt}`;
  detailSheet.getCell('A4').font = { size: 10, color: { argb: 'FF6B7280' } };

  const detailHeaders = [
    'Metric Key',
    'Metric',
    'Chart Type',
    'Chart Variant',
    'Row Type',
    'XAxis',
    'Label',
    'Value',
    'YAxis',
    'Series',
    'Raw Count',
    'Diastolic Value',
    'Min',
    'Q1',
    'Median',
    'Q3',
    'Max',
    'Sample Count',
    'Percent Of Metric Total',
    'Metric Total',
    'Item Count',
    'Branch',
    'Start Date',
    'End Date',
    'Group By',
    'Department Filter',
    'Sex Filter',
  ];

  const detailHeaderRow = detailSheet.getRow(6);
  detailHeaderRow.values = detailHeaders;
  applyHeaderRow(detailHeaderRow);

  let detailRowIndex = 7;
  for (const row of detailRows) {
    const excelRow = detailSheet.getRow(detailRowIndex);
    excelRow.values = [
      row.metricKey,
      row.metric,
      row.chartType,
      row.chartVariant,
      row.rowType,
      row.xAxis,
      row.label,
      row.value,
      row.yAxis,
      row.series,
      row.rawCount,
      row.diastolicValue,
      row.min,
      row.q1,
      row.median,
      row.q3,
      row.max,
      row.sampleCount,
      row.percentOfTotal,
      row.metricTotal,
      row.itemCount,
      row.branch,
      row.startDate,
      row.endDate,
      row.groupBy,
      row.departmentFilter,
      row.sexFilter,
    ];
    applyDataBorder(excelRow);
    detailRowIndex++;
  }

  detailSheet.columns = [
    { width: 26 }, { width: 34 }, { width: 14 }, { width: 16 }, { width: 18 },
    { width: 18 }, { width: 16 }, { width: 30 }, { width: 24 }, { width: 14 },
    { width: 14 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 10 }, { width: 12 }, { width: 20 }, { width: 12 },
    { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 },
    { width: 18 }, { width: 14 },
  ];
  detailSheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: detailHeaders.length },
  };

  // ── Research Ready Sheet (flat, analysis-first columns) ─
  const researchSheet = workbook.addWorksheet('Research Ready', {
    properties: { tabColor: { argb: 'FF0EA5E9' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const researchHeaders = [
    'Metric Key',
    'Metric',
    'Label',
    'Series',
    'Row Type',
    'Value',
    'Raw Count',
    'Diastolic Value',
    'Median',
    'Sample Count',
    'Metric Total',
    'Percent Of Metric Total',
    'Branch',
    'Start Date',
    'End Date',
    'Group By',
    'Department Filter',
    'Sex Filter',
  ];

  const researchHeaderRow = researchSheet.getRow(1);
  researchHeaderRow.values = researchHeaders;
  applyHeaderRow(researchHeaderRow);

  let researchRowIndex = 2;
  for (const row of detailRows) {
    if (row.rowType === 'no-data') continue;

    const excelRow = researchSheet.getRow(researchRowIndex);
    excelRow.values = [
      row.metricKey,
      row.metric,
      row.label,
      row.series,
      row.rowType,
      row.value,
      row.rawCount,
      row.diastolicValue,
      row.median,
      row.sampleCount,
      row.metricTotal,
      row.percentOfTotal,
      row.branch,
      row.startDate,
      row.endDate,
      row.groupBy,
      row.departmentFilter,
      row.sexFilter,
    ];
    applyDataBorder(excelRow);
    researchRowIndex++;
  }

  if (researchRowIndex === 2) {
    const emptyRow = researchSheet.getRow(2);
    emptyRow.values = ['', 'No data available for selected filters'];
    applyDataBorder(emptyRow);
  }

  researchSheet.columns = [
    { width: 26 }, { width: 34 }, { width: 30 }, { width: 20 }, { width: 18 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 14 },
    { width: 12 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 12 }, { width: 18 }, { width: 14 },
  ];

  researchSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: researchHeaders.length },
  };

  // ── Summary Sheet ─────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF4CAF50' } },
  });

  // Title rows
  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'MDSystem Analytics Export';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF2F4F4F' } };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:F2');
  summarySheet.getCell('A2').value = `Branch: ${branch}  |  ${dateRange}`;
  summarySheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A3:F3');
  summarySheet.getCell('A3').value = `Group By: ${groupBy}  |  Department: ${departmentFilter}  |  Sex: ${sexFilter}`;
  summarySheet.getCell('A3').font = { size: 10, color: { argb: 'FF666666' } };
  summarySheet.getCell('A3').alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A4:F4');
  summarySheet.getCell('A4').value = 'See the "Detailed Breakdown" sheet for complete metric-level rows.';
  summarySheet.getCell('A4').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };
  summarySheet.getCell('A4').alignment = { horizontal: 'center' };

  // Summary table
  const summaryHeaderRow = summarySheet.getRow(6);
  summaryHeaderRow.values = ['Metric', 'Total', 'Items', 'Chart Type', 'Date Range', 'Filters'];
  applyHeaderRow(summaryHeaderRow);

  let row = 7;
  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType] || {};
    const label = exportMeta.label || dataType;
    const dataRow = summarySheet.getRow(row);
    dataRow.values = [
      label,
      normalizeNumeric(result?.total),
      Array.isArray(result?.labels) ? result.labels.length : 0,
      exportMeta.chartType || '',
      dateRange,
      `Group By: ${groupBy}; Dept: ${departmentFilter}; Sex: ${sexFilter}`,
    ];
    applyDataBorder(dataRow);
    row++;
  }

  summarySheet.columns = [
    { width: 35 },
    { width: 15 },
    { width: 12 },
    { width: 14 },
    { width: 28 },
    { width: 42 },
  ];

  // ── Per-Metric Sheets ─────────────────────────────────────
  for (const [dataType, result] of Object.entries(data)) {
    const meta_ = EXPORT_META[dataType];
    if (!meta_ || !result.labels) continue;

    // Sheet name limited to 31 chars (Excel limitation)
    const sheetName = meta_.label.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    const isTrend = metricTrendType(dataType);
    const isBP = dataType === 'blood-pressure-trends';
    const isBoxPlot = dataType === 'vital-signs-box-plot';
    const hasSeries = Array.isArray(result.series) && result.series.length > 0;
    const hasRawCounts = Array.isArray(result.rawCounts) && result.rawCounts.length > 0;
    const hasDiastolic = Array.isArray(result.diastolicValues) && result.diastolicValues.length > 0;
    const showPercentage = shouldShowPercentageColumn(result, { isTrend, isBP, isBoxPlot });

    // Title
    sheet.mergeCells('A1:H1');
    const sTitleCell = sheet.getCell('A1');
    sTitleCell.value = meta_.label;
    sTitleCell.font = { bold: true, size: 13, color: { argb: 'FF2F4F4F' } };

    sheet.mergeCells('A2:H2');
    sheet.getCell('A2').value = `Branch: ${branch} | Date Range: ${dateRange} | Total: ${normalizeNumeric(result.total)}`;
    sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

    sheet.mergeCells('A3:H3');
    sheet.getCell('A3').value = `Group By: ${groupBy} | Department Filter: ${departmentFilter} | Sex Filter: ${sexFilter}`;
    sheet.getCell('A3').font = { size: 10, color: { argb: 'FF666666' } };

    // Table header
    const hRow = sheet.getRow(5);
    let headers = [meta_.xAxis, meta_.yAxis];

    if (isBoxPlot && Array.isArray(result.boxPlot) && result.boxPlot.length > 0) {
      headers = ['Vital', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'Sample Count'];
    } else if (hasSeries) {
      headers = [meta_.xAxis, ...result.series.map((s) => s.name)];
    } else if (isBP && hasDiastolic) {
      headers = [meta_.xAxis, 'Avg Systolic', 'Avg Diastolic'];
    } else if (hasRawCounts) {
      headers = [meta_.xAxis, meta_.yAxis, 'Raw Count'];
    } else if (showPercentage) {
      headers = [meta_.xAxis, meta_.yAxis, '% of Total'];
    }

    hRow.values = headers;
    applyHeaderRow(hRow);

    // Data rows
    let dataStartRow = 6;
    let lastDataRow = 5;

    if (isBoxPlot && Array.isArray(result.boxPlot) && result.boxPlot.length > 0) {
      for (let i = 0; i < result.boxPlot.length; i++) {
        const item = result.boxPlot[i] || {};
        const r = sheet.getRow(dataStartRow + i);
        r.values = [
          item.name || '',
          normalizeNumeric(item.min),
          normalizeNumeric(item.q1),
          normalizeNumeric(item.median),
          normalizeNumeric(item.q3),
          normalizeNumeric(item.max),
          normalizeNumeric(item.count),
        ];
        applyDataBorder(r);
      }
      lastDataRow = dataStartRow + result.boxPlot.length - 1;
    } else if (hasSeries) {
      for (let i = 0; i < result.labels.length; i++) {
        const r = sheet.getRow(dataStartRow + i);
        r.values = [result.labels[i], ...result.series.map((s) => normalizeNumeric(s.values?.[i]))];
        applyDataBorder(r);
      }
      lastDataRow = dataStartRow + result.labels.length - 1;
    } else {
      const rowCount = Math.max(
        Array.isArray(result.labels) ? result.labels.length : 0,
        Array.isArray(result.values) ? result.values.length : 0,
        hasRawCounts ? result.rawCounts.length : 0,
        hasDiastolic ? result.diastolicValues.length : 0
      );

      for (let i = 0; i < rowCount; i++) {
        const label = result.labels?.[i] || `Item ${i + 1}`;
        const value = normalizeNumeric(result.values?.[i]);
        const r = sheet.getRow(dataStartRow + i);

        if (isBP && hasDiastolic) {
          r.values = [label, value, normalizeNumeric(result.diastolicValues?.[i])];
        } else if (hasRawCounts) {
          r.values = [label, value, normalizeNumeric(result.rawCounts?.[i])];
        } else if (showPercentage) {
          r.values = [label, value, percentOfTotal(value, result.total) || 0];
        } else {
          r.values = [label, value];
        }

        applyDataBorder(r);
      }
      lastDataRow = dataStartRow + rowCount - 1;
    }

    // Total row
    const totalRow = sheet.getRow(lastDataRow + 1);
    if (isBoxPlot) {
      totalRow.values = ['Total Records', '', '', '', '', '', normalizeNumeric(result.total)];
    } else if (hasSeries) {
      totalRow.values = [
        'Total',
        ...result.series.map((entry) => sumSeriesValues(Array.isArray(entry.values) ? entry.values : [])),
      ];
    } else if (isBP && hasDiastolic) {
      totalRow.values = ['Total Records', normalizeNumeric(result.total), ''];
    } else if (hasRawCounts) {
      totalRow.values = [
        'Total Population',
        normalizeNumeric(result.total),
        sumSeriesValues(Array.isArray(result.rawCounts) ? result.rawCounts : []),
      ];
    } else if (showPercentage) {
      totalRow.values = ['Total', normalizeNumeric(result.total), 100];
    } else {
      totalRow.values = ['Total', normalizeNumeric(result.total)];
    }
    totalRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.border = cellBorder;
    });

    sheet.columns = headers.map((_, index) => ({ width: index === 0 ? 35 : 18 }));
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

    sections.push({
      title: exportMeta.label,
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
      summary: `Total Records: ${result.total || 0}  |  Items shown: ${tableLabels.length}${result.labels.length > maxRows ? ` of ${result.labels.length}` : ''}  |  ${filterSummary}`,
    });
  }

  // Build summary KPIs
  const summary = {};
  for (const [dataType, result] of Object.entries(data)) {
    const label = EXPORT_META[dataType]?.label || dataType;
    summary[label] = result.total || 0;
  }
  summary.reportDateRange = `${meta.startDate} to ${meta.endDate}`;
  summary.appliedFilters = filterSummary;

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
  const filterSubtitle = `Dept: ${departmentFilter} | Sex: ${sexFilter}`;

  const doc = pdf.createDocument({ size: 'letter', margins: { top: 50, bottom: 50, left: 54, right: 54 } });

  // ── Header ──────────────────────────────────────────────
  const reportTitle = isTrend
    ? `${exportMeta.label} (${groupLabel})`
    : exportMeta.label;

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
            label: exportMeta.label,
            data: chartValues,
            borderColor: '#2196F3',
            fill: false,
          }], chartOpts);
          break;
        case 'bar':
        default:
          chartBuffer = await chart.generateBarChart(chartLabels, [{
            label: exportMeta.label,
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
