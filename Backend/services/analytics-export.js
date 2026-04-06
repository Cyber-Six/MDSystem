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
};

/**
 * Predefined export presets for quick export options
 */
const EXPORT_PRESETS = {
  'full-report': {
    label: 'Full Analytics Report',
    description: 'All 15 analytics metrics combined',
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
    description: 'BMI and blood pressure trend analysis',
    dataTypes: ['bmi-trends', 'blood-pressure-trends'],
  },
  'appointments': {
    label: 'Appointments Report',
    description: 'Appointment category, status, and session data',
    dataTypes: ['appointments-by-category', 'appointments-by-status', 'appointments-by-session'],
  },
  'clinical': {
    label: 'Clinical Data Report',
    description: 'Immunization coverage and dental procedures',
    dataTypes: ['immunization-coverage', 'dental-procedures'],
  },
  'lifestyle': {
    label: 'Lifestyle & Allergies Report',
    description: 'Lifestyle risk factors and allergy data',
    dataTypes: ['lifestyle-risks', 'allergy-by-type', 'allergy-by-severity'],
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

  // Header info
  lines.push(`# Analytics Export`);
  lines.push(`# Branch: ${branchLabel(meta.branch)}`);
  lines.push(`# Date Range: ${meta.startDate} to ${meta.endDate}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary section
  lines.push('Section,Total');
  for (const [dataType, result] of Object.entries(data)) {
    const label = EXPORT_META[dataType]?.label || dataType;
    lines.push(`"${label}",${result.total || 0}`);
  }
  lines.push('');

  // Detailed sections
  for (const [dataType, result] of Object.entries(data)) {
    const meta_ = EXPORT_META[dataType];
    if (!meta_ || !result.labels) continue;

    lines.push(`# ${meta_.label}`);
    lines.push(`${csvEscape(meta_.xAxis)},${csvEscape(meta_.yAxis)}`);

    for (let i = 0; i < result.labels.length; i++) {
      lines.push(`${csvEscape(result.labels[i])},${result.values[i] || 0}`);
    }
    lines.push(`Total,${result.total || 0}`);
    lines.push('');
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

  // ── Summary Sheet ─────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF4CAF50' } },
  });

  // Title rows
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'MDSystem Analytics Export';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF2F4F4F' } };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:C2');
  summarySheet.getCell('A2').value = `Branch: ${branchLabel(meta.branch)}  |  ${meta.startDate} to ${meta.endDate}`;
  summarySheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };

  // Summary table
  const summaryHeaderRow = summarySheet.getRow(4);
  summaryHeaderRow.values = ['Metric', 'Total', 'Items'];
  summaryHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  let row = 5;
  for (const [dataType, result] of Object.entries(data)) {
    const label = EXPORT_META[dataType]?.label || dataType;
    const dataRow = summarySheet.getRow(row);
    dataRow.values = [label, result.total || 0, result.labels?.length || 0];
    dataRow.eachCell(cell => { cell.border = cellBorder; });
    row++;
  }

  summarySheet.columns = [
    { width: 35 },
    { width: 15 },
    { width: 12 },
  ];

  // ── Per-Metric Sheets ─────────────────────────────────────
  for (const [dataType, result] of Object.entries(data)) {
    const meta_ = EXPORT_META[dataType];
    if (!meta_ || !result.labels) continue;

    // Sheet name limited to 31 chars (Excel limitation)
    const sheetName = meta_.label.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // Title
    sheet.mergeCells('A1:B1');
    const sTitleCell = sheet.getCell('A1');
    sTitleCell.value = meta_.label;
    sTitleCell.font = { bold: true, size: 13, color: { argb: 'FF2F4F4F' } };

    sheet.mergeCells('A2:B2');
    sheet.getCell('A2').value = `Total: ${result.total || 0}`;
    sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

    // Table header
    const hRow = sheet.getRow(4);
    hRow.values = [meta_.xAxis, meta_.yAxis];
    hRow.eachCell(cell => Object.assign(cell, headerStyle));

    // Data rows
    for (let i = 0; i < result.labels.length; i++) {
      const r = sheet.getRow(5 + i);
      r.values = [result.labels[i], result.values[i] || 0];
      r.eachCell(cell => { cell.border = cellBorder; });
    }

    // Total row
    const totalRow = sheet.getRow(5 + result.labels.length);
    totalRow.values = ['Total', result.total || 0];
    totalRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.border = cellBorder;
    });

    sheet.columns = [
      { width: 35 },
      { width: 18 },
    ];
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
  const isTrendType = (dt) => ['consultation-trends', 'bmi-trends', 'blood-pressure-trends'].includes(dt);

  for (const [dataType, result] of Object.entries(data)) {
    const exportMeta = EXPORT_META[dataType];
    if (!exportMeta || !result.labels || result.labels.length === 0) continue;

    const maxRows = 10;
    const isTrend = isTrendType(dataType);

    // Sort by value desc for non-trend data; chronological for trends
    let indices = result.labels.map((_, i) => i);
    if (!isTrend) {
      indices.sort((a, b) => (result.values[b] || 0) - (result.values[a] || 0));
    }
    indices = indices.slice(0, maxRows);

    const tableLabels = indices.map(i => result.labels[i]);
    const tableValues = indices.map(i => result.values[i]);
    const isBP = dataType === 'blood-pressure-trends';

    sections.push({
      title: exportMeta.label,
      chartType: exportMeta.chartType,
      labels: tableLabels,
      values: tableValues,
      diastolicValues: isBP ? indices.map(i => result.diastolicValues?.[i]) : undefined,
      total: result.total || 0,
      xAxis: exportMeta.xAxis,
      yAxis: exportMeta.yAxis,
      isTrend,
      isBP,
      summary: `Total Records: ${result.total || 0}  |  Items shown: ${tableLabels.length}${result.labels.length > maxRows ? ` of ${result.labels.length}` : ''}`,
    });
  }

  // Build summary KPIs
  const summary = {};
  for (const [dataType, result] of Object.entries(data)) {
    const label = EXPORT_META[dataType]?.label || dataType;
    summary[label] = result.total || 0;
  }

  const docData = {
    report: {
      title: meta.title || 'Analytics Report',
      subtitle: `${meta.startDate} to ${meta.endDate}`,
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

  const isTrend = ['consultation-trends', 'bmi-trends', 'blood-pressure-trends'].includes(dataType);
  const isBP = dataType === 'blood-pressure-trends';
  const groupBy = result.groupBy || meta.groupBy || 'monthly';
  const groupLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);

  const doc = pdf.createDocument({ size: 'letter', margins: { top: 50, bottom: 50, left: 54, right: 54 } });

  // ── Header ──────────────────────────────────────────────
  const reportTitle = isTrend
    ? `${exportMeta.label} (${groupLabel})`
    : exportMeta.label;

  pdf.addHeader(doc, reportTitle, `${meta.startDate} to ${meta.endDate}`, {
    clinicName: 'TIP Medical-Dental Services',
    address: meta.branch === 'QuezonCity'
      ? 'Quezon City Campus, Philippines'
      : 'Manila Campus, Philippines',
  });

  // ── Report Metadata (compact) ──────────────────────────
  pdf.addSectionHeading(doc, 'Report Information');
  pdf.addField(doc, 'Branch', branchLabel(meta.branch));
  pdf.addField(doc, 'Date Range', `${meta.startDate} to ${meta.endDate}`);
  if (isTrend) pdf.addField(doc, 'Grouping', groupLabel);
  pdf.addField(doc, 'Total Records', String(result.total || 0));
  pdf.addField(doc, 'Generated', new Date().toLocaleString('en-US'));
  doc.moveDown(0.5);

  // ── Data Table ─────────────────────────────────────────
  // Sort by value descending for non-trend data; keep chronological for trends
  const maxRows = 15;
  let sortedIndices = result.labels.map((_, i) => i);
  if (!isTrend) {
    sortedIndices.sort((a, b) => (result.values[b] || 0) - (result.values[a] || 0));
  }
  sortedIndices = sortedIndices.slice(0, maxRows);

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
      pdf.addTable(doc, headers, rows, {
        columnWidths: [30, 100, 95, 95, 84],
      });
    }
  } else {
    const headers = isTrend
      ? ['#', 'Period', exportMeta.yAxis]
      : ['#', exportMeta.xAxis, exportMeta.yAxis, '%'];

    const rows = sortedIndices.map((idx, rank) => {
      const pct = result.total > 0 ? ((result.values[idx] / result.total) * 100).toFixed(1) + '%' : '0%';
      if (isTrend) {
        return [String(rank + 1), result.labels[idx], String(result.values[idx] || 0)];
      }
      return [String(rank + 1), result.labels[idx], String(result.values[idx] || 0), pct];
    });

    if (rows.length > 0) {
      const colWidths = isTrend
        ? [30, 220, 154]
        : [30, 210, 80, 84];
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
    const chartLabels = sortedIndices.map(i => result.labels[i]);
    const chartValues = sortedIndices.map(i => result.values[i]);

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

    // Move to next page only if chart won't fit
    if (doc.y > 480) doc.addPage();
    else doc.moveDown(0.5);

    pdf.addSectionHeading(doc, 'Chart Visualization');
    const chartX = (doc.page.width - 460) / 2;
    pdf.embedImage(doc, chartBuffer, { x: chartX, y: doc.y, width: 460, height: 250 });
    doc.y += 260;
  } catch (err) {
    logger.warn('Chart generation failed for single metric PDF', { dataType, error: err.message });
    doc.fontSize(8).fillColor('#999').text('[Chart could not be generated]', { align: 'center' });
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
