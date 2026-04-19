const ExcelJS = require('exceljs');
const analytics = require('./analytics-query.js');
const logger = require('../utils/logger.js');
const { EXPORT_META } = require('./analytics-export.js');

const ALL_DEPARTMENTS_LABEL = 'All Departments';
const EMPTY_CELL = '–';

const COLORS = Object.freeze({
  navy: 'FF1F4E79',
  blueHeader: 'FF2E75B6',
  maleHeader: 'FF4472C4',
  femaleHeader: 'FFC55A11',
  totalHeader: 'FF70AD47',
  rowEven: 'FFEBF3FB',
  rowOdd: 'FFFFFFFF',
  totalRow: 'FFD6E4F0',
  pillBg: 'FFEBF3FB',
  pillText: 'FF1F4E79',
  pillAllText: 'FF6B7280',
});

// Excel column width units are not pixels; these values map closely to requested px widths.
const WIDTHS = Object.freeze({
  rowLabel: 28, // ~200px
  data: 9,      // ~65px
  total: 11,    // ~75px
});

const AGE_GROUP_COLUMNS = Object.freeze([
  { key: 'under17', label: 'Under 17', filterValue: 'Under 17', aliases: ['under17', 'under-17', 'under 17'] },
  { key: '17to20', label: '17–20', filterValue: '17–20', aliases: ['17-20', '17–20', '17 to 20'] },
  { key: '21to25', label: '21–25', filterValue: '21–25', aliases: ['21-25', '21–25', '21 to 25'] },
  { key: '26to30', label: '26–30', filterValue: '26–30', aliases: ['26-30', '26–30', '26 to 30'] },
]);

const SEX_COLUMNS = Object.freeze([
  { key: 'male', label: 'Male', filterValue: 'Male' },
  { key: 'female', label: 'Female', filterValue: 'Female' },
]);

const CELL_COLUMN_KEYS = Object.freeze(
  AGE_GROUP_COLUMNS.flatMap((age) => SEX_COLUMNS.map((sex) => `${age.key}_${sex.key}`))
);

const METRICS_COLLAPSE_TO_TOTAL = new Set([
  'patients-by-sex',
  'consultations-by-sex',
  'patients-by-age-group',
  'consultations-by-age-group',
  'sex-age-group-matrix',
]);

