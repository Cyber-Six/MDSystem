const ExcelJS = require('exceljs');
const analytics = require('./analytics-query.js');
const logger = require('../utils/logger.js');
const { EXPORT_META } = require('./analytics-export.js');

const ALL_DEPARTMENTS_LABEL = 'All Departments';

const AGE_GROUP_COLUMNS = Object.freeze([
  { key: 'under17', label: 'Under 17', filterValue: 'Under 17' },
  { key: '17to20', label: '17-20', filterValue: '17-20' },
  { key: '21to25', label: '21-25', filterValue: '21-25' },
  { key: '26to30', label: '26-30', filterValue: '26-30' },
]);

const SEX_COLUMNS = Object.freeze([
  { key: 'male', label: 'Male', filterValue: 'Male', color: 'FF4472C4' },
  { key: 'female', label: 'Female', filterValue: 'Female', color: 'FFC55A11' },
]);

const CELL_COLUMN_KEYS = Object.freeze(
  AGE_GROUP_COLUMNS.flatMap((age) => SEX_COLUMNS.map((sex) => `${age.key}_${sex.key}`))
);

const TAB_CONFIG = Object.freeze([
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
  {
    name: 'Inventory',
    metrics: [
      'inventory-report-summary',
      'most-consumed-medicine',
      'most-consumed-supply',
      'inventory-consumption-trends',
    ],
  },
]);

function csvEscape(value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldCalculatePct(result, value) {
  const total = Number(result?.total);
  const parsedValue = Number(value);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(parsedValue)) return false;
  if (String(result?.unit || '').toLowerCase() === 'percentage') return false;
  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > total) return false;

  return true;
}

function pctOfTotal(value, total) {
  const parsedValue = Number(value);
  const parsedTotal = Number(total);
  if (!Number.isFinite(parsedValue) || !Number.isFinite(parsedTotal) || parsedTotal <= 0) return '';
  return Number(((parsedValue / parsedTotal) * 100).toFixed(1));
}

function metricLabel(metricKey) {
  return EXPORT_META[metricKey]?.label || metricKey;
}

function isPercentageMetric(metricKey, point = {}) {
  if (String(point?.unit || '').toLowerCase() === 'percentage') return true;
  return metricKey === 'oral-findings-percentages';
}

function isVitalsSheet(name) {
  return name === 'Vitals & BMI';
}