const TAB_CONFIG = Object.freeze([
  {
    name: 'Consultations',
    metrics: [
      'consultations-by-type',
      'consultations-by-mode',
      'consultation-trends',
    ],
  },
  {
    name: 'Diagnoses',
    metrics: [
      'top-diagnoses',
      'diagnoses-by-type',
    ],
  },
  {
    name: 'Vital Signs',
    metrics: [
      'bmi-trends',
      'blood-pressure-trends',
      'vital-signs-box-plot',
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
    name: 'Clinical Data',
    metrics: [
      'immunization-coverage',
      'dental-procedures',
      'oral-findings-percentages',
    ],
  },
  {
    name: 'Lifestyle & Allergies',
    metrics: [
      'lifestyle-risks',
      'lifestyle-statistics',
      'allergy-by-type',
      'allergy-by-severity',
    ],
  },
  {
    name: 'EMR',
    metrics: [
      'female-reproductive-health',
    ],
  },
  {
    name: 'General',
    metrics: [
      'patient-credential-status',
      'patient-population-by-branch',
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
    name: 'Demographics',
    metrics: [
      'patients-by-sex',
      'consultations-by-sex',
      'top-diagnoses-by-sex',
      'patients-by-age-group',
      'consultations-by-age-group',
      'bmi-by-age-group',
      'diagnoses-by-age-group',
      'consultations-by-department',
      'consultations-by-program',
      'lifestyle-risks-by-department',
      'sex-age-group-matrix',
      'diagnoses-sex-age',
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

function sumFinite(values = []) {
  return values.reduce((sum, value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? sum + parsed : sum;
  }, 0);
}

function metricLabel(metricKey) {
  return EXPORT_META[metricKey]?.label || metricKey;
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function matrixMetricDisplayLabel(metricKey, state, titleOverride = '') {
  const base = normalizeWhitespace(titleOverride) || metricLabel(metricKey);
  let compact = base;

  // Dimension wording is redundant because rows/columns and filter pills already encode it.
  compact = compact.replace(/\s+by\s+sex\b/ig, '');
  compact = compact.replace(/\s+by\s+gender\b/ig, '');
  compact = compact.replace(/\s+by\s+age\s*group\b/ig, '');
  compact = compact.replace(/\s+by\s+sex\s*(?:&|and)\s*age\b/ig, '');
  compact = compact.replace(/\s+sex\s*[×x]\s*age\s*group\s*matrix\b/ig, ' Matrix');
  compact = compact.replace(/\s+by\s+department\b/ig, '');
  compact = compact.replace(/\s+by\s+program\b/ig, '');

  compact = normalizeWhitespace(compact);

  // Keep labels concise when a specific department is already part of section context.
  if (!state.departmentAll && /\bprogram\b/i.test(compact) && /consultations/i.test(compact)) {
    compact = compact.replace(/\bprogram\b/ig, '');
    compact = normalizeWhitespace(compact);
  }

  return compact || base;
}

function isPercentageMetric(metricKey, unit = '') {
  if (String(unit || '').toLowerCase() === 'percentage') return true;
  return metricKey === 'oral-findings-percentages';
}

function normalizeFilterValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeDepartmentFilter(value) {
  const cleaned = normalizeFilterValue(value);
  if (!cleaned || cleaned.toLowerCase() === 'all') {
    return { value: 'All', isAll: true };
  }
  return { value: cleaned, isAll: false };
}

function normalizeAgeFilter(value) {
  const cleaned = normalizeFilterValue(value);
  if (!cleaned || cleaned.toLowerCase() === 'all') {
    return { value: 'All', isAll: true, age: null };
  }

  const normalized = cleaned.toLowerCase();
  const matched = AGE_GROUP_COLUMNS.find((age) =>
    age.aliases.some((alias) => alias.toLowerCase() === normalized)
      || age.filterValue.toLowerCase() === normalized
      || age.label.toLowerCase() === normalized
  );

  if (!matched) {
    return { value: 'All', isAll: true, age: null };
  }

  return { value: matched.label, isAll: false, age: matched };
}

function normalizeSexFilter(value) {
  const cleaned = normalizeFilterValue(value);
  if (!cleaned || cleaned.toLowerCase() === 'all') {
    return { value: 'All', isAll: true, sex: null };
  }

  const normalized = cleaned.toLowerCase();
  const matched = SEX_COLUMNS.find((sex) => sex.key === normalized || sex.label.toLowerCase() === normalized);
  if (!matched) {
    return { value: 'All', isAll: true, sex: null };
  }

  return { value: matched.label, isAll: false, sex: matched };
}

function resolveFilterState(meta = {}) {
  const department = normalizeDepartmentFilter(meta.department);
  const age = normalizeAgeFilter(meta.ageGroup);
  const sex = normalizeSexFilter(meta.sex);

  return {
    department: department.value,
    departmentAll: department.isAll,
    ageLabel: age.value,
    ageAll: age.isAll,
    age: age.age,
    sexLabel: sex.value,
    sexAll: sex.isAll,
    sex: sex.sex,
    groupBy: normalizeFilterValue(meta.groupBy) || 'monthly',
    branch: normalizeFilterValue(meta.branch) || 'Both',
    startDate: normalizeFilterValue(meta.startDate),
    endDate: normalizeFilterValue(meta.endDate),
  };
}

function buildRowCellTemplate() {
  return CELL_COLUMN_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function computeRowTotals(row) {
  const totalMale = sumFinite(AGE_GROUP_COLUMNS.map((age) => row.cells[`${age.key}_male`]));
  const totalFemale = sumFinite(AGE_GROUP_COLUMNS.map((age) => row.cells[`${age.key}_female`]));
  return {
    totalMale,
    totalFemale,
    grandTotal: totalMale + totalFemale,
  };
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

function metricToSheetLookup(sheetConfig) {
  const lookup = {};
  for (const sheet of sheetConfig) {
    for (const metric of sheet.metrics) {
      lookup[metric] = sheet.name;
    }
  }
  return lookup;
}

function isAgeLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  return AGE_GROUP_COLUMNS.some((age) =>
    age.aliases.some((alias) => alias.toLowerCase() === normalized)
      || age.label.toLowerCase() === normalized
      || age.filterValue.toLowerCase() === normalized
  );
}

function isSexLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  return normalized === 'male' || normalized === 'female';
}

function dedupePoints(points = []) {
  const grouped = new Map();
  for (const point of points) {
    const key = String(point.label || '').trim() || 'TOTAL';
    if (!grouped.has(key)) {
      grouped.set(key, { ...point, label: key });
      continue;
    }

    const existing = grouped.get(key);
    const nextValue = normalizeNumeric(point.value);
    if (nextValue !== null) {
      existing.value = (normalizeNumeric(existing.value) || 0) + nextValue;
    }
    grouped.set(key, existing);
  }
  return Array.from(grouped.values());
}

function isTotalLabel(label) {
  return normalizeWhitespace(label).toLowerCase() === 'total';
}

function flattenMetricPoints(metricKey, result = {}) {
  const points = [];
  const labels = Array.isArray(result.labels) ? result.labels : [];
  const values = Array.isArray(result.values) ? result.values : [];
  const series = Array.isArray(result.series) ? result.series : [];
  const boxPlot = Array.isArray(result.boxPlot) ? result.boxPlot : [];

  if (boxPlot.length > 0) {
    for (const item of boxPlot) {
      const median = normalizeNumeric(item?.median);
      if (median === null) continue;
      points.push({
        label: item?.name || 'TOTAL',
        value: median,
        pctOfTotal: '',
        unit: result.unit || '',
      });
    }
    return dedupePoints(points);
  }

  if (series.length > 0) {
    if (labels.length === 1 && series.length > 1) {
      // One representation only: use series labels as row labels.
      for (const entry of series) {
        const value = normalizeNumeric(Array.isArray(entry.values) ? entry.values[0] : undefined);
        if (value === null) continue;
        points.push({
          label: entry.name || 'TOTAL',
          value,
          pctOfTotal: '',
          unit: result.unit || '',
        });
      }
      return dedupePoints(points);
    }

    const rowCount = Math.max(
      labels.length,
      ...series.map((entry) => (Array.isArray(entry.values) ? entry.values.length : 0)),
      0
    );

    for (let i = 0; i < rowCount; i++) {
      const label = labels[i] || `Item ${i + 1}`;
      const value = series.length === 1
        ? normalizeNumeric(series[0].values?.[i])
        : sumFinite(series.map((entry) => normalizeNumeric(entry.values?.[i])));

      if (value === null) continue;
      points.push({
        label,
        value,
        pctOfTotal: '',
        unit: result.unit || '',
      });
    }

    return dedupePoints(points);
  }

  const rowCount = Math.max(labels.length, values.length);
  for (let i = 0; i < rowCount; i++) {
    const value = normalizeNumeric(values[i]);
    if (value === null) continue;
    points.push({
      label: labels[i] || `Item ${i + 1}`,
      value,
      pctOfTotal: '',
      unit: result.unit || '',
    });
  }

  if (points.length === 0) {
    const fallback = normalizeNumeric(result.total);
    if (fallback !== null) {
      points.push({
        label: 'TOTAL',
        value: fallback,
        pctOfTotal: '',
        unit: result.unit || '',
      });
    }
  }

  const collapse = METRICS_COLLAPSE_TO_TOTAL.has(metricKey)
    || (points.length > 0 && points.every((point) => isAgeLabel(point.label) || isSexLabel(point.label)));

  if (!collapse) {
    return dedupePoints(points);
  }

  const totalValue = normalizeNumeric(result.total);
  if (totalValue === null) return [];
  return [{ label: 'TOTAL', value: totalValue, pctOfTotal: '', unit: result.unit || '' }];
}

function buildSummaryRows(structured, sheetConfig, state) {
  const grouped = new Map();
  const departmentKey = state.departmentAll ? ALL_DEPARTMENTS_LABEL : state.department;

  for (const sheet of sheetConfig) {
    for (const metricKey of sheet.metrics) {
      const scopedRows = structured[sheet.name]?.[metricKey]?.[departmentKey] || [];
      const rowLabel = matrixMetricDisplayLabel(metricKey, state);
      const key = `${sheet.name}::${rowLabel}`;
      const existing = grouped.get(key) || {
        rowLabel,
        category: sheet.name,
        totalValue: 0,
        itemCount: 0,
      };
      existing.totalValue += sumFinite(scopedRows.map((row) => row.grandTotal));
      existing.itemCount += scopedRows.length;
      grouped.set(key, existing);
    }
  }

  return Array.from(grouped.values());
}

function dateToken(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function sheetSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function orderedDepartments(metricRowsByDepartment, state) {
  if (!state.departmentAll) return [state.department];

  const names = Object.keys(metricRowsByDepartment || {})
    .filter((name) => name !== ALL_DEPARTMENTS_LABEL)
    .sort((a, b) => a.localeCompare(b));

  if (metricRowsByDepartment?.[ALL_DEPARTMENTS_LABEL]) {
    names.push(ALL_DEPARTMENTS_LABEL);
  }

  return names;
}

async function buildMatrixData(meta = {}, requestedDataTypes = []) {
  const state = resolveFilterState(meta);
  const exportFilterParameters = JSON.stringify({
    branch: state.branch,
    startDate: state.startDate,
    endDate: state.endDate,
    groupBy: state.groupBy,
    department: state.departmentAll ? 'All' : state.department,
    ageGroup: state.ageAll ? 'All' : state.ageLabel,
    sex: state.sexAll ? 'All' : state.sexLabel,
  });
  const sheetConfig = activeSheetConfig(requestedDataTypes);
  const metricLookup = metricToSheetLookup(sheetConfig);
  const metrics = Array.from(new Set(sheetConfig.flatMap((sheet) => sheet.metrics)));

  const filterOptions = await analytics.getFilterOptions();
  const departmentsFromDb = Array.isArray(filterOptions.departments)
    ? filterOptions.departments.filter(Boolean)
    : [];

  const scopedDepartments = state.departmentAll
    ? [...departmentsFromDb, ALL_DEPARTMENTS_LABEL]
    : [state.department];
  const scopedAges = state.ageAll ? AGE_GROUP_COLUMNS : [state.age].filter(Boolean);
  const scopedSexes = state.sexAll ? SEX_COLUMNS : [state.sex].filter(Boolean);

  const groupedRows = new Map();
  const flatRecords = new Map();
  for (const sheet of sheetConfig) {
    flatRecords.set(sheet.name, []);
  }

  for (const department of scopedDepartments) {
    for (const age of scopedAges) {
      for (const sex of scopedSexes) {
        const options = {
          sex: sex.filterValue,
          ageGroup: age.filterValue,
        };
        if (state.groupBy) options.groupBy = state.groupBy;
        if (department !== ALL_DEPARTMENTS_LABEL) {
          options.department = department;
        }

        const batch = await analytics.executeBatchQueries(
          metrics,
          state.branch,
          state.startDate,
          state.endDate,
          options
        );

        for (const metricKey of metrics) {
          const wrapped = batch[metricKey];
          if (!wrapped || !wrapped.success || !wrapped.data) continue;

          const sheetName = metricLookup[metricKey];
          if (!sheetName) continue;

          const chartContext = wrapped.data.chartContext || {};
          const chartTitle = chartContext.title || metricLabel(metricKey);
          const datasetContext = chartContext.datasetContext || chartContext.key || metricKey;
          const metricName = matrixMetricDisplayLabel(metricKey, state, chartTitle);

          const points = flattenMetricPoints(metricKey, wrapped.data);
          if (points.length === 0) continue;

          const columnKey = `${age.key}_${sex.key}`;

          for (const point of points) {
            const rowKey = `${sheetName}::${metricKey}::${department}::${point.label}`;
            let row = groupedRows.get(rowKey);

            if (!row) {
              row = {
                sheet: sheetName,
                metricKey,
                metricName,
                chartTitle,
                datasetContext,
                filterParameters: exportFilterParameters,
                department,
                label: point.label,
                unit: point.unit || '',
                cells: buildRowCellTemplate(),
              };
              groupedRows.set(rowKey, row);
            }

            const existing = normalizeNumeric(row.cells[columnKey]);
            const incoming = normalizeNumeric(point.value);
            if (incoming !== null) {
              row.cells[columnKey] = existing === null ? incoming : existing + incoming;
            }

            const sheetFlat = flatRecords.get(sheetName) || [];
            sheetFlat.push({
              sheet: sheetName,
              metric: row.metricName,
              chartTitle: row.chartTitle,
              datasetContext: row.datasetContext,
              filterParameters: row.filterParameters,
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
    row.totalMale = totals.totalMale;
    row.totalFemale = totals.totalFemale;
    row.grandTotal = totals.grandTotal;

    if (!structured[row.sheet]) structured[row.sheet] = {};
    if (!structured[row.sheet][row.metricKey]) structured[row.sheet][row.metricKey] = {};
    if (!structured[row.sheet][row.metricKey][row.department]) structured[row.sheet][row.metricKey][row.department] = [];
    structured[row.sheet][row.metricKey][row.department].push(row);
  }

  for (const [sheetName, metricMap] of Object.entries(structured)) {
    for (const [metricKey, departmentMap] of Object.entries(metricMap)) {
      for (const [department, rows] of Object.entries(departmentMap)) {
        structured[sheetName][metricKey][department] = rows
          .slice()
          .sort((left, right) => String(left.label).localeCompare(String(right.label)));
      }
    }
  }

  return {
    state,
    sheetConfig,
    structured,
    flatRecords,
    summaryRows: buildSummaryRows(structured, sheetConfig, state),
    departments: departmentsFromDb,
  };
}

function buildColumnLayout(state) {
  const compact = !state.ageAll && !state.sexAll;

  if (compact) {
    return {
      mode: 'compact',
      headerRows: 1,
      columns: [
        { key: 'label', type: 'label', title: 'Row Label', width: WIDTHS.rowLabel },
        { key: 'count', type: 'count', title: 'Count', width: WIDTHS.total },
        { key: 'pct', type: 'pct', title: '% of Total', width: WIDTHS.total },
      ],
      dataColumns: [],
      totalColumns: [],
    };
  }

  const visibleAges = state.ageAll ? AGE_GROUP_COLUMNS : [state.age].filter(Boolean);
  const visibleSexes = state.sexAll ? SEX_COLUMNS : [state.sex].filter(Boolean);

  const columns = [{ key: 'label', type: 'label', title: 'Row Label', width: WIDTHS.rowLabel }];
  const dataColumns = [];

  if (state.ageAll && state.sexAll) {
    for (const age of visibleAges) {
      for (const sex of visibleSexes) {
        dataColumns.push({
          key: `${age.key}_${sex.key}`,
          type: 'data',
          age,
          sex,
          title: `${age.key}_${sex.key}`,
          width: WIDTHS.data,
        });
      }
    }
  } else if (state.ageAll && !state.sexAll) {
    for (const age of visibleAges) {
      dataColumns.push({
        key: `${age.key}_${state.sex.key}`,
        type: 'data',
        age,
        sex: state.sex,
        title: `${age.key}_${state.sex.key}`,
        width: WIDTHS.data,
      });
    }
  } else if (!state.ageAll && state.sexAll) {
    for (const sex of visibleSexes) {
      dataColumns.push({
        key: `${state.age.key}_${sex.key}`,
        type: 'data',
        age: state.age,
        sex,
        title: `${state.age.key}_${sex.key}`,
        width: WIDTHS.data,
      });
    }
  }

  columns.push(...dataColumns);

  const totalColumns = [];
  if (state.sexAll) {
    if (state.ageAll) {
      totalColumns.push(
        { key: 'totalMale', type: 'total', title: 'Total Male', width: WIDTHS.total },
        { key: 'totalFemale', type: 'total', title: 'Total Female', width: WIDTHS.total },
        { key: 'grandTotal', type: 'total', title: 'Grand Total', width: WIDTHS.total, isGrand: true }
      );
    } else {
      totalColumns.push({ key: 'grandTotal', type: 'total', title: 'Total', width: WIDTHS.total, isGrand: true });
    }
  } else {
    totalColumns.push({
      key: state.sex.key === 'male' ? 'totalMale' : 'totalFemale',
      type: 'total',
      title: state.sex.key === 'male' ? 'Total Male' : 'Total Female',
      width: WIDTHS.total,
    });
  }

  columns.push(...totalColumns);

  return {
    mode: 'matrix',
    headerRows: 1,
    columns,
    dataColumns,
    totalColumns,
  };
}

function applyHeaderCellStyle(cell, color, { center = true, bold = true } = {}) {
  cell.font = {
    name: 'Arial',
    bold,
    size: 10,
    color: { argb: 'FFFFFFFF' },
  };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.alignment = {
    horizontal: center ? 'center' : 'left',
    vertical: 'middle',
    wrapText: false,
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
    right: { style: 'thin', color: { argb: 'FFD9E1F2' } },
  };
}

function styleDataRow(row, index) {
  const fill = index % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRow } };
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      left: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      right: { style: 'thin', color: { argb: 'FFB0BEC5' } },
    };
  });
}

function styleSectionRow(sheet, rowIndex, text, columnCount) {
  const endCol = sheet.getColumn(columnCount).letter;
  sheet.mergeCells(`A${rowIndex}:${endCol}${rowIndex}`);
  const cell = sheet.getCell(`A${rowIndex}`);
  cell.value = text;
  cell.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
}

function applySeverityColor(cell) {
  const normalized = String(cell.value || '').trim().toLowerCase();
  if (normalized === 'mild') {
    cell.font = { ...(cell.font || {}), color: { argb: 'FF70AD47' }, bold: true };
  } else if (normalized === 'moderate') {
    cell.font = { ...(cell.font || {}), color: { argb: 'FFFFC000' }, bold: true };
  } else if (normalized === 'severe') {
    cell.font = { ...(cell.font || {}), color: { argb: 'FFFF0000' }, bold: true };
  }
}

function applyBmiColor(cell, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return;
  if (value >= 30) {
    cell.font = { ...(cell.font || {}), color: { argb: 'FFFF0000' } };
  } else if (value >= 25) {
    cell.font = { ...(cell.font || {}), color: { argb: 'FFFFC000' } };
  } else if (value >= 18.5) {
    cell.font = { ...(cell.font || {}), color: { argb: 'FF70AD47' } };
  }
}

function metricValueForCell(metricKey, unit, value) {
  const parsed = normalizeNumeric(value);
  if (parsed === null) return EMPTY_CELL;

  if (isPercentageMetric(metricKey, unit)) {
    return parsed / 100;
  }
  return parsed;
}

function applyMetricNumberFormat(cell, metricKey, unit, rawValue) {
  if (rawValue === EMPTY_CELL || rawValue === null || rawValue === undefined) return;

  if (isPercentageMetric(metricKey, unit)) {
    cell.numFmt = '0.0%';
    return;
  }

  const numeric = Number(rawValue);
  if (Number.isInteger(numeric)) {
    cell.numFmt = '0';
    return;
  }

  cell.numFmt = '0.00';
}

function fixedColumnWidths(sheet, layout) {
  layout.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });
}

function buildColumnSegments(columnCount, requestedParts) {
  const safeColumns = Math.max(1, Number(columnCount) || 1);
  const safeParts = Math.max(1, Math.min(Number(requestedParts) || 1, safeColumns));
  const segments = [];

  for (let i = 0; i < safeParts; i++) {
    const start = Math.floor((i * safeColumns) / safeParts) + 1;
    const end = Math.max(start, Math.floor(((i + 1) * safeColumns) / safeParts));
    segments.push({ start, end });
  }

  return segments;
}

function renderFilterPills(sheet, rowIndex, state, columnCount) {
  const pills = [
    { text: `Dept: ${state.departmentAll ? 'All' : state.department}`, active: !state.departmentAll },
    { text: `Age: ${state.ageAll ? 'All' : state.ageLabel}`, active: !state.ageAll },
    { text: `Sex: ${state.sexAll ? 'All' : state.sexLabel}`, active: !state.sexAll },
  ];

  const segments = buildColumnSegments(columnCount, pills.length);
  const visiblePills = pills.slice(0, segments.length);

  for (let i = 0; i < visiblePills.length; i++) {
    const { start, end } = segments[i];
    const startLetter = sheet.getColumn(start).letter;
    const endLetter = sheet.getColumn(end).letter;
    if (end > start) {
      sheet.mergeCells(`${startLetter}${rowIndex}:${endLetter}${rowIndex}`);
    }
    const cell = sheet.getCell(`${startLetter}${rowIndex}`);
    cell.value = visiblePills[i].text;
    cell.font = {
      name: 'Arial',
      bold: true,
      size: 10,
      color: { argb: visiblePills[i].active ? COLORS.pillText : COLORS.pillAllText },
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.pillBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

function renderKpiCards(sheet, rowIndex, columnCount, cards) {
  const safeCards = cards.slice(0, 4);
  const segments = buildColumnSegments(columnCount, safeCards.length);
  const visibleCards = safeCards.slice(0, segments.length);

  for (let i = 0; i < visibleCards.length; i++) {
    const { start, end } = segments[i];
    const startLetter = sheet.getColumn(start).letter;
    const endLetter = sheet.getColumn(end).letter;

    if (end > start) {
      sheet.mergeCells(`${startLetter}${rowIndex}:${endLetter}${rowIndex}`);
      sheet.mergeCells(`${startLetter}${rowIndex + 1}:${endLetter}${rowIndex + 1}`);
    }

    const titleCell = sheet.getCell(`${startLetter}${rowIndex}`);
    titleCell.value = visibleCards[i].label;
    titleCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1F2937' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const valueCell = sheet.getCell(`${startLetter}${rowIndex + 1}`);
    valueCell.value = visibleCards[i].value;
    valueCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1F2937' } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F8' } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const numericValue = Number(visibleCards[i].value);
    if (Number.isFinite(numericValue)) {
      valueCell.numFmt = Number.isInteger(numericValue) ? '0' : '0.00';
    }
  }
}

function renderMatrixHeader(sheet, startRow, layout, state) {
  const columns = layout.columns;

  if (layout.mode === 'compact') {
    const row = sheet.getRow(startRow);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.value = column.title;
      applyHeaderCellStyle(cell, COLORS.blueHeader);
    });
    return { nextRow: startRow + 1, filterRow: startRow };
  }

  if (layout.headerRows === 1) {
    const row = sheet.getRow(startRow);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.value = column.title;

      if (column.type === 'data') {
        const color = column.sex.key === 'male' ? COLORS.maleHeader : COLORS.femaleHeader;
        applyHeaderCellStyle(cell, color);
      } else if (column.type === 'total') {
        applyHeaderCellStyle(cell, COLORS.totalHeader);
      } else {
        applyHeaderCellStyle(cell, COLORS.blueHeader);
      }
    });

    return { nextRow: startRow + 1, filterRow: startRow };
  }

  const topRow = sheet.getRow(startRow);
  const subRow = sheet.getRow(startRow + 1);

  // Row label header
  sheet.mergeCells(`A${startRow}:A${startRow + 1}`);
  const rowLabelCell = topRow.getCell(1);
  rowLabelCell.value = 'Row Label';
  applyHeaderCellStyle(rowLabelCell, COLORS.blueHeader);

  let cursor = 2;
  for (const age of AGE_GROUP_COLUMNS) {
    const startCol = cursor;
    const endCol = cursor + 1;
    const startLetter = sheet.getColumn(startCol).letter;
    const endLetter = sheet.getColumn(endCol).letter;

    sheet.mergeCells(`${startLetter}${startRow}:${endLetter}${startRow}`);
    const ageCell = topRow.getCell(startCol);
    ageCell.value = age.label;
    applyHeaderCellStyle(ageCell, COLORS.blueHeader);

    const maleCell = subRow.getCell(startCol);
    maleCell.value = 'Male';
    applyHeaderCellStyle(maleCell, COLORS.maleHeader);

    const femaleCell = subRow.getCell(endCol);
    femaleCell.value = 'Female';
    applyHeaderCellStyle(femaleCell, COLORS.femaleHeader);

    cursor += 2;
  }

  // Totals
  for (const total of layout.totalColumns) {
    const col = columns.findIndex((column) => column.key === total.key) + 1;
    const letter = sheet.getColumn(col).letter;
    sheet.mergeCells(`${letter}${startRow}:${letter}${startRow + 1}`);
    const totalCell = topRow.getCell(col);
    totalCell.value = total.title;
    applyHeaderCellStyle(totalCell, COLORS.totalHeader);
  }

  return { nextRow: startRow + 2, filterRow: startRow + 1 };
}

function readValueFromRowByLayout(row, column, state) {
  if (column.type === 'data') {
    return row.cells[column.key];
  }

  if (column.type === 'total') {
    if (column.key === 'totalMale') return row.totalMale;
    if (column.key === 'totalFemale') return row.totalFemale;
    return row.grandTotal;
  }

  if (column.type === 'count') {
    const key = `${state.age.key}_${state.sex.key}`;
    return row.cells[key];
  }

  return null;
}

function buildVisibleTotals(rows, layout, state) {
  if (layout.mode === 'compact') {
    const totalCount = sumFinite(rows.map((row) => readValueFromRowByLayout(row, { type: 'count' }, state)));
    return { count: totalCount };
  }

  const totals = {};
  for (const column of layout.columns) {
    if (column.type === 'label') continue;
    const values = rows.map((row) => readValueFromRowByLayout(row, column, state));
    totals[column.key] = sumFinite(values);
  }
  return totals;
}

function metricSectionTitle(metricKey, state) {
  const base = normalizeWhitespace(
    matrixMetricDisplayLabel(metricKey, state)
      .replace(/\s+by\s+sex\b/ig, '')
      .replace(/\s+by\s+gender\b/ig, '')
      .replace(/\s+by\s+age\s*group\b/ig, '')
      .replace(/\s+by\s+department\b/ig, '')
      .replace(/\s+by\s+program\b/ig, '')
  );

  if (!state.departmentAll && !state.ageAll && !state.sexAll) {
    return `${base} — ${state.department} · ${state.ageLabel} · ${state.sexLabel}`;
  }
  if (!state.departmentAll && state.ageAll && state.sexAll) {
    return `${base} — ${state.department}`;
  }
  if (state.departmentAll && !state.ageAll && state.sexAll) {
    return `${base} — Age ${state.ageLabel}`;
  }
  if (state.departmentAll && state.ageAll && !state.sexAll) {
    return `${base} — ${state.sexLabel}`;
  }
  if (!state.departmentAll && !state.ageAll && state.sexAll) {
    return `${base} — ${state.department} · Age ${state.ageLabel}`;
  }
  if (!state.departmentAll && state.ageAll && !state.sexAll) {
    return `${base} — ${state.department} · ${state.sexLabel}`;
  }
  if (state.departmentAll && !state.ageAll && !state.sexAll) {
    return `${base} — ${state.ageLabel} · ${state.sexLabel}`;
  }
  return base;
}

function sheetTotals(structured, sheetName, metricKeys, state) {
  const bucket = state.departmentAll ? ALL_DEPARTMENTS_LABEL : state.department;
  let total = 0;
  let itemCount = 0;

  for (const metricKey of metricKeys) {
    const rows = structured[sheetName]?.[metricKey]?.[bucket] || [];
    total += sumFinite(rows.map((row) => row.grandTotal));
    itemCount += rows.length;
  }

  return { total, itemCount };
}

function writeLabelCell(cell, label) {
  const text = String(label || '').trim() || 'TOTAL';
  cell.value = text;
  cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  if (text.length > 30) {
    cell.note = text;
  }
}

function renderSheetTableBlocks(sheet, sheetName, metrics, structured, state, layout, startRow) {
  let rowIndex = startRow;

  for (const metricKey of metrics) {
    const metricRowsByDepartment = structured[sheetName]?.[metricKey] || {};
    const departments = orderedDepartments(metricRowsByDepartment, state);
    const departmentBlocks = departments
      .map((department) => {
        const rows = metricRowsByDepartment[department] || [];
        const detailRows = rows.filter((row) => {
          const normalized = normalizeWhitespace(row.label).toLowerCase();
          if (!normalized) return false;
          return normalized !== 'total';
        });
        const rowsForTotals = detailRows.length > 0 ? detailRows : rows;
        return {
          department,
          detailRows,
          rowsForTotals,
        };
      })
      // Do not render low-signal sections that have no detail rows.
      .filter((block) => block.detailRows.length > 0);

    if (departmentBlocks.length === 0) continue;

    styleSectionRow(sheet, rowIndex, metricSectionTitle(metricKey, state), layout.columns.length);
    rowIndex++;

    const header = renderMatrixHeader(sheet, rowIndex, layout, state);
    rowIndex = header.nextRow;

    sheet.autoFilter = {
      from: { row: header.filterRow, column: 1 },
      to: { row: header.filterRow, column: layout.columns.length },
    };

    for (const block of departmentBlocks) {
      const department = block.department;
      const rowsForBody = block.detailRows;
      const rowsForTotals = block.rowsForTotals;

      if (state.departmentAll) {
        styleSectionRow(sheet, rowIndex, department, layout.columns.length);
        rowIndex++;
      }

      const compactSectionTotal = layout.mode === 'compact'
        ? sumFinite(rowsForTotals.map((row) => readValueFromRowByLayout(row, { type: 'count' }, state)))
        : 0;

      let stripe = 0;
      for (const row of rowsForBody) {
        const excelRow = sheet.getRow(rowIndex);

        const labelCell = excelRow.getCell(1);
        writeLabelCell(labelCell, row.label);

        for (let colIdx = 2; colIdx <= layout.columns.length; colIdx++) {
          const column = layout.columns[colIdx - 1];
          const cell = excelRow.getCell(colIdx);

          if (layout.mode === 'compact' && column.type === 'pct') {
            const countValue = normalizeNumeric(readValueFromRowByLayout(row, { type: 'count' }, state));
            if (countValue === null || compactSectionTotal <= 0) {
              cell.value = EMPTY_CELL;
            } else {
              cell.value = countValue / compactSectionTotal;
              cell.numFmt = '0.0%';
            }
            continue;
          }

          const raw = readValueFromRowByLayout(row, column, state);
          const converted = metricValueForCell(metricKey, row.unit, raw);
          cell.value = converted;
          applyMetricNumberFormat(cell, metricKey, row.unit, converted);

          if (metricKey.includes('bmi') && converted !== EMPTY_CELL) {
            applyBmiColor(cell, raw);
          }
        }

        styleDataRow(excelRow, stripe);
        applySeverityColor(labelCell);
        stripe++;
        rowIndex++;
      }

      const totals = buildVisibleTotals(rowsForTotals, layout, state);
      const totalRow = sheet.getRow(rowIndex);
      writeLabelCell(totalRow.getCell(1), 'TOTAL');

      for (let colIdx = 2; colIdx <= layout.columns.length; colIdx++) {
        const column = layout.columns[colIdx - 1];
        const cell = totalRow.getCell(colIdx);

        if (layout.mode === 'compact' && column.type === 'pct') {
          if (totals.count > 0) {
            cell.value = 1;
            cell.numFmt = '0.0%';
          } else {
            cell.value = EMPTY_CELL;
          }
          continue;
        }

        const raw = layout.mode === 'compact' ? totals.count : totals[column.key];
        const converted = metricValueForCell(metricKey, '', raw);
        cell.value = converted;
        applyMetricNumberFormat(cell, metricKey, '', converted);
      }

      styleTotalRow(totalRow);
      rowIndex += 2;
    }
  }

  return rowIndex;
}

async function generateMatrixExcelWorkbook(meta = {}, requestedDataTypes = []) {
  const data = await buildMatrixData(meta, requestedDataTypes);
  const state = data.state;
  const layout = buildColumnLayout(state);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MDSystem Analytics';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
  });

  summarySheet.mergeCells('A1:D1');
  const title = summarySheet.getCell('A1');
  title.value = 'Summary';
  title.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  title.alignment = { horizontal: 'left', vertical: 'middle' };

  renderFilterPills(summarySheet, 2, state, 4);

  const summaryKpis = [
    { label: 'Metrics', value: data.summaryRows.length },
    { label: 'Categories', value: data.sheetConfig.length },
    { label: 'Total Value', value: sumFinite(data.summaryRows.map((row) => row.totalValue)) },
    { label: 'Items', value: sumFinite(data.summaryRows.map((row) => row.itemCount)) },
  ];
  renderKpiCards(summarySheet, 3, 4, summaryKpis);

  const summaryHeader = summarySheet.getRow(6);
  summaryHeader.values = ['Row Label', 'Category', 'Total Count/Value', 'Number of Items'];
  summaryHeader.eachCell((cell) => applyHeaderCellStyle(cell, COLORS.blueHeader));

  let summaryRowIndex = 7;
  for (const row of data.summaryRows) {
    const excelRow = summarySheet.getRow(summaryRowIndex);
    excelRow.getCell(1).value = row.rowLabel;
    excelRow.getCell(2).value = row.category;
    excelRow.getCell(3).value = row.totalValue;
    excelRow.getCell(4).value = row.itemCount;
    excelRow.getCell(3).numFmt = Number.isInteger(Number(row.totalValue)) ? '0' : '0.00';
    excelRow.getCell(4).numFmt = '0';
    styleDataRow(excelRow, summaryRowIndex - 7);
    summaryRowIndex++;
  }

  summarySheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: 4 },
  };
  summarySheet.getColumn(1).width = WIDTHS.rowLabel;
  summarySheet.getColumn(2).width = 18;
  summarySheet.getColumn(3).width = WIDTHS.total;
  summarySheet.getColumn(4).width = WIDTHS.total;

  for (const sheetConfig of data.sheetConfig) {
    const sheetName = sheetConfig.name;
    const sheet = workbook.addWorksheet(sheetName.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    });

    const colCount = layout.columns.length;
    fixedColumnWidths(sheet, layout);

    const endCol = sheet.getColumn(colCount).letter;
    sheet.mergeCells(`A1:${endCol}1`);
    const sheetTitle = sheet.getCell('A1');
    sheetTitle.value = sheetName;
    sheetTitle.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sheetTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    sheetTitle.alignment = { horizontal: 'left', vertical: 'middle' };

    renderFilterPills(sheet, 2, state, colCount);

    const totals = sheetTotals(data.structured, sheetName, sheetConfig.metrics, state);
    const departmentKpi = state.departmentAll
      ? { label: 'Departments', value: data.departments.length }
      : { label: 'Department', value: state.department };
    const kpis = [
      { label: 'Total Value', value: totals.total },
      { label: 'Metrics', value: sheetConfig.metrics.length },
      departmentKpi,
      { label: 'Items', value: totals.itemCount },
    ];
    renderKpiCards(sheet, 3, colCount, kpis);

    renderSheetTableBlocks(
      sheet,
      sheetName,
      sheetConfig.metrics,
      data.structured,
      state,
      layout,
      6
    );
  }

  return workbook;
}