function sumFinite(values = []) {
  return values.reduce((sum, value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);
}

function buildRowCellTemplate() {
  return CELL_COLUMN_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function flattenMetricPoints(metricKey, result = {}) {
  const points = [];
  const labels = Array.isArray(result.labels) ? result.labels : [];
  const values = Array.isArray(result.values) ? result.values : [];
  const series = Array.isArray(result.series) ? result.series : [];
  const boxPlot = Array.isArray(result.boxPlot) ? result.boxPlot : [];
  const total = Number(result.total);

  if (boxPlot.length > 0) {
    for (const item of boxPlot) {
      const median = normalizeNumeric(item?.median);
      if (median === null) continue;
      points.push({
        label: item?.name || 'Unknown',
        value: median,
        pctOfTotal: '',
        unit: result.unit || '',
        min: normalizeNumeric(item?.min),
        q1: normalizeNumeric(item?.q1),
        median: median,
        q3: normalizeNumeric(item?.q3),
        max: normalizeNumeric(item?.max),
        sampleCount: normalizeNumeric(item?.count),
      });
    }
    return points;
  }

  if (series.length > 0) {
    const rowCount = Math.max(
      labels.length,
      ...series.map((entry) => (Array.isArray(entry.values) ? entry.values.length : 0)),
      0
    );

    for (let i = 0; i < rowCount; i++) {
      const baseLabel = labels[i] || `Item ${i + 1}`;
      for (const entry of series) {
        const numericValue = normalizeNumeric(Array.isArray(entry.values) ? entry.values[i] : undefined);
        if (numericValue === null) continue;

        const withSeriesLabel = series.length > 1
          ? `${baseLabel} (${entry.name || 'Series'})`
          : baseLabel;

        points.push({
          label: withSeriesLabel,
          value: numericValue,
          pctOfTotal: shouldCalculatePct(result, numericValue) ? pctOfTotal(numericValue, total) : '',
          unit: result.unit || '',
          min: null,
          q1: null,
          median: null,
          q3: null,
          max: null,
          sampleCount: null,
        });
      }
    }

    return points;
  }

  const rowCount = Math.max(labels.length, values.length);
  for (let i = 0; i < rowCount; i++) {
    const numericValue = normalizeNumeric(values[i]);
    if (numericValue === null) continue;

    points.push({
      label: labels[i] || `Item ${i + 1}`,
      value: numericValue,
      pctOfTotal: shouldCalculatePct(result, numericValue) ? pctOfTotal(numericValue, total) : '',
      unit: result.unit || '',
      min: null,
      q1: null,
      median: null,
      q3: null,
      max: null,
      sampleCount: null,
    });
  }

  if (points.length === 0) {
    const fallback = normalizeNumeric(result.total);
    if (fallback !== null) {
      points.push({
        label: 'Total',
        value: fallback,
        pctOfTotal: '',
        unit: result.unit || '',
        min: null,
        q1: null,
        median: null,
        q3: null,
        max: null,
        sampleCount: null,
      });
    }
  }

  return points;
}

function metricToSheetLookup(sheetConfig) {
  const lookup = {};
  for (const sheet of sheetConfig) {
    for (const metric of sheet.metrics) {
      lookup[metric] = sheet.name;
    }
  }
  return lookup;
}

function activeSheetConfig(requestedDataTypes = []) {
  const requested = Array.isArray(requestedDataTypes)
    ? new Set(requestedDataTypes.map((entry) => String(entry || '').trim()).filter(Boolean))
    : new Set();

  if (requested.size === 0) {
    return TAB_CONFIG.map((sheet) => ({ ...sheet, metrics: [...sheet.metrics] }));
  }

  return TAB_CONFIG
    .map((sheet) => ({
      ...sheet,
      metrics: sheet.metrics.filter((metric) => requested.has(metric)),
    }))
    .filter((sheet) => sheet.metrics.length > 0);
}

function computeRowTotals(row) {
  const ageTotals = {
    male: sumFinite(AGE_GROUP_COLUMNS.map((age) => row.cells[`${age.key}_male`])),
    female: sumFinite(AGE_GROUP_COLUMNS.map((age) => row.cells[`${age.key}_female`])),
  };

  return {
    total_male: ageTotals.male,
    total_female: ageTotals.female,
    grand_total: ageTotals.male + ageTotals.female,
  };
}

function sheetSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dateToken(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function buildSummaryRows(groupedBySheet = {}) {
  const rows = [];

  for (const sheet of TAB_CONFIG) {
    const sheetData = groupedBySheet[sheet.name] || {};
    for (const metricKey of sheet.metrics) {
      const departments = sheetData[metricKey] || {};
      const allDepartmentRows = departments[ALL_DEPARTMENTS_LABEL] || [];
      const total = sumFinite(allDepartmentRows.map((row) => row.grandTotal));
      rows.push({
        metricName: metricLabel(metricKey),
        category: sheet.name,
        totalValue: total,
        itemCount: allDepartmentRows.length,
      });
    }
  }

  return rows;
}

async function buildMatrixData(meta = {}, requestedDataTypes = []) {
  const sheetConfig = activeSheetConfig(requestedDataTypes);
  const metricLookup = metricToSheetLookup(sheetConfig);
  const metrics = Array.from(new Set(sheetConfig.flatMap((sheet) => sheet.metrics)));

  const filterOptions = await analytics.getFilterOptions();
  const departments = Array.isArray(filterOptions.departments)
    ? filterOptions.departments.filter(Boolean)
    : [];

  const scopedDepartments = [...departments, ALL_DEPARTMENTS_LABEL];
  const groupedRows = new Map();
  const flatRecords = new Map();

  for (const sheet of sheetConfig) {
    flatRecords.set(sheet.name, []);
  }

  for (const department of scopedDepartments) {
    for (const age of AGE_GROUP_COLUMNS) {
      for (const sex of SEX_COLUMNS) {
        const options = {
          groupBy: meta.groupBy,
          sex: sex.filterValue,
          ageGroup: age.filterValue,
        };

        if (department !== ALL_DEPARTMENTS_LABEL) {
          options.department = department;
        }

        const batch = await analytics.executeBatchQueries(
          metrics,
          meta.branch,
          meta.startDate,
          meta.endDate,
          options
        );

        for (const metricKey of metrics) {
          const wrapped = batch[metricKey];
          if (!wrapped || !wrapped.success || !wrapped.data) continue;

          const sheetName = metricLookup[metricKey];
          if (!sheetName) continue;

          const points = flattenMetricPoints(metricKey, wrapped.data);
          const columnKey = `${age.key}_${sex.key}`;

          for (const point of points) {
            const rowKey = `${sheetName}::${metricKey}::${department}::${point.label}`;
            let row = groupedRows.get(rowKey);
            if (!row) {
              row = {
                sheet: sheetName,
                metricKey,
                metricName: metricLabel(metricKey),
                department,
                label: point.label,
                unit: point.unit || '',
                cells: buildRowCellTemplate(),
                stats: {
                  min: null,
                  q1: null,
                  median: null,
                  q3: null,
                  max: null,
                  sampleCount: null,
                },
              };
              groupedRows.set(rowKey, row);
            }

            row.cells[columnKey] = point.value;

            if (isVitalsSheet(sheetName) && department === ALL_DEPARTMENTS_LABEL) {
              row.stats = {
                min: point.min,
                q1: point.q1,
                median: point.median,
                q3: point.q3,
                max: point.max,
                sampleCount: point.sampleCount,
              };
            }

            const sheetFlat = flatRecords.get(sheetName) || [];
            sheetFlat.push({
              sheet: sheetName,
              metric: row.metricName,
              department,
              ageGroup: age.label,
              sex: sex.label,
              label: point.label,
              value: point.value,
              pctOfTotal: point.pctOfTotal,
            });
            flatRecords.set(sheetName, sheetFlat);
          }
        }
      }
    }
  }

  const structured = {};
  for (const row of groupedRows.values()) {
    const totals = computeRowTotals(row);
    row.totalMale = totals.total_male;
    row.totalFemale = totals.total_female;
    row.grandTotal = totals.grand_total;

    if (!structured[row.sheet]) structured[row.sheet] = {};
    if (!structured[row.sheet][row.metricKey]) structured[row.sheet][row.metricKey] = {};
    if (!structured[row.sheet][row.metricKey][row.department]) structured[row.sheet][row.metricKey][row.department] = [];

    structured[row.sheet][row.metricKey][row.department].push(row);
  }

  for (const sheetName of Object.keys(structured)) {
    for (const metricKey of Object.keys(structured[sheetName])) {
      for (const department of Object.keys(structured[sheetName][metricKey])) {
        structured[sheetName][metricKey][department].sort((left, right) =>
          String(left.label).localeCompare(String(right.label))
        );
      }
    }
  }

  return {
    sheetConfig,
    departments,
    structured,
    flatRecords,
    summaryRows: buildSummaryRows(structured),
  };
}

function numberOrDash(value) {
  return value === null || value === undefined ? '–' : value;
}

function autoFitColumns(sheet, maxColumns) {
  const columnCount = Math.max(1, maxColumns);
  for (let col = 1; col <= columnCount; col++) {
    let width = 12;
    const column = sheet.getColumn(col);
    column.eachCell({ includeEmpty: true }, (cell) => {
      const text = cell.value === null || cell.value === undefined ? '' : String(cell.value);
      width = Math.max(width, Math.min(44, text.length + 2));
    });
    column.width = width;
  }
}

function applySectionHeaderStyle(cell) {
  cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
}

function applyColumnHeaderStyle(cell) {
  cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    right: { style: 'thin', color: { argb: 'FFD9E1F2' } },
  };
}

function styleDataRow(row, index) {
  const fillColor = index % 2 === 0 ? 'FFEBF3FB' : 'FFFFFFFF';
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
}

function styleTotalRow(row) {
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      left: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      right: { style: 'thin', color: { argb: 'FFB0BEC5' } },
    };
  });
}