function buildWideColumnOrder(layout) {
  if (layout.mode === 'compact') {
    return ['count', 'pct_of_total'];
  }

  return layout.columns
    .filter((column) => column.type !== 'label')
    .map((column) => {
      if (column.key === 'totalMale') return 'total_male';
      if (column.key === 'totalFemale') return 'total_female';
      if (column.key === 'grandTotal') return 'grand_total';
      return column.key;
    });
}

function wideValueFromRow(row, key, state) {
  if (key === 'count') {
    return row.cells[`${state.age.key}_${state.sex.key}`];
  }
  if (key === 'pct_of_total') return '';

  if (key === 'total_male') return row.totalMale;
  if (key === 'total_female') return row.totalFemale;
  if (key === 'grand_total') return row.grandTotal;

  return row.cells[key];
}

function buildWideCsvRowsForSheet(structured, sheetName, metricKeys, state, layout) {
  const rows = [];

  for (const metricKey of metricKeys) {
    const byDepartment = structured[sheetName]?.[metricKey] || {};
    const departments = orderedDepartments(byDepartment, state);

    for (const department of departments) {
      for (const row of byDepartment[department] || []) {
        const csvRow = {
          sheet: sheetName,
          metric: row.metricName,
          chart_title: row.chartTitle,
          dataset_context: row.datasetContext,
          filter_parameters: row.filterParameters,
          department,
          label: row.label,
        };

        for (const key of buildWideColumnOrder(layout)) {
          csvRow[key] = wideValueFromRow(row, key, state);
        }

        rows.push(csvRow);
      }
    }
  }

  return rows;
}

async function generateMatrixCsvFiles(meta = {}, requestedDataTypes = []) {
  const data = await buildMatrixData(meta, requestedDataTypes);
  const state = data.state;
  const layout = buildColumnLayout(state);
  const startToken = dateToken(state.startDate);
  const endToken = dateToken(state.endDate);
  const filterParameters = JSON.stringify({
    branch: state.branch,
    startDate: state.startDate,
    endDate: state.endDate,
    groupBy: state.groupBy,
    department: state.departmentAll ? 'All' : state.department,
    ageGroup: state.ageAll ? 'All' : state.ageLabel,
    sex: state.sexAll ? 'All' : state.sexLabel,
  });
  const files = [];

  for (const sheet of data.sheetConfig) {
    const sheetName = sheet.name;
    const slug = sheetSlug(sheetName);

    const flatRows = data.flatRecords.get(sheetName) || [];
    const flatHeader = ['sheet', 'metric', 'chart_title', 'dataset_context', 'filter_parameters', 'department', 'age_group', 'sex', 'label', 'value', 'pct_of_total'];
    const flatLines = [flatHeader.join(',')];
    for (const row of flatRows) {
      flatLines.push([
        row.sheet,
        row.metric,
        row.chartTitle,
        row.datasetContext,
        row.filterParameters,
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

    const wideRows = buildWideCsvRowsForSheet(data.structured, sheetName, sheet.metrics, state, layout);
    const wideColumns = ['sheet', 'metric', 'chart_title', 'dataset_context', 'filter_parameters', 'department', 'label', ...buildWideColumnOrder(layout)];
    const wideLines = [wideColumns.join(',')];
    for (const row of wideRows) {
      wideLines.push(wideColumns.map((column) => csvEscape(row[column])).join(','));
    }

    files.push({
      filename: `analytics_${slug}_wide_${startToken}_to_${endToken}.csv`,
      content: wideLines.join('\r\n'),
    });
  }

  const summaryFlatHeader = ['sheet', 'metric', 'chart_title', 'dataset_context', 'filter_parameters', 'department', 'age_group', 'sex', 'label', 'value', 'pct_of_total'];
  const summaryFlatLines = [summaryFlatHeader.join(',')];
  for (const row of data.summaryRows) {
    summaryFlatLines.push([
      'Summary',
      row.rowLabel,
      row.rowLabel,
      'summary',
      filterParameters,
      state.departmentAll ? ALL_DEPARTMENTS_LABEL : state.department,
      state.ageAll ? 'All' : state.ageLabel,
      state.sexAll ? 'All' : state.sexLabel,
      row.rowLabel,
      row.totalValue,
      '',
    ].map(csvEscape).join(','));
  }

  files.push({
    filename: `analytics_summary_flat_${startToken}_to_${endToken}.csv`,
    content: summaryFlatLines.join('\r\n'),
  });

  const summaryWideColumns = ['sheet', 'metric', 'chart_title', 'dataset_context', 'filter_parameters', 'department', 'label', 'grand_total'];
  const summaryWideLines = [summaryWideColumns.join(',')];
  for (const row of data.summaryRows) {
    summaryWideLines.push([
      'Summary',
      row.rowLabel,
      row.rowLabel,
      'summary',
      filterParameters,
      state.departmentAll ? ALL_DEPARTMENTS_LABEL : state.department,
      row.rowLabel,
      row.totalValue,
    ].map(csvEscape).join(','));
  }

  files.push({
    filename: `analytics_summary_wide_${startToken}_to_${endToken}.csv`,
    content: summaryWideLines.join('\r\n'),
  });

  logger.info('Matrix CSV export generated', {
    files: files.length,
    startDate: state.startDate,
    endDate: state.endDate,
    branch: state.branch,
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