function applySeverityColor(cell) {
  const label = String(cell.value || '').trim().toLowerCase();
  if (label === 'mild') {
    cell.font = { ...cell.font, color: { argb: 'FF70AD47' }, bold: true };
  } else if (label === 'moderate') {
    cell.font = { ...cell.font, color: { argb: 'FFFFC000' }, bold: true };
  } else if (label === 'severe') {
    cell.font = { ...cell.font, color: { argb: 'FFFF0000' }, bold: true };
  }
}

function applyBmiColor(cell, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  if (numeric >= 30) {
    cell.font = { ...cell.font, color: { argb: 'FFFF0000' } };
    return;
  }
  if (numeric >= 25) {
    cell.font = { ...cell.font, color: { argb: 'FFFFC000' } };
    return;
  }
  if (numeric >= 18.5 && numeric < 25) {
    cell.font = { ...cell.font, color: { argb: 'FF70AD47' } };
  }
}

function rowValueForMetric(metricKey, value, unit) {
  if (value === null || value === undefined) return '–';

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '–';

  if (isPercentageMetric(metricKey, { unit })) {
    return numeric / 100;
  }

  return numeric;
}

function setValueCellFormat(cell, metricKey, unit, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '–') return;

  if (isPercentageMetric(metricKey, { unit })) {
    cell.numFmt = '0.0%';
    return;
  }

  cell.numFmt = '0.00';
}

function buildDepartmentTotals(rows = []) {
  const totals = {};
  for (const key of CELL_COLUMN_KEYS) {
    totals[key] = sumFinite(rows.map((row) => row.cells[key]));
  }

  const maleTotal = sumFinite(AGE_GROUP_COLUMNS.map((age) => totals[`${age.key}_male`]));
  const femaleTotal = sumFinite(AGE_GROUP_COLUMNS.map((age) => totals[`${age.key}_female`]));

  return {
    ...totals,
    totalMale: maleTotal,
    totalFemale: femaleTotal,
    grandTotal: maleTotal + femaleTotal,
  };
}

function sheetMetricsTotal(structured, sheetName, metricKeys = []) {
  let total = 0;
  let itemCount = 0;

  for (const metricKey of metricKeys) {
    const deptMap = structured[sheetName]?.[metricKey] || {};
    const allRows = deptMap[ALL_DEPARTMENTS_LABEL] || [];
    total += sumFinite(allRows.map((row) => row.grandTotal));
    itemCount += allRows.length;
  }

  return { total, itemCount };
}

async function generateMatrixExcelWorkbook(meta = {}, requestedDataTypes = []) {
  const data = await buildMatrixData(meta, requestedDataTypes);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MDSystem Analytics';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
  });

  summarySheet.mergeCells('A1:D1');
  const summaryTitleCell = summarySheet.getCell('A1');
  summaryTitleCell.value = 'Summary';
  summaryTitleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const summaryHeader = summarySheet.getRow(2);
  summaryHeader.values = ['Metric Name', 'Category', 'Total Count/Value', 'Number of Items'];
  summaryHeader.eachCell(applyColumnHeaderStyle);

  let summaryRowIndex = 3;
  for (const row of data.summaryRows) {
    const excelRow = summarySheet.getRow(summaryRowIndex);
    excelRow.values = [row.metricName, row.category, row.totalValue, row.itemCount];
    styleDataRow(excelRow, summaryRowIndex - 3);
    summaryRowIndex++;
  }

  summarySheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: 4 },
  };

  autoFitColumns(summarySheet, 4);

  for (const sheetConfig of data.sheetConfig) {
    const sheetName = sheetConfig.name;
    const metrics = sheetConfig.metrics;
    const vitalsSheet = isVitalsSheet(sheetName);
    const sheetColumnCount = vitalsSheet ? 20 : 14;

    const sheet = workbook.addWorksheet(sheetName.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    });

    const endColumn = sheet.getColumn(sheetColumnCount).letter;
    sheet.mergeCells(`A1:${endColumn}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = sheetName;
    titleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const kpi = sheetMetricsTotal(data.structured, sheetName, metrics);
    const deptCount = Object.keys(data.structured[sheetName] || {})
      .reduce((acc, metricKey) => {
        const departments = Object.keys(data.structured[sheetName][metricKey] || {})
          .filter((name) => name !== ALL_DEPARTMENTS_LABEL);
        return Math.max(acc, departments.length);
      }, 0);

    const kpiLabels = ['Total Value', 'Metrics', 'Departments', 'Items'];
    const kpiValues = [kpi.total, metrics.length, deptCount, kpi.itemCount];

    for (let i = 0; i < kpiLabels.length; i++) {
      const startCol = 1 + i * 3;
      const endColIndex = Math.min(startCol + 2, sheetColumnCount);
      const startLetter = sheet.getColumn(startCol).letter;
      const endLetter = sheet.getColumn(endColIndex).letter;

      sheet.mergeCells(`${startLetter}2:${endLetter}2`);
      sheet.mergeCells(`${startLetter}3:${endLetter}3`);

      const labelCell = sheet.getCell(`${startLetter}2`);
      labelCell.value = kpiLabels[i];
      labelCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1F2937' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const valueCell = sheet.getCell(`${startLetter}3`);
      valueCell.value = kpiValues[i];
      valueCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1F2937' } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F8' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.numFmt = '0.00';
    }

    let rowIndex = 5;
    let filterSet = false;

    for (const metricKey of metrics) {
      const metricRowsByDepartment = data.structured[sheetName]?.[metricKey] || {};
      const departmentNames = Object.keys(metricRowsByDepartment)
        .filter((name) => name !== ALL_DEPARTMENTS_LABEL)
        .sort((a, b) => a.localeCompare(b));
      if (metricRowsByDepartment[ALL_DEPARTMENTS_LABEL]) {
        departmentNames.push(ALL_DEPARTMENTS_LABEL);
      }

      const sectionStart = rowIndex;
      const sectionEndLetter = sheet.getColumn(sheetColumnCount).letter;
      sheet.mergeCells(`A${sectionStart}:${sectionEndLetter}${sectionStart}`);
      const metricSectionCell = sheet.getCell(`A${sectionStart}`);
      metricSectionCell.value = metricLabel(metricKey);
      applySectionHeaderStyle(metricSectionCell);
      rowIndex++;

      const groupHeader = sheet.getRow(rowIndex);
      groupHeader.values = [
        'Department',
        'Metric',
        'Label',
        'Under 17', '',
        '17-20', '',
        '21-25', '',
        '26-30', '',
        'Total',
        'Total',
        'Grand Total',
      ];

      if (vitalsSheet) {
        groupHeader.getCell(15).value = 'Min';
        groupHeader.getCell(16).value = 'Q1';
        groupHeader.getCell(17).value = 'Median';
        groupHeader.getCell(18).value = 'Q3';
        groupHeader.getCell(19).value = 'Max';
        groupHeader.getCell(20).value = 'Sample Count';
      }

      groupHeader.eachCell(applyColumnHeaderStyle);

      sheet.mergeCells(`D${rowIndex}:E${rowIndex}`);
      sheet.mergeCells(`F${rowIndex}:G${rowIndex}`);
      sheet.mergeCells(`H${rowIndex}:I${rowIndex}`);
      sheet.mergeCells(`J${rowIndex}:K${rowIndex}`);

      const subHeader = sheet.getRow(rowIndex + 1);
      subHeader.values = [
        'Department',
        'Metric',
        'Label',
        'Male', 'Female',
        'Male', 'Female',
        'Male', 'Female',
        'Male', 'Female',
        'Male',
        'Female',
        'Grand Total',
      ];

      if (vitalsSheet) {
        subHeader.getCell(15).value = 'Min';
        subHeader.getCell(16).value = 'Q1';
        subHeader.getCell(17).value = 'Median';
        subHeader.getCell(18).value = 'Q3';
        subHeader.getCell(19).value = 'Max';
        subHeader.getCell(20).value = 'Sample Count';
      }

      subHeader.eachCell((cell, colNumber) => {
        applyColumnHeaderStyle(cell);
        if ([4, 6, 8, 10, 12].includes(colNumber)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        } else if ([5, 7, 9, 11, 13].includes(colNumber)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC55A11' } };
        }
        if (colNumber === 14) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        }
      });

      if (!filterSet) {
        sheet.autoFilter = {
          from: { row: rowIndex + 1, column: 1 },
          to: { row: rowIndex + 1, column: sheetColumnCount },
        };
        filterSet = true;
      }

      rowIndex += 2;

      for (const department of departmentNames) {
        const deptRows = metricRowsByDepartment[department] || [];

        const deptBanner = sheet.getRow(rowIndex);
        deptBanner.getCell(1).value = `Department: ${department}`;
        sheet.mergeCells(`A${rowIndex}:${sectionEndLetter}${rowIndex}`);
        deptBanner.eachCell((cell) => {
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF1F2937' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
        });
        rowIndex++;

        let stripe = 0;
        for (const row of deptRows) {
          const dataRow = sheet.getRow(rowIndex);
          dataRow.getCell(1).value = department;
          dataRow.getCell(2).value = row.metricName;
          dataRow.getCell(3).value = row.label;

          let cursor = 4;
          for (const age of AGE_GROUP_COLUMNS) {
            for (const sex of SEX_COLUMNS) {
              const raw = row.cells[`${age.key}_${sex.key}`];
              const rendered = rowValueForMetric(metricKey, raw, row.unit);
              const cell = dataRow.getCell(cursor);
              cell.value = rendered === '–' ? '–' : rendered;
              setValueCellFormat(cell, metricKey, row.unit, rendered);
              if (metricKey.includes('bmi') && rendered !== '–') {
                applyBmiColor(cell, raw);
              }
              cursor++;
            }
          }

          dataRow.getCell(12).value = row.totalMale;
          dataRow.getCell(13).value = row.totalFemale;
          dataRow.getCell(14).value = row.grandTotal;

          for (const totalCol of [12, 13, 14]) {
            const cell = dataRow.getCell(totalCol);
            cell.numFmt = isPercentageMetric(metricKey, { unit: row.unit }) ? '0.0%' : '0.00';
          }

          if (vitalsSheet) {
            dataRow.getCell(15).value = numberOrDash(row.stats.min);
            dataRow.getCell(16).value = numberOrDash(row.stats.q1);
            dataRow.getCell(17).value = numberOrDash(row.stats.median);
            dataRow.getCell(18).value = numberOrDash(row.stats.q3);
            dataRow.getCell(19).value = numberOrDash(row.stats.max);
            dataRow.getCell(20).value = numberOrDash(row.stats.sampleCount);

            for (const statCol of [15, 16, 17, 18, 19, 20]) {
              const statCell = dataRow.getCell(statCol);
              if (statCell.value !== '–') {
                statCell.numFmt = '0.00';
              }
            }
          }

          applySeverityColor(dataRow.getCell(3));
          styleDataRow(dataRow, stripe);
          stripe++;
          rowIndex++;
        }

        const totals = buildDepartmentTotals(deptRows);
        const totalRow = sheet.getRow(rowIndex);
        totalRow.getCell(1).value = department;
        totalRow.getCell(2).value = metricLabel(metricKey);
        totalRow.getCell(3).value = 'TOTAL';

        let cursor = 4;
        for (const key of CELL_COLUMN_KEYS) {
          totalRow.getCell(cursor).value = totals[key];
          totalRow.getCell(cursor).numFmt = isPercentageMetric(metricKey) ? '0.0%' : '0.00';
          cursor++;
        }

        totalRow.getCell(12).value = totals.totalMale;
        totalRow.getCell(13).value = totals.totalFemale;
        totalRow.getCell(14).value = totals.grandTotal;

        if (vitalsSheet) {
          for (const statCol of [15, 16, 17, 18, 19, 20]) {
            totalRow.getCell(statCol).value = '–';
          }
        }

        styleTotalRow(totalRow);
        rowIndex += 2;
      }
    }

    autoFitColumns(sheet, sheetColumnCount);
  }

  return workbook;
}

function buildWideCsvRowsForSheet(structured = {}, sheetName, metricKeys = []) {
  const rows = [];

  for (const metricKey of metricKeys) {
    const byDepartment = structured[sheetName]?.[metricKey] || {};
    const departmentNames = Object.keys(byDepartment)
      .filter((name) => name !== ALL_DEPARTMENTS_LABEL)
      .sort((a, b) => a.localeCompare(b));
    if (byDepartment[ALL_DEPARTMENTS_LABEL]) {
      departmentNames.push(ALL_DEPARTMENTS_LABEL);
    }

    for (const department of departmentNames) {
      for (const row of byDepartment[department] || []) {
        rows.push({
          sheet: sheetName,
          metric: row.metricName,
          department,
          label: row.label,
          under17_male: row.cells.under17_male,
          under17_female: row.cells.under17_female,
          '17to20_male': row.cells['17to20_male'],
          '17to20_female': row.cells['17to20_female'],
          '21to25_male': row.cells['21to25_male'],
          '21to25_female': row.cells['21to25_female'],
          '26to30_male': row.cells['26to30_male'],
          '26to30_female': row.cells['26to30_female'],
          total_male: row.totalMale,
          total_female: row.totalFemale,
          grand_total: row.grandTotal,
        });
      }
    }
  }

  return rows;
}

async function generateMatrixCsvFiles(meta = {}, requestedDataTypes = []) {
  const data = await buildMatrixData(meta, requestedDataTypes);
  const startToken = dateToken(meta.startDate);
  const endToken = dateToken(meta.endDate);
  const files = [];

  for (const sheet of data.sheetConfig) {
    const sheetName = sheet.name;
    const slug = sheetSlug(sheetName);

    const flatRows = data.flatRecords.get(sheetName) || [];
    const flatHeader = ['sheet', 'metric', 'department', 'age_group', 'sex', 'label', 'value', 'pct_of_total'];
    const flatLines = [flatHeader.join(',')];
    for (const row of flatRows) {
      flatLines.push([
        row.sheet,
        row.metric,
        row.department,
        row.ageGroup,
        row.sex,
        row.label,
        row.value,
        row.pctOfTotal,
      ].map(csvEscape).join(','));
    }

    files.push({
      filename: `analytics_${slug}_flat_${startToken}_to_${endToken}.csv`,
      content: flatLines.join('\r\n'),
    });

    const wideRows = buildWideCsvRowsForSheet(data.structured, sheetName, sheet.metrics);
    const wideHeader = [
      'sheet',
      'metric',
      'department',
      'label',
      'under17_male',
      'under17_female',
      '17to20_male',
      '17to20_female',
      '21to25_male',
      '21to25_female',
      '26to30_male',
      '26to30_female',
      'total_male',
      'total_female',
      'grand_total',
    ];

    const wideLines = [wideHeader.join(',')];
    for (const row of wideRows) {
      wideLines.push([
        row.sheet,
        row.metric,
        row.department,
        row.label,
        row.under17_male,
        row.under17_female,
        row['17to20_male'],
        row['17to20_female'],
        row['21to25_male'],
        row['21to25_female'],
        row['26to30_male'],
        row['26to30_female'],
        row.total_male,
        row.total_female,
        row.grand_total,
      ].map(csvEscape).join(','));
    }

    files.push({
      filename: `analytics_${slug}_wide_${startToken}_to_${endToken}.csv`,
      content: wideLines.join('\r\n'),
    });
  }

  // Summary tab CSV pair for completeness.
  const summaryFlatHeader = ['sheet', 'metric', 'department', 'age_group', 'sex', 'label', 'value', 'pct_of_total'];
  const summaryFlatLines = [summaryFlatHeader.join(',')];
  for (const row of data.summaryRows) {
    summaryFlatLines.push([
      'Summary',
      row.metricName,
      ALL_DEPARTMENTS_LABEL,
      '',
      '',
      row.metricName,
      row.totalValue,
      '',
    ].map(csvEscape).join(','));
  }

  files.push({
    filename: `analytics_summary_flat_${startToken}_to_${endToken}.csv`,
    content: summaryFlatLines.join('\r\n'),
  });

  const summaryWideHeader = [
    'sheet',
    'metric',
    'department',
    'label',
    'under17_male',
    'under17_female',
    '17to20_male',
    '17to20_female',
    '21to25_male',
    '21to25_female',
    '26to30_male',
    '26to30_female',
    'total_male',
    'total_female',
    'grand_total',
  ];

  const summaryWideLines = [summaryWideHeader.join(',')];
  for (const row of data.summaryRows) {
    summaryWideLines.push([
      'Summary',
      row.metricName,
      ALL_DEPARTMENTS_LABEL,
      row.metricName,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      row.totalValue,
    ].map(csvEscape).join(','));
  }

  files.push({
    filename: `analytics_summary_wide_${startToken}_to_${endToken}.csv`,
    content: summaryWideLines.join('\r\n'),
  });

  logger.info('Matrix CSV export generated', {
    files: files.length,
    startDate: meta.startDate,
    endDate: meta.endDate,
    branch: meta.branch,
  });

  return files;
}

module.exports = {
  TAB_CONFIG,
  AGE_GROUP_COLUMNS,
  SEX_COLUMNS,
  ALL_DEPARTMENTS_LABEL,
  buildMatrixData,
  generateMatrixExcelWorkbook,
  generateMatrixCsvFiles,
};
