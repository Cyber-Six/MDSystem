const db = require('../config/db.js');
const logger = require('../utils/logger.js');
const redis = require('../config/redis.js');

/**
 * Analytics Query Module
 *
 * Add your query functions here. Each function should:
 * - Accept (branch, startDate, endDate) parameters
 * - Return { labels: string[], values: number[], total: number }
 *
 * Register queries in QUERY_HANDLERS below.
 */

// ============================================================
// CACHE CONFIGURATION
// ============================================================

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'analytics:';

function getCacheKey(dataType, branch, startDate, endDate) {
  return `${CACHE_PREFIX}${dataType}:${branch}:${startDate}:${endDate}`;
}

async function getCachedResult(key) {
  try {
    const cached = await redis.getKey(key);
    if (cached) {
      logger.debug(`Analytics cache HIT: ${key}`);
      return JSON.parse(cached);
    }
  } catch {
    // Cache miss or Redis unavailable — proceed without cache
  }
  return null;
}

async function setCachedResult(key, data) {
  try {
    await redis.setKey(key, JSON.stringify(data), CACHE_TTL);
  } catch {
    // Redis unavailable — silently skip caching
  }
}

// ============================================================
// PARAMETERIZED BRANCH FILTER HELPER
// ============================================================

/**
 * Builds a parameterized branch filter and returns the clause + params.
 * @param {string} branch - 'Both', 'Manila', or 'QuezonCity'
 * @param {string} alias - Table alias for UsersPersonal (default: 'up')
 * @param {number} paramIndex - Starting $N index for the branch param
 * @returns {{ clause: string, params: string[] }}
 */
function branchFilter(branch, alias = 'up', paramIndex = 3) {
  if (branch === 'Both') return { clause: '', params: [] };
  return { clause: `AND ${alias}."branch" = $${paramIndex}`, params: [branch] };
}

/**
 * Normalize sex input to supported analytics filter values.
 * Returns null when the value is not a supported filter option.
 */
function normalizeSexFilterValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  if (normalized === 'male') return 'male';
  if (normalized === 'female') return 'female';
  return null;
}

const AGE_GROUP_CANONICAL = Object.freeze([
  'Under 17',
  '17–20',
  '21–25',
  '26–30',
  '31–40',
  '41+',
]);

const AGE_GROUP_ALIASES = Object.freeze({
  under17: 'Under 17',
  'under-17': 'Under 17',
  'under 17': 'Under 17',
  '17-20': '17–20',
  '17–20': '17–20',
  '21-25': '21–25',
  '21–25': '21–25',
  '26-30': '26–30',
  '26–30': '26–30',
  '31-40': '31–40',
  '31–40': '31–40',
  '41+': '41+',
  '41plus': '41+',
});

function normalizeAgeGroupFilterValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return AGE_GROUP_ALIASES[normalized] || null;
}

function ageBracketCaseExpr(alias = 'up') {
  return `
    CASE
      WHEN DATE_PART('year', AGE(${alias}."date_of_birth")) < 17 THEN 'Under 17'
      WHEN DATE_PART('year', AGE(${alias}."date_of_birth")) <= 20 THEN '17–20'
      WHEN DATE_PART('year', AGE(${alias}."date_of_birth")) <= 25 THEN '21–25'
      WHEN DATE_PART('year', AGE(${alias}."date_of_birth")) <= 30 THEN '26–30'
      WHEN DATE_PART('year', AGE(${alias}."date_of_birth")) <= 40 THEN '31–40'
      ELSE '41+'
    END
  `;
}

function ageGroupFilterClause(options = {}, patientIdExpr = 'p.id', startIdx = 3) {
  const cleanedAgeGroup = options.ageGroup ? String(options.ageGroup).trim() : '';
  const normalizedAgeGroup = normalizeAgeGroupFilterValue(cleanedAgeGroup);

  if (!normalizedAgeGroup) {
    return { clause: '', params: [], nextIndex: startIdx };
  }

  const clause = ` AND ${patientIdExpr} IN (
    SELECT p_age.id
    FROM "Patients" p_age
    INNER JOIN "UsersPersonal" up_age ON up_age.id = p_age.id
    WHERE ${ageBracketCaseExpr('up_age')} = $${startIdx}
  )`;

  return {
    clause,
    params: [normalizedAgeGroup],
    nextIndex: startIdx + 1,
  };
}

/**
 * Generate SQL WHERE clause fragment to filter patients by department, program, sex, or age group.
 * @param {object} options - { department?: string, sex?: string, ageGroup?: string }
 * @param {string} patientIdExpr - SQL expression for patient ID (e.g. 'p.id')
 * @param {number} startIdx - Starting $N param index (after existing params)
 * @returns {{ clause: string, params: any[], nextIndex: number }}
 */
function profileFilterClause(options = {}, patientIdExpr = 'p.id', startIdx = 3) {
  let clause = '';
  const params = [];

  // Normalize and trim input values to prevent empty strings from being passed
  const cleanedDept = options.department ? String(options.department).trim() : '';
  const cleanedSex = options.sex ? String(options.sex).trim() : '';

  if (cleanedDept) {
    // Filter by department OR program (since both are treated as department filter from frontend)
    clause += ` AND ${patientIdExpr} IN (
      SELECT DISTINCT pul_df."patientId" FROM "patientUpdateLog" pul_df
      LEFT JOIN "profileRecord" pr_df ON pr_df.id = pul_df.id AND pr_df.profile_type = 'Employee'
      LEFT JOIN "employee_profile" ep_df ON ep_df."profileId" = pr_df.id
      LEFT JOIN "profileRecord" pr_prog ON pr_prog.id = pul_df.id AND pr_prog.profile_type = 'Student'
      LEFT JOIN "student_profile" sp_prog ON sp_prog."profileId" = pr_prog.id
      LEFT JOIN "student_programs" spg ON spg.id = sp_prog."programId"
      WHERE pul_df.status = 'Approved'
        AND (ep_df.department = $${startIdx} OR spg.label = $${startIdx})
    )`;
    params.push(cleanedDept);
    startIdx++;
  }

  if (cleanedSex) {
    const normalizedSex = normalizeSexFilterValue(cleanedSex);
    if (normalizedSex) {
      clause += ` AND LOWER(up.sex::text) = LOWER($${startIdx})`;
      params.push(normalizedSex);
      startIdx++;
    }
  }

  const ageFilter = ageGroupFilterClause(options, patientIdExpr, startIdx);
  clause += ageFilter.clause;
  params.push(...ageFilter.params);
  startIdx = ageFilter.nextIndex;

  return { clause, params, nextIndex: startIdx };
}

// ============================================================
// DATE GROUPING HELPER
// ============================================================

const VALID_GROUP_BY = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

/**
 * Returns SQL expression and alias for date grouping.
 * @param {string} groupBy - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @param {string} dateColumn - The date column to group by
 * @returns {{ expr: string, alias: string }}
 */
function dateGroupExpr(groupBy, dateColumn) {
  switch (groupBy) {
    case 'daily':
      return { expr: `TO_CHAR(${dateColumn}, 'YYYY-MM-DD')`, alias: 'period' };
    case 'weekly':
      return { expr: `TO_CHAR(date_trunc('week', ${dateColumn}), 'YYYY-"W"IW')`, alias: 'period' };
    case 'quarterly':
      return { expr: `TO_CHAR(${dateColumn}, 'YYYY-"Q"Q')`, alias: 'period' };
    case 'yearly':
      return { expr: `TO_CHAR(${dateColumn}, 'YYYY')`, alias: 'period' };
    case 'monthly':
    default:
      return { expr: `TO_CHAR(${dateColumn}, 'YYYY-MM')`, alias: 'period' };
  }
}

/**
 * Builds a location filter for inventory/appointment entities where branch values
 * are Manila | QuezonCity | Both but source locations are Arlegui | Casal | QuezonCity.
 * @param {string} branch
 * @param {string} alias - table alias that owns a `location` column
 * @param {number} paramIndex
 * @returns {{ clause: string, params: any[] }}
 */
function inventoryLocationFilter(branch, alias = 'mb', paramIndex = 3) {
  if (branch === 'Both') return { clause: '', params: [] };
  if (branch === 'Manila') {
    return {
      clause: `AND ${alias}.location = ANY($${paramIndex}::"LocationDesignation"[])`,
      params: [['Arlegui', 'Casal']],
    };
  }
  return {
    clause: `AND ${alias}.location = $${paramIndex}::"LocationDesignation"`,
    params: ['QuezonCity'],
  };
}

function toFiniteNumbers(values = []) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sortedValues[base + 1];
  if (next !== undefined) {
    return sortedValues[base] + rest * (next - sortedValues[base]);
  }
  return sortedValues[base];
}

function meanValue(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function medianValue(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}

function modeValue(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const counts = new Map();
  for (const value of values) {
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let bestValue = null;
  let bestCount = -1;
  for (const [key, count] of counts.entries()) {
    const numeric = Number(key);
    if (!Number.isFinite(numeric)) continue;
    if (count > bestCount || (count === bestCount && (bestValue === null || numeric < bestValue))) {
      bestCount = count;
      bestValue = numeric;
    }
  }

  return bestValue ?? 0;
}

function roundNumber(value, precision = 2) {
  if (!Number.isFinite(Number(value))) return 0;
  return Number(Number(value).toFixed(precision));
}

function toFindingKey(label, fallbackIndex = 0) {
  const cleaned = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return `finding${fallbackIndex || ''}`;

  const parts = cleaned.split(' ');
  return parts
    .map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function titleFromDataType(dataType) {
  return String(dataType || '')
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'No Data Available';
}

function buildBoxSummary(values = [], precision = 2) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: roundNumber(sorted[0], precision),
    q1: roundNumber(quantile(sorted, 0.25), precision),
    median: roundNumber(quantile(sorted, 0.5), precision),
    q3: roundNumber(quantile(sorted, 0.75), precision),
    max: roundNumber(sorted[sorted.length - 1], precision),
    count: sorted.length,
  };
}

// ============================================================
// QUERY FUNCTIONS - Add your custom queries here
// ============================================================

/**
 * Consultations by Type (Medical vs Dental)
 */
async function consultationsByType(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  
  const result = await db.query(`
    SELECT c.type, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY c.type ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.type);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Consultations by Mode (Onsite vs Virtual)
 */
async function consultationsByMode(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT c.mode, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY c.mode ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.mode);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Top 10 Diagnoses by ICD Code
 */
async function topDiagnoses(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT COALESCE(icd.title, cd."diagnosisName") as diagnosis, icd.code as icd_code, COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY icd.title, cd."diagnosisName", icd.code ORDER BY count DESC LIMIT 10
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.icd_code ? `${r.diagnosis} (${r.icd_code})` : r.diagnosis);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Diagnoses by Type (Primary, Secondary, etc.)
 */
async function diagnosesByType(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT cd."diagnosisType", COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE co."recordedAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY cd."diagnosisType" ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.diagnosisType);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * BMI Trends Over Time (supports daily/weekly/monthly/quarterly/yearly grouping)
 */
async function bmiTrends(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const groupBy = VALID_GROUP_BY.includes(options.groupBy) ? options.groupBy : 'monthly';
  const dg = dateGroupExpr(groupBy, 'vs.created_at');
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${dg.expr} as ${dg.alias},
      ROUND(AVG(vs.weight_kg / POWER(vs.height_cm / 100, 2))::numeric, 2) as avg_bmi,
      COUNT(*) as sample_count
    FROM "VitalSigns" vs
    INNER JOIN "Patients" p ON vs."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE vs.created_at BETWEEN $1 AND $2 AND vs.height_cm > 0 AND vs.weight_kg > 0 ${bf.clause} ${pf.clause}
    GROUP BY ${dg.expr} ORDER BY ${dg.alias}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.period);
  const values = result.rows.map(r => parseFloat(r.avg_bmi));
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.sample_count), 0);
  return { labels, values, total, groupBy };
}

/**
 * Blood Pressure Trends Over Time (supports daily/weekly/monthly/quarterly/yearly grouping)
 * Parses BP format "systolic/diastolic" (e.g. "120/80") and returns both averages.
 */
async function bloodPressureTrends(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const groupBy = VALID_GROUP_BY.includes(options.groupBy) ? options.groupBy : 'monthly';
  const dg = dateGroupExpr(groupBy, 'vs.created_at');
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${dg.expr} as ${dg.alias},
      ROUND(AVG(CAST(SPLIT_PART(vs.blood_pressure, '/', 1) AS INTEGER))::numeric, 1) as avg_systolic,
      ROUND(AVG(CAST(SPLIT_PART(vs.blood_pressure, '/', 2) AS INTEGER))::numeric, 1) as avg_diastolic,
      COUNT(*) as sample_count
    FROM "VitalSigns" vs
    INNER JOIN "Patients" p ON vs."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE vs.created_at BETWEEN $1 AND $2 AND vs.blood_pressure IS NOT NULL
    AND vs.blood_pressure ~ '^[0-9]+/[0-9]+$' ${bf.clause} ${pf.clause}
    GROUP BY ${dg.expr} ORDER BY ${dg.alias}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.period);
  const values = result.rows.map(r => parseFloat(r.avg_systolic));
  const diastolicValues = result.rows.map(r => parseFloat(r.avg_diastolic));
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.sample_count), 0);
  return { labels, values, diastolicValues, total, groupBy };
}

/**
 * Immunization Coverage Rate by Vaccine Type
 */
async function immunizationCoverage(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'pul."patientId"', baseParams.length + 1);
  const result = await db.query(`
    SELECT dtc.name as vaccine, COUNT(DISTINCT pul."patientId") as patient_count, SUM(ir."doseNumber") as total_doses
    FROM "ImmunizationRecord" ir
    INNER JOIN "Immunization" i ON ir."immunizationId" = i.id
    INNER JOIN "patientUpdateLog" pul ON i.id = pul.id
    INNER JOIN "DomainTypeCatalog" dtc ON ir."vaccineTypeId" = dtc.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE ir."immunizationDate" BETWEEN $1 AND $2 AND dtc.domain = 'Immunization' ${bf.clause} ${pf.clause}
    GROUP BY dtc.name ORDER BY patient_count DESC LIMIT 10
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.vaccine);
  const values = result.rows.map(r => parseInt(r.patient_count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Top Dental Procedures
 */
async function dentalProcedures(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'pul."patientId"', baseParams.length + 1);
  const result = await db.query(`
    SELECT dtc.name as procedure, COUNT(*) as count
    FROM "DentalProcedureRecord" dpr
    INNER JOIN "DentalProcedure" dp ON dpr."dentalProcedureId" = dp.id
    INNER JOIN "patientUpdateLog" pul ON dp.id = pul.id
    INNER JOIN "DomainTypeCatalog" dtc ON dpr."procedureTypeId" = dtc.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE dpr."procedureDate" BETWEEN $1 AND $2 AND dtc.domain = 'DentalProcedure' ${bf.clause} ${pf.clause}
    GROUP BY dtc.name ORDER BY count DESC LIMIT 10
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.procedure);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Lifestyle Risk Factors Prevalence
 */
async function lifestyleRisks(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'pul."patientId"', baseParams.length + 1);
  const result = await db.query(`
    SELECT
      SUM(CASE WHEN l.smoker = true THEN 1 ELSE 0 END) as smokers,
      SUM(CASE WHEN l."alcoholConsumer" = true THEN 1 ELSE 0 END) as alcohol_consumers,
      SUM(CASE WHEN l."vapeUser" = true THEN 1 ELSE 0 END) as vape_users,
      COUNT(*) as total_records
    FROM "Lifestyle" l
    INNER JOIN "patientUpdateLog" pul ON l.id = pul.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2 AND pul.status = 'Approved' ${bf.clause} ${pf.clause}
  `, [...baseParams, ...pf.params]);

  if (result.rows.length === 0) {
    return { labels: [], values: [], total: 0 };
  }

  const row = result.rows[0];
  const labels = ['Smokers', 'Alcohol Consumers', 'Vape Users'];
  const values = [
    parseInt(row.smokers),
    parseInt(row.alcohol_consumers),
    parseInt(row.vape_users)
  ];
  const total = parseInt(row.total_records);
  return { labels, values, total };
}

/**
 * Allergy Prevalence by Type
 */
async function allergyByType(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'pul."patientId"', baseParams.length + 1);
  const result = await db.query(`
    SELECT ac.type, COUNT(*) as count
    FROM "AllergyRecord" ar
    INNER JOIN "Allergy" a ON ar."allergyId" = a.id
    INNER JOIN "patientUpdateLog" pul ON a.id = pul.id
    INNER JOIN "AllergenCatalog" ac ON ar."allergenCatalogId" = ac.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2 AND pul.status = 'Approved' ${bf.clause} ${pf.clause}
    GROUP BY ac.type ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.type);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Allergy by Severity
 */
async function allergyBySeverity(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'pul."patientId"', baseParams.length + 1);
  const result = await db.query(`
    SELECT ar.severity, COUNT(*) as count
    FROM "AllergyRecord" ar
    INNER JOIN "Allergy" a ON ar."allergyId" = a.id
    INNER JOIN "patientUpdateLog" pul ON a.id = pul.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2 AND pul.status = 'Approved' ${bf.clause} ${pf.clause}
    GROUP BY ar.severity
    ORDER BY CASE ar.severity WHEN 'Severe' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'Mild' THEN 3 WHEN 'Unknown' THEN 4 END
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.severity);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Appointment Usage per Category (Student/Employee)
 */
async function appointmentsByCategory(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT p.profile as category, COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY p.profile ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.category);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Appointment Status Distribution
 */
async function appointmentsByStatus(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ps.status, COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY ps.status ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.status);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Appointments by Session (Morning/Afternoon)
 */
async function appointmentsBySession(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ps.session, COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2 AND ps.session IS NOT NULL ${bf.clause} ${pf.clause}
    GROUP BY ps.session ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.session);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total };
}

/**
 * Consultation Trends (supports daily/weekly/monthly/quarterly/yearly grouping)
 */
async function consultationTrends(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const groupBy = VALID_GROUP_BY.includes(options.groupBy) ? options.groupBy : 'monthly';
  const dg = dateGroupExpr(groupBy, 'c."createdAt"');
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${dg.expr} as ${dg.alias}, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY ${dg.expr} ORDER BY ${dg.alias}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.period);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);
  return { labels, values, total, groupBy };
}

// ============================================================
// EMR / GENERAL / INVENTORY / ADVANCED APPOINTMENT QUERIES
// ============================================================

/**
 * Female reproductive health overview from OB-GYN records.
 */
async function femaleReproductiveHealth(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE oh."hasDysmenorrhea" = true)::int AS dysmenorrhea_count,
      COUNT(*) FILTER (WHERE oh."hasDysmenorrhea" = false)::int AS no_dysmenorrhea_count,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(oh.notes), ''), NULL) IS NOT NULL)::int AS with_notes_count,
      COUNT(*) FILTER (
        WHERE oh."lastMenstrualPeriod" IS NOT NULL
          AND oh."lastMenstrualPeriod" >= (CURRENT_DATE - INTERVAL '35 days')
      )::int AS recent_lmp_count
    FROM "ObGynHistory" oh
    INNER JOIN "patientUpdateLog" pul ON pul.id = oh.id
    INNER JOIN "Patients" p ON p.id = pul."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE pul.created_at BETWEEN $1 AND $2
      AND pul.status = 'Approved'
      AND LOWER(COALESCE(up.sex::text, '')) = 'female'
      ${bf.clause} ${pf.clause}
  `, [...baseParams, ...pf.params]);

  const row = result.rows[0] || {};
  const labels = [
    'Has Dysmenorrhea',
    'No Dysmenorrhea',
    'With Clinical Notes',
    'Recent Menstrual Period (<=35d)',
  ];
  const values = [
    parseInt(row.dysmenorrhea_count || 0),
    parseInt(row.no_dysmenorrhea_count || 0),
    parseInt(row.with_notes_count || 0),
    parseInt(row.recent_lmp_count || 0),
  ];
  const total = parseInt(row.total_records || 0);
  return { labels, values, total };
}

/**
 * Lifestyle statistical summary (mean, median, mode) for core quantitative fields.
 * Returns grouped-bar-ready matrix data.
 */
async function lifestyleStatistics(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT
      l.smoker,
      l."numberOfCigarettesPerDay",
      l."yearsSmoked",
      l."vapeUser",
      l."yearsVaping"
    FROM "Lifestyle" l
    INNER JOIN "patientUpdateLog" pul ON l.id = pul.id
    INNER JOIN "Patients" p ON p.id = pul."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE pul.created_at BETWEEN $1 AND $2
      AND pul.status = 'Approved'
      ${bf.clause} ${pf.clause}
  `, [...baseParams, ...pf.params]);

  const cigaretteValues = toFiniteNumbers(
    result.rows
      .filter((row) => row.smoker === true)
      .map((row) => row.numberOfCigarettesPerDay)
  ).filter((value) => value > 0);

  const yearsSmokedValues = toFiniteNumbers(
    result.rows
      .filter((row) => row.smoker === true)
      .map((row) => row.yearsSmoked)
  ).filter((value) => value > 0);

  const yearsVapingValues = toFiniteNumbers(
    result.rows
      .filter((row) => row.vapeUser === true)
      .map((row) => row.yearsVaping)
  ).filter((value) => value > 0);

  const labels = ['Cigarettes/Day', 'Years Smoked', 'Years Vaping'];
  const series = [
    {
      name: 'Mean',
      values: [
        roundNumber(meanValue(cigaretteValues), 2),
        roundNumber(meanValue(yearsSmokedValues), 2),
        roundNumber(meanValue(yearsVapingValues), 2),
      ],
    },
    {
      name: 'Median',
      values: [
        roundNumber(medianValue(cigaretteValues), 2),
        roundNumber(medianValue(yearsSmokedValues), 2),
        roundNumber(medianValue(yearsVapingValues), 2),
      ],
    },
    {
      name: 'Mode',
      values: [
        roundNumber(modeValue(cigaretteValues), 2),
        roundNumber(modeValue(yearsSmokedValues), 2),
        roundNumber(modeValue(yearsVapingValues), 2),
      ],
    },
  ];

  return {
    labels,
    values: series[0].values,
    series,
    total: result.rows.length,
    chartVariant: 'grouped-bar',
  };
}

/**
 * Oral finding prevalence percentages against selected patient population.
 */
async function oralFindingsPercentages(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const allParams = [...baseParams, ...pf.params];

  const populationResult = await db.query(`
    SELECT COUNT(DISTINCT p.id)::int AS total_population
    FROM "DentalRecord" dr
    INNER JOIN "Patients" p ON p.id = dr."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE dr.created_at BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
  `, allParams);

  const totalPopulation = parseInt(populationResult.rows[0]?.total_population || 0);
  if (totalPopulation <= 0) {
    return {
      labels: [],
      values: [],
      rawCounts: [],
      noValues: [],
      oralFindings: {},
      total: 0,
      unit: 'percentage',
      summary: 'Oral Findings Prevalence (Boolean-based percentages).',
    };
  }

  const result = await db.query(`
    WITH filtered_population AS (
      SELECT DISTINCT p.id
      FROM "DentalRecord" dr
      INNER JOIN "Patients" p ON p.id = dr."patientId"
      INNER JOIN "UsersPersonal" up ON up.id = p.id
      WHERE dr.created_at BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    ),
    patient_finding_flags AS (
      SELECT
        fp.id AS patient_id,
        ofc.id AS finding_id,
        ofc.name AS finding_name,
        COALESCE(
          BOOL_OR(
            LOWER(TRIM(COALESCE(ofr.status::text, ''))) IN ('true', 't', '1', 'yes', 'present', 'positive', 'active')
          ),
          false
        ) AS finding_present
      FROM filtered_population fp
      INNER JOIN "oralFindingCatalog" ofc ON COALESCE(ofc."isValid", true) = true
      LEFT JOIN "DentalRecord" dr
        ON dr."patientId" = fp.id
       AND dr.created_at BETWEEN $1 AND $2
      LEFT JOIN "oralFindingRecord" ofr
        ON ofr."dentalRecordId" = dr.id
       AND ofr."oralFindingId" = ofc.id
      GROUP BY fp.id, ofc.id, ofc.name
    )
    SELECT
      finding_name,
      COUNT(*) FILTER (WHERE finding_present = true)::int AS yes_count,
      COUNT(*) FILTER (WHERE finding_present = false)::int AS no_count
    FROM patient_finding_flags
    GROUP BY finding_name
    ORDER BY yes_count DESC, finding_name ASC
    LIMIT 12
  `, allParams);

  const labels = [];
  const values = [];
  const rawCounts = [];
  const noValues = [];
  const oralFindings = {};
  const usedKeys = new Set();

  result.rows.forEach((row, index) => {
    const findingName = String(row.finding_name || '').trim() || `Finding ${index + 1}`;
    const yesCount = parseInt(row.yes_count || 0);
    const noCount = Math.max(totalPopulation - yesCount, 0);
    const yesPercentage = roundNumber((yesCount / totalPopulation) * 100, 2);
    const noPercentage = roundNumber((noCount / totalPopulation) * 100, 2);

    labels.push(findingName);
    values.push(yesPercentage);
    rawCounts.push(yesCount);
    noValues.push(noPercentage);

    let findingKey = toFindingKey(findingName, index + 1);
    if (usedKeys.has(findingKey)) {
      findingKey = `${findingKey}${index + 1}`;
    }
    usedKeys.add(findingKey);

    oralFindings[findingKey] = {
      label: findingName,
      yes: yesPercentage,
      no: noPercentage,
      yesCount,
      noCount,
    };
  });

  return {
    labels,
    values,
    rawCounts,
    noValues,
    oralFindings,
    total: totalPopulation,
    unit: 'percentage',
    summary: 'Oral Findings Prevalence (Boolean-based percentages).',
  };
}

/**
 * Vital-sign distribution summaries for box-plot rendering.
 */
async function vitalSignsBoxPlot(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT
      vs.blood_pressure,
      vs.heart_rate,
      vs.temperature,
      vs.height_cm,
      vs.weight_kg
    FROM "VitalSigns" vs
    INNER JOIN "Patients" p ON vs."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE vs.created_at BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
  `, [...baseParams, ...pf.params]);

  const systolic = [];
  const diastolic = [];
  const heartRate = [];
  const temperature = [];
  const bmi = [];

  for (const row of result.rows) {
    const bp = String(row.blood_pressure || '').match(/^\s*(\d{2,3})\/(\d{2,3})\s*$/);
    if (bp) {
      systolic.push(Number(bp[1]));
      diastolic.push(Number(bp[2]));
    }

    if (Number.isFinite(Number(row.heart_rate)) && Number(row.heart_rate) > 0) {
      heartRate.push(Number(row.heart_rate));
    }

    if (Number.isFinite(Number(row.temperature)) && Number(row.temperature) > 0) {
      temperature.push(Number(row.temperature));
    }

    const height = Number(row.height_cm);
    const weight = Number(row.weight_kg);
    if (Number.isFinite(height) && Number.isFinite(weight) && height > 0 && weight > 0) {
      bmi.push(weight / Math.pow(height / 100, 2));
    }
  }

  const summaries = [
    { name: 'Systolic BP', summary: buildBoxSummary(toFiniteNumbers(systolic), 1) },
    { name: 'Diastolic BP', summary: buildBoxSummary(toFiniteNumbers(diastolic), 1) },
    { name: 'Heart Rate', summary: buildBoxSummary(toFiniteNumbers(heartRate), 1) },
    { name: 'Temperature (C)', summary: buildBoxSummary(toFiniteNumbers(temperature), 2) },
    { name: 'BMI', summary: buildBoxSummary(toFiniteNumbers(bmi), 2) },
  ].filter((row) => row.summary);

  const boxPlot = summaries.map((row) => ({ name: row.name, ...row.summary }));
  const labels = boxPlot.map((row) => row.name);
  const values = boxPlot.map((row) => row.median);

  return {
    labels,
    values,
    boxPlot,
    total: result.rows.length,
    chartVariant: 'box-plot',
  };
}

/**
 * Active vs Inactive credential status distribution for patients.
 */
async function patientCredentialStatus(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch, 'up', 1);
  const baseParams = [...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT uc.credentials_status::text AS status, COUNT(DISTINCT p.id)::int AS count
    FROM "Patients" p
    INNER JOIN "UserCredentials" uc ON uc.id = p.id
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE 1 = 1 ${bf.clause} ${pf.clause}
    GROUP BY uc.credentials_status
  `, [...baseParams, ...pf.params]);

  const byStatus = new Map(result.rows.map((row) => [String(row.status || ''), parseInt(row.count)]));
  const active = byStatus.get('Active') || 0;
  const inactive = byStatus.get('Inactive') || 0;
  return {
    labels: ['Active', 'Inactive'],
    values: [active, inactive],
    total: active + inactive,
  };
}

/**
 * Total patient population split by branch (Manila vs Quezon City).
 */
async function patientPopulationByBranch(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch, 'up', 1);
  const baseParams = [...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT
      CASE
        WHEN up.branch::text = 'QuezonCity' THEN 'Quezon City'
        WHEN up.branch::text = 'Manila' THEN 'Manila'
        ELSE up.branch::text
      END AS campus,
      COUNT(DISTINCT p.id)::int AS count
    FROM "Patients" p
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE up.branch::text IN ('Manila', 'QuezonCity') ${bf.clause} ${pf.clause}
    GROUP BY campus
  `, [...baseParams, ...pf.params]);

  const byCampus = new Map(result.rows.map((row) => [row.campus, parseInt(row.count)]));
  const labels = ['Manila', 'Quezon City'];
  const values = [byCampus.get('Manila') || 0, byCampus.get('Quezon City') || 0];
  const total = values.reduce((sum, value) => sum + value, 0);
  return { labels, values, total };
}

/**
 * Top consumed medicine items by dispensed unit count.
 */
async function mostConsumedMedicine(branch, startDate, endDate, options = {}) {
  const lf = inventoryLocationFilter(branch, 'mb', 3);
  const baseParams = [startDate, endDate, ...lf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT mi.item_name AS item, COUNT(me.id)::int AS count
    FROM "MedicineTransactionLog" mtl
    INNER JOIN "MedicineEntity" me ON me."transactionId" = mtl.id
    INNER JOIN "MedicineBatch" mb ON mb.id = me."batchId"
    INNER JOIN "MedicalItems" mi ON mi.id = mb."medicalItemId"
    INNER JOIN "Patients" p ON p.id = mtl."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE mtl.action = 'Issue'
      AND mtl."issuedAt" BETWEEN $1 AND $2
      ${lf.clause} ${pf.clause}
    GROUP BY mi.item_name
    ORDER BY count DESC, mi.item_name ASC
    LIMIT 10
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map((row) => row.item);
  const values = result.rows.map((row) => parseInt(row.count));
  const total = values.reduce((sum, value) => sum + value, 0);
  return { labels, values, total };
}

/**
 * Top consumed supply items by issued unit count.
 * Uses SupplyTransactionLog when available, otherwise falls back to SupplyEntity links.
 */
async function mostConsumedSupply(branch, startDate, endDate, options = {}) {
  const supplyLogCheck = await db.query(`SELECT to_regclass('"SupplyTransactionLog"') AS table_ref`);
  const hasSupplyLog = Boolean(supplyLogCheck.rows[0]?.table_ref);
  const lf = inventoryLocationFilter(branch, 'sb', 3);

  let result;
  if (hasSupplyLog) {
    result = await db.query(`
      SELECT mi.item_name AS item, COUNT(se.id)::int AS count
      FROM "SupplyTransactionLog" stl
      INNER JOIN "SupplyEntity" se ON se."transactionId" = stl.id
      INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
      INNER JOIN "MedicalItems" mi ON mi.id = sb."supplyItemId"
      WHERE stl.action = 'Issue'
        AND stl."issuedAt" BETWEEN $1 AND $2
        ${lf.clause}
      GROUP BY mi.item_name
      ORDER BY count DESC, mi.item_name ASC
      LIMIT 10
    `, [startDate, endDate, ...lf.params]);
  } else {
    result = await db.query(`
      SELECT mi.item_name AS item, COUNT(se.id)::int AS count
      FROM "SupplyEntity" se
      INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
      INNER JOIN "MedicalItems" mi ON mi.id = sb."supplyItemId"
      WHERE se."transactionId" IS NOT NULL
        AND sb.updated_at BETWEEN $1 AND $2
        ${lf.clause}
      GROUP BY mi.item_name
      ORDER BY count DESC, mi.item_name ASC
      LIMIT 10
    `, [startDate, endDate, ...lf.params]);
  }

  const labels = result.rows.map((row) => row.item);
  const values = result.rows.map((row) => parseInt(row.count));
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    labels,
    values,
    total,
    source: hasSupplyLog ? 'SupplyTransactionLog' : 'SupplyEntityFallback',
  };
}

/**
 * Periodic inventory consumption trend (medicine + supply) for stacked-area visualization.
 */
async function inventoryConsumptionTrends(branch, startDate, endDate, options = {}) {
  const groupBy = VALID_GROUP_BY.includes(options.groupBy) ? options.groupBy : 'monthly';
  const dgMedicine = dateGroupExpr(groupBy, 'mtl."issuedAt"');
  const lfMedicine = inventoryLocationFilter(branch, 'mb', 3);
  const baseMedicineParams = [startDate, endDate, ...lfMedicine.params];
  const pfMedicine = profileFilterClause(options, 'p.id', baseMedicineParams.length + 1);

  const medicineResult = await db.query(`
    SELECT ${dgMedicine.expr} AS ${dgMedicine.alias}, COUNT(me.id)::int AS count
    FROM "MedicineTransactionLog" mtl
    INNER JOIN "MedicineEntity" me ON me."transactionId" = mtl.id
    INNER JOIN "MedicineBatch" mb ON mb.id = me."batchId"
    INNER JOIN "Patients" p ON p.id = mtl."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE mtl.action = 'Issue'
      AND mtl."issuedAt" BETWEEN $1 AND $2
      ${lfMedicine.clause} ${pfMedicine.clause}
    GROUP BY ${dgMedicine.expr}
    ORDER BY ${dgMedicine.alias}
  `, [...baseMedicineParams, ...pfMedicine.params]);

  const medicineByPeriod = new Map(
    medicineResult.rows.map((row) => [row.period, parseInt(row.count)])
  );

  const supplyLogCheck = await db.query(`SELECT to_regclass('"SupplyTransactionLog"') AS table_ref`);
  const hasSupplyLog = Boolean(supplyLogCheck.rows[0]?.table_ref);
  const supplyByPeriod = new Map();

  if (hasSupplyLog) {
    const dgSupply = dateGroupExpr(groupBy, 'stl."issuedAt"');
    const lfSupply = inventoryLocationFilter(branch, 'sb', 3);
    const supplyResult = await db.query(`
      SELECT ${dgSupply.expr} AS ${dgSupply.alias}, COUNT(se.id)::int AS count
      FROM "SupplyTransactionLog" stl
      INNER JOIN "SupplyEntity" se ON se."transactionId" = stl.id
      INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
      WHERE stl.action = 'Issue'
        AND stl."issuedAt" BETWEEN $1 AND $2
        ${lfSupply.clause}
      GROUP BY ${dgSupply.expr}
      ORDER BY ${dgSupply.alias}
    `, [startDate, endDate, ...lfSupply.params]);

    for (const row of supplyResult.rows) {
      supplyByPeriod.set(row.period, parseInt(row.count));
    }
  }

  const labels = Array.from(new Set([
    ...medicineByPeriod.keys(),
    ...supplyByPeriod.keys(),
  ])).sort((a, b) => a.localeCompare(b));

  const medicineSeriesValues = labels.map((period) => medicineByPeriod.get(period) || 0);
  const supplySeriesValues = labels.map((period) => supplyByPeriod.get(period) || 0);
  const series = [
    { name: 'Medicine', values: medicineSeriesValues },
    { name: 'Supply', values: supplySeriesValues },
  ];

  const total = series
    .flatMap((entry) => entry.values)
    .reduce((sum, value) => sum + value, 0);

  return {
    labels,
    values: medicineSeriesValues,
    series,
    total,
    groupBy,
    chartVariant: 'stacked-area',
  };
}

/**
 * Inventory snapshot report summary.
 */
async function inventoryReportSummary(branch, startDate, endDate, options = {}) {
  const medicineLoc = inventoryLocationFilter(branch, 'mb', 1);
  const supplyLoc = inventoryLocationFilter(branch, 'sb', 1);

  const medicineStockResult = await db.query(`
    SELECT COUNT(me.id)::int AS count
    FROM "MedicineEntity" me
    INNER JOIN "MedicineBatch" mb ON mb.id = me."batchId"
    WHERE me."transactionId" IS NULL ${medicineLoc.clause}
  `, [...medicineLoc.params]);

  const supplyStockResult = await db.query(`
    SELECT COUNT(se.id)::int AS count
    FROM "SupplyEntity" se
    INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
    WHERE se."transactionId" IS NULL ${supplyLoc.clause}
  `, [...supplyLoc.params]);

  const consumedMedicineResult = await db.query(`
    SELECT COUNT(me.id)::int AS count
    FROM "MedicineTransactionLog" mtl
    INNER JOIN "MedicineEntity" me ON me."transactionId" = mtl.id
    INNER JOIN "MedicineBatch" mb ON mb.id = me."batchId"
    WHERE mtl.action = 'Issue'
      AND mtl."issuedAt" BETWEEN $1 AND $2
      ${inventoryLocationFilter(branch, 'mb', 3).clause}
  `, [startDate, endDate, ...inventoryLocationFilter(branch, 'mb', 3).params]);

  const supplyLogCheck = await db.query(`SELECT to_regclass('"SupplyTransactionLog"') AS table_ref`);
  const hasSupplyLog = Boolean(supplyLogCheck.rows[0]?.table_ref);
  let consumedSupply = 0;

  if (hasSupplyLog) {
    const supplyConsumptionResult = await db.query(`
      SELECT COUNT(se.id)::int AS count
      FROM "SupplyTransactionLog" stl
      INNER JOIN "SupplyEntity" se ON se."transactionId" = stl.id
      INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
      WHERE stl.action = 'Issue'
        AND stl."issuedAt" BETWEEN $1 AND $2
        ${inventoryLocationFilter(branch, 'sb', 3).clause}
    `, [startDate, endDate, ...inventoryLocationFilter(branch, 'sb', 3).params]);
    consumedSupply = parseInt(supplyConsumptionResult.rows[0]?.count || 0);
  } else {
    const fallbackSupplyConsumption = await db.query(`
      SELECT COUNT(se.id)::int AS count
      FROM "SupplyEntity" se
      INNER JOIN "SupplyBatch" sb ON sb.id = se."batchId"
      WHERE se."transactionId" IS NOT NULL
        AND sb.updated_at BETWEEN $1 AND $2
        ${inventoryLocationFilter(branch, 'sb', 3).clause}
    `, [startDate, endDate, ...inventoryLocationFilter(branch, 'sb', 3).params]);
    consumedSupply = parseInt(fallbackSupplyConsumption.rows[0]?.count || 0);
  }

  const medicineLocationClause = branch === 'Manila'
    ? `AND mb.location IN ('Arlegui', 'Casal')`
    : branch === 'QuezonCity'
      ? `AND mb.location = 'QuezonCity'`
      : '';

  const supplyLocationClause = branch === 'Manila'
    ? `AND sb.location IN ('Arlegui', 'Casal')`
    : branch === 'QuezonCity'
      ? `AND sb.location = 'QuezonCity'`
      : '';

  const lowStockResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT DISTINCT mi.id
      FROM "MedicalItems" mi
      WHERE mi.active = true AND mi.category::text = 'Medicine'
        AND EXISTS (
          SELECT 1
          FROM (
            SELECT mb.location,
              COALESCE(SUM(CASE WHEN me."transactionId" IS NULL THEN 1 ELSE 0 END), 0) AS branch_stock
            FROM "MedicineBatch" mb
            LEFT JOIN "MedicineEntity" me ON me."batchId" = mb.id
            WHERE mb."medicalItemId" = mi.id
              AND (mb."expiryDate" IS NULL OR mb."expiryDate" > NOW())
              ${medicineLocationClause}
            GROUP BY mb.location
          ) med_stock
          WHERE med_stock.branch_stock <= 10
        )
      UNION
      SELECT DISTINCT mi.id
      FROM "MedicalItems" mi
      WHERE mi.active = true AND mi.category::text = 'Supply'
        AND EXISTS (
          SELECT 1
          FROM (
            SELECT sb.location,
              COALESCE(SUM(CASE WHEN se."transactionId" IS NULL THEN 1 ELSE 0 END), 0) AS branch_stock
            FROM "SupplyBatch" sb
            LEFT JOIN "SupplyEntity" se ON se."batchId" = sb.id
            WHERE sb."supplyItemId" = mi.id
              AND (sb."expiryDate" IS NULL OR sb."expiryDate" > NOW())
              ${supplyLocationClause}
            GROUP BY sb.location
          ) sup_stock
          WHERE sup_stock.branch_stock <= 10
        )
    ) low_items
  `);

  const labels = [
    'Current Medicine Stock',
    'Current Supply Stock',
    'Consumed Medicine Units',
    'Consumed Supply Units',
    'Low Stock Items',
  ];

  const values = [
    parseInt(medicineStockResult.rows[0]?.count || 0),
    parseInt(supplyStockResult.rows[0]?.count || 0),
    parseInt(consumedMedicineResult.rows[0]?.count || 0),
    consumedSupply,
    parseInt(lowStockResult.rows[0]?.count || 0),
  ];

  return {
    labels,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    source: hasSupplyLog ? 'SupplyTransactionLog' : 'SupplyEntityFallback',
  };
}

/**
 * Accommodated appointments by period with scheduler-level series.
 * Designed for stacked-area visualization.
 */
async function appointmentsAccommodatedTrends(branch, startDate, endDate, options = {}) {
  const groupBy = VALID_GROUP_BY.includes(options.groupBy) ? options.groupBy : 'monthly';
  const dg = dateGroupExpr(groupBy, 'sde."scheduledDate"::timestamp');
  const lf = inventoryLocationFilter(branch, 'ss', 3);
  const baseParams = [startDate, endDate, ...lf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);

  const result = await db.query(`
    SELECT
      ${dg.expr} AS ${dg.alias},
      COALESCE(ss.label, 'Unlabeled Scheduler') AS scheduler_label,
      COUNT(*)::int AS count
    FROM "patientSlot" ps
    INNER JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
    INNER JOIN "slotScheduler" ss ON ss.id = sde."slotId"
    INNER JOIN "Patients" p ON p.id = ps."patientId"
    INNER JOIN "UsersPersonal" up ON up.id = p.id
    WHERE sde."scheduledDate" BETWEEN $1 AND $2
      AND (ps.status IN ('InProgress', 'Completed') OR ps.arrived_at IS NOT NULL)
      ${lf.clause} ${pf.clause}
    GROUP BY ${dg.expr}, scheduler_label
    ORDER BY ${dg.alias}, scheduler_label
  `, [...baseParams, ...pf.params]);

  const periodSet = new Set();
  const schedulerTotals = new Map();
  const schedulerPeriodMap = new Map();

  for (const row of result.rows) {
    const period = row.period;
    const scheduler = row.scheduler_label;
    const count = parseInt(row.count);

    periodSet.add(period);
    schedulerTotals.set(scheduler, (schedulerTotals.get(scheduler) || 0) + count);

    if (!schedulerPeriodMap.has(scheduler)) {
      schedulerPeriodMap.set(scheduler, new Map());
    }
    const periodMap = schedulerPeriodMap.get(scheduler);
    periodMap.set(period, (periodMap.get(period) || 0) + count);
  }

  const labels = Array.from(periodSet).sort((a, b) => a.localeCompare(b));
  const topSchedulers = Array.from(schedulerTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  const topSet = new Set(topSchedulers);
  const hasOtherSchedulers = schedulerTotals.size > topSchedulers.length;

  const series = topSchedulers.map((scheduler) => {
    const periodMap = schedulerPeriodMap.get(scheduler) || new Map();
    return {
      name: scheduler,
      values: labels.map((period) => periodMap.get(period) || 0),
    };
  });

  if (hasOtherSchedulers) {
    const otherByPeriod = new Map();
    for (const [scheduler, periodMap] of schedulerPeriodMap.entries()) {
      if (topSet.has(scheduler)) continue;
      for (const [period, count] of periodMap.entries()) {
        otherByPeriod.set(period, (otherByPeriod.get(period) || 0) + count);
      }
    }
    series.push({
      name: 'Other Schedulers',
      values: labels.map((period) => otherByPeriod.get(period) || 0),
    });
  }

  const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
  const values = series[0]?.values || [];
  return {
    labels,
    values,
    series,
    total,
    groupBy,
    chartVariant: 'stacked-area',
  };
}

// ============================================================
// DEMOGRAPHIC QUERY FUNCTIONS
// ============================================================

// Shared age-bracket CASE expression (institutional brackets used throughout)
const AGE_BRACKET_EXPR = `
  CASE
    WHEN DATE_PART('year', AGE(up.date_of_birth)) < 17  THEN 'Under 17'
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 20 THEN '17–20'
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 25 THEN '21–25'
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 30 THEN '26–30'
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 40 THEN '31–40'
    ELSE '41+'
  END
`;

const AGE_BRACKET_ORDER = `
  CASE
    WHEN MIN(DATE_PART('year', AGE(up.date_of_birth))) < 17  THEN 1
    WHEN MIN(DATE_PART('year', AGE(up.date_of_birth))) <= 20 THEN 2
    WHEN MIN(DATE_PART('year', AGE(up.date_of_birth))) <= 25 THEN 3
    WHEN MIN(DATE_PART('year', AGE(up.date_of_birth))) <= 30 THEN 4
    WHEN MIN(DATE_PART('year', AGE(up.date_of_birth))) <= 40 THEN 5
    ELSE 6
  END
`;

// ── A. SEX DISTRIBUTION ──────────────────────────────────────

/**
 * Patient population by sex
 */
async function patientsBySex(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch, 'up', 1);
  const baseParams = [...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT up.sex, COUNT(DISTINCT p.id) as count
    FROM "Patients" p
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE up.date_of_birth IS NOT NULL ${bf.clause} ${pf.clause}
    GROUP BY up.sex ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.sex || 'Unknown');
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Consultation volume by patient sex
 */
async function consultationsBySex(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT up.sex, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${pf.clause}
    GROUP BY up.sex ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.sex || 'Unknown');
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Top 5 diagnoses per sex — returns matrix data for grouped bar
 * Shape: labels (diagnoses), series: [{ sex, values }]
 */
async function topDiagnosesBySex(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams1 = [startDate, endDate, ...bf.params];
  const pf1 = profileFilterClause(options, 'p.id', baseParams1.length + 1);

  // First get top 5 diagnoses overall
  const topResult = await db.query(`
    SELECT COALESCE(icd.title, cd."diagnosisName") as diagnosis, COUNT(*) as total
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2 ${bf.clause} ${pf1.clause}
    GROUP BY diagnosis ORDER BY total DESC LIMIT 5
  `, [...baseParams1, ...pf1.params]);

  const topLabels = topResult.rows.map(r => r.diagnosis);
  if (topLabels.length === 0) return { labels: [], values: [], series: [], total: 0, chartVariant: 'grouped-bar' };

  // Then get count per (diagnosis, sex) for those top 5
  const bf2 = branchFilter(branch, 'up', topLabels.length + 3);
  const placeholders = topLabels.map((_, i) => `$${i + 3}`).join(', ');
  const baseParams2 = [startDate, endDate, ...topLabels, ...bf2.params];
  const pf2 = profileFilterClause(options, 'p.id', baseParams2.length + 1);
  const matrixResult = await db.query(`
    SELECT COALESCE(icd.title, cd."diagnosisName") as diagnosis,
           up.sex, COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2
      AND COALESCE(icd.title, cd."diagnosisName") IN (${placeholders})
      ${bf2.clause} ${pf2.clause}
    GROUP BY diagnosis, up.sex
  `, [...baseParams2, ...pf2.params]);

  // Build series structure
  const sexSet = [...new Set(matrixResult.rows.map(r => r.sex || 'Unknown'))].sort();
  const matrixMap = {};
  matrixResult.rows.forEach(r => {
    const d = r.diagnosis;
    const s = r.sex || 'Unknown';
    if (!matrixMap[d]) matrixMap[d] = {};
    matrixMap[d][s] = parseInt(r.count);
  });

  const series = sexSet.map(sex => ({
    name: sex,
    values: topLabels.map(label => matrixMap[label]?.[sex] || 0),
  }));

  const total = matrixResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return { labels: topLabels, values: series[0]?.values || [], series, total, chartVariant: 'grouped-bar' };
}

// ── B. AGE GROUP DISTRIBUTION ────────────────────────────────

/**
 * Patient population by institutional age bracket
 */
async function patientsByAgeGroup(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch, 'up', 1);
  const baseParams = [...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT (${AGE_BRACKET_EXPR}) as age_group, COUNT(DISTINCT p.id) as count
    FROM "Patients" p
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE up.date_of_birth IS NOT NULL ${bf.clause} ${pf.clause}
    GROUP BY 1
    ORDER BY ${AGE_BRACKET_ORDER}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.age_group);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Consultation volume by patient age group
 */
async function consultationsByAgeGroup(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${AGE_BRACKET_EXPR} as age_group, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2
      AND up.date_of_birth IS NOT NULL
      ${bf.clause} ${pf.clause}
    GROUP BY 1
    ORDER BY ${AGE_BRACKET_ORDER}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.age_group);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Average BMI per age group
 */
async function bmiByAgeGroup(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${AGE_BRACKET_EXPR} as age_group,
      ROUND(AVG(vs.weight_kg / POWER(vs.height_cm / 100, 2))::numeric, 2) as avg_bmi,
      COUNT(*) as sample_count
    FROM "VitalSigns" vs
    INNER JOIN "Patients" p ON vs."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE vs.created_at BETWEEN $1 AND $2
      AND vs.height_cm > 0 AND vs.weight_kg > 0
      AND up.date_of_birth IS NOT NULL
      ${bf.clause} ${pf.clause}
    GROUP BY 1
    ORDER BY ${AGE_BRACKET_ORDER}
  `, [...baseParams, ...pf.params]);

  const labels = result.rows.map(r => r.age_group);
  const values = result.rows.map(r => parseFloat(r.avg_bmi));
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.sample_count), 0);
  return { labels, values, total };
}

/**
 * Top diagnoses by age group — matrix data (heatmap-ready)
 * Shape: labels (age groups), series: [{ name: diagnosisName, values: [count per age group] }]
 */
async function diagnosesByAgeGroup(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT ${AGE_BRACKET_EXPR} as age_group,
           COALESCE(icd.title, cd."diagnosisName") as diagnosis,
           COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2
      AND up.date_of_birth IS NOT NULL
      ${bf.clause} ${pf.clause}
    GROUP BY 1, 2
    ORDER BY ${AGE_BRACKET_ORDER}, count DESC
  `, [...baseParams, ...pf.params]);

  const ageGroups = ['Under 17', '17–20', '21–25', '26–30', '31–40', '41+'].filter(ag =>
    result.rows.some(r => r.age_group === ag)
  );

  // Get top 8 diagnoses by total count across age groups for readability
  const totalByDiagnosis = {};
  result.rows.forEach(r => {
    totalByDiagnosis[r.diagnosis] = (totalByDiagnosis[r.diagnosis] || 0) + parseInt(r.count);
  });
  const topDiagnoses = Object.entries(totalByDiagnosis)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  const matrixMap = {};
  result.rows.forEach(r => {
    if (!topDiagnoses.includes(r.diagnosis)) return;
    if (!matrixMap[r.diagnosis]) matrixMap[r.diagnosis] = {};
    matrixMap[r.diagnosis][r.age_group] = parseInt(r.count);
  });

  const series = topDiagnoses.map(name => ({
    name,
    values: ageGroups.map(ag => matrixMap[name]?.[ag] || 0),
  }));

  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return { labels: ageGroups, values: series[0]?.values || [], series, total, chartVariant: 'heatmap' };
}

// ── C. DEPARTMENT / PROGRAM ──────────────────────────────────

/**
 * Employee consultation volume per department
 */
async function consultationsByDepartment(branch, startDate, endDate, options = {}) {
  const params = [startDate, endDate];
  let paramIndex = 3;

  // Trim and validate department input
  const cleanedDept = options.department ? String(options.department).trim() : '';
  const deptCteFilter = cleanedDept ? `AND ep.department = $${paramIndex}` : '';
  if (cleanedDept) {
    params.push(cleanedDept);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  // Trim and validate sex input
  const cleanedSex = options.sex ? String(options.sex).trim() : '';
  const normalizedSex = normalizeSexFilterValue(cleanedSex);
  const sexFilter = normalizedSex ? `AND LOWER(up.sex::text) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
    paramIndex++;
  }

  const af = ageGroupFilterClause(options, 'p.id', paramIndex);
  const ageFilter = af.clause;
  params.push(...af.params);
  paramIndex = af.nextIndex;

  const result = await db.query(`
    WITH patient_dept AS (
      SELECT DISTINCT ON (pul."patientId") pul."patientId", ep.department
      FROM "patientUpdateLog" pul
      INNER JOIN "profileRecord" pr ON pr.id = pul.id AND pr.profile_type = 'Employee'
      INNER JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE pul.status = 'Approved' AND ep.department IS NOT NULL ${deptCteFilter}
      ORDER BY pul."patientId", pul.created_at DESC
    )
    SELECT pd.department, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    INNER JOIN patient_dept pd ON pd."patientId" = p.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${sexFilter} ${ageFilter}
    GROUP BY pd.department ORDER BY count DESC LIMIT 15
  `, params);

  const labels = result.rows.map(r => r.department);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Student consultation volume per program
 */
async function consultationsByProgram(branch, startDate, endDate, options = {}) {
  const params = [startDate, endDate];
  let paramIndex = 3;

  // Trim and validate department input
  const cleanedDept = options.department ? String(options.department).trim() : '';
  const programCteFilter = cleanedDept ? `AND spg.label = $${paramIndex}` : '';
  if (cleanedDept) {
    params.push(cleanedDept);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  // Trim and validate sex input
  const cleanedSex = options.sex ? String(options.sex).trim() : '';
  const normalizedSex = normalizeSexFilterValue(cleanedSex);
  const sexFilter = normalizedSex ? `AND LOWER(up.sex::text) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
    paramIndex++;
  }

  const af = ageGroupFilterClause(options, 'p.id', paramIndex);
  const ageFilter = af.clause;
  params.push(...af.params);
  paramIndex = af.nextIndex;

  const result = await db.query(`
    WITH patient_prog AS (
      SELECT DISTINCT ON (pul."patientId") pul."patientId", spg.label as program
      FROM "patientUpdateLog" pul
      INNER JOIN "profileRecord" pr ON pr.id = pul.id AND pr.profile_type = 'Student'
      INNER JOIN "student_profile" sp ON sp."profileId" = pr.id
      INNER JOIN "student_programs" spg ON spg.id = sp."programId"
      WHERE pul.status = 'Approved' AND spg.label IS NOT NULL ${programCteFilter}
      ORDER BY pul."patientId", pul.created_at DESC
    )
    SELECT pp.program, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    INNER JOIN patient_prog pp ON pp."patientId" = p.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${sexFilter} ${ageFilter}
    GROUP BY pp.program ORDER BY count DESC LIMIT 15
  `, params);

  const labels = result.rows.map(r => r.program);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, v) => sum + v, 0);
  return { labels, values, total };
}

/**
 * Lifestyle risk factors per department (employees)
 * Returns series data: [{ name: 'Smokers', values: [count per dept] }, ...]
 */
async function lifestyleRisksByDepartment(branch, startDate, endDate, options = {}) {
  const params = [startDate, endDate];
  let paramIndex = 3;

  // Trim and validate department input
  const cleanedDept = options.department ? String(options.department).trim() : '';
  const deptCteFilter = cleanedDept ? `AND ep.department = $${paramIndex}` : '';
  if (cleanedDept) {
    params.push(cleanedDept);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  // Trim and validate sex input
  const cleanedSex = options.sex ? String(options.sex).trim() : '';
  const normalizedSex = normalizeSexFilterValue(cleanedSex);
  const sexFilter = normalizedSex ? `AND LOWER(up.sex::text) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
    paramIndex++;
  }

  const af = ageGroupFilterClause(options, 'pul."patientId"', paramIndex);
  const ageFilter = af.clause;
  params.push(...af.params);
  paramIndex = af.nextIndex;

  const result = await db.query(`
    WITH patient_dept AS (
      SELECT DISTINCT ON (pul."patientId") pul."patientId", ep.department
      FROM "patientUpdateLog" pul
      INNER JOIN "profileRecord" pr ON pr.id = pul.id AND pr.profile_type = 'Employee'
      INNER JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE pul.status = 'Approved' AND ep.department IS NOT NULL ${deptCteFilter}
      ORDER BY pul."patientId", pul.created_at DESC
    )
    SELECT pd.department,
      SUM(CASE WHEN l.smoker = true THEN 1 ELSE 0 END) as smokers,
      SUM(CASE WHEN l."alcoholConsumer" = true THEN 1 ELSE 0 END) as alcohol,
      SUM(CASE WHEN l."vapeUser" = true THEN 1 ELSE 0 END) as vape,
      COUNT(*) as total_records
    FROM "Lifestyle" l
    INNER JOIN "patientUpdateLog" pul ON l.id = pul.id AND pul.status = 'Approved'
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    INNER JOIN patient_dept pd ON pd."patientId" = pul."patientId"
    WHERE pul.created_at BETWEEN $1 AND $2 ${bf.clause} ${sexFilter} ${ageFilter}
    GROUP BY pd.department ORDER BY total_records DESC LIMIT 15
  `, params);

  const labels = result.rows.map(r => r.department);
  const series = [
    { name: 'Smokers',   values: result.rows.map(r => parseInt(r.smokers)) },
    { name: 'Alcohol',   values: result.rows.map(r => parseInt(r.alcohol)) },
    { name: 'Vape Users', values: result.rows.map(r => parseInt(r.vape)) },
  ];
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.total_records), 0);
  return { labels, values: series[0].values, series, total, chartVariant: 'grouped-bar' };
}

// ── D. CROSS-DIMENSIONAL ─────────────────────────────────────

/**
 * Patient count matrix: sex × age group (heatmap)
 * Shape: labels (age groups), series: [{ name: sex, values: [count per age group] }]
 */
async function sexAgeGroupMatrix(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch, 'up', 1);
  const baseParams = [...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT up.sex, (${AGE_BRACKET_EXPR}) as age_group, COUNT(DISTINCT p.id) as count
    FROM "Patients" p
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE up.date_of_birth IS NOT NULL ${bf.clause} ${pf.clause}
    GROUP BY 1, 2
    ORDER BY up.sex, ${AGE_BRACKET_ORDER}
  `, [...baseParams, ...pf.params]);

  const ageGroups = ['Under 17', '17–20', '21–25', '26–30', '31–40', '41+'].filter(ag =>
    result.rows.some(r => r.age_group === ag)
  );
  const sexes = [...new Set(result.rows.map(r => r.sex || 'Unknown'))].sort();

  const matrixMap = {};
  result.rows.forEach(r => {
    const s = r.sex || 'Unknown';
    if (!matrixMap[s]) matrixMap[s] = {};
    matrixMap[s][r.age_group] = parseInt(r.count);
  });

  const series = sexes.map(sex => ({
    name: sex,
    values: ageGroups.map(ag => matrixMap[sex]?.[ag] || 0),
  }));

  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return { labels: ageGroups, values: series[0]?.values || [], series, total, chartVariant: 'heatmap' };
}

/**
 * Top diagnoses cross-tabulated by sex and age group
 * Shape: labels (diagnoses), series: [{name: 'Male 17–20', values}, ...]
 */
async function diagnosesBySexAndAge(branch, startDate, endDate, options = {}) {
  const bf = branchFilter(branch);
  const baseParams = [startDate, endDate, ...bf.params];
  const pf = profileFilterClause(options, 'p.id', baseParams.length + 1);
  const result = await db.query(`
    SELECT COALESCE(icd.title, cd."diagnosisName") as diagnosis,
           up.sex,
           ${AGE_BRACKET_EXPR} as age_group,
           COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2
      AND up.date_of_birth IS NOT NULL
      ${bf.clause} ${pf.clause}
    GROUP BY 1, up.sex, 3
    ORDER BY count DESC
  `, [...baseParams, ...pf.params]);

  // Get top 6 diagnoses
  const totalByDiag = {};
  result.rows.forEach(r => {
    totalByDiag[r.diagnosis] = (totalByDiag[r.diagnosis] || 0) + parseInt(r.count);
  });
  const topDiagnoses = Object.entries(totalByDiag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  // Build series: one per unique sex+ageGroup combination
  const combinations = [...new Set(
    result.rows.map(r => `${r.sex || 'Unknown'} ${r.age_group}`)
  )].sort();

  const matrixMap = {};
  result.rows.forEach(r => {
    if (!topDiagnoses.includes(r.diagnosis)) return;
    const key = `${r.sex || 'Unknown'} ${r.age_group}`;
    if (!matrixMap[key]) matrixMap[key] = {};
    matrixMap[key][r.diagnosis] = parseInt(r.count);
  });

  const series = combinations.map(combo => ({
    name: combo,
    values: topDiagnoses.map(d => matrixMap[combo]?.[d] || 0),
  })).filter(s => s.values.some(v => v > 0));

  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return { labels: topDiagnoses, values: series[0]?.values || [], series, total, chartVariant: 'heatmap' };
}

// ============================================================
// QUERY REGISTRY - Register your queries here
// ============================================================

/**
 * Map of dataType -> { handler, description }
 * Add entries here to expose new query types
 */
const QUERY_HANDLERS = {
  'consultations-by-type': {
    handler: consultationsByType,
    description: 'Consultations by service type (Medical vs Dental)',
  },
  'consultations-by-mode': {
    handler: consultationsByMode,
    description: 'Consultations by mode of delivery (Onsite vs Virtual)',
  },
  'consultation-trends': {
    handler: consultationTrends,
    description: 'Consultation trends over time',
  },
  'top-diagnoses': {
    handler: topDiagnoses,
    description: 'Most frequent diagnoses recorded with ICD codes',
  },
  'diagnoses-by-type': {
    handler: diagnosesByType,
    description: 'Diagnoses grouped by type (Primary, Secondary, etc.)',
  },
  'bmi-trends': {
    handler: bmiTrends,
    description: 'Average BMI trends over time (monthly)',
  },
  'blood-pressure-trends': {
    handler: bloodPressureTrends,
    description: 'Average blood pressure trends over time (monthly)',
  },
  'immunization-coverage': {
    handler: immunizationCoverage,
    description: 'Immunization coverage by vaccine type',
  },
  'dental-procedures': {
    handler: dentalProcedures,
    description: 'Top 10 most common dental procedures',
  },
  'lifestyle-risks': {
    handler: lifestyleRisks,
    description: 'Lifestyle risk factors prevalence (smoking, alcohol, vaping)',
  },
  'allergy-by-type': {
    handler: allergyByType,
    description: 'Allergies grouped by type (Food, Drug, Environmental, etc.)',
  },
  'allergy-by-severity': {
    handler: allergyBySeverity,
    description: 'Allergies grouped by severity (Mild, Moderate, Severe)',
  },
  'appointments-by-category': {
    handler: appointmentsByCategory,
    description: 'Appointments grouped by patient category (Student/Employee)',
  },
  'appointments-by-status': {
    handler: appointmentsByStatus,
    description: 'Appointments grouped by status (Pending, Scheduled, Completed, etc.)',
  },
  'appointments-by-session': {
    handler: appointmentsBySession,
    description: 'Appointments grouped by session (Morning/Afternoon)',
  },

  // ── EMR / GENERAL / INVENTORY / ADVANCED APPOINTMENTS ───

  'female-reproductive-health': {
    handler: femaleReproductiveHealth,
    description: 'Female reproductive health summary from OB-GYN records',
  },
  'lifestyle-statistics': {
    handler: lifestyleStatistics,
    description: 'Lifestyle statistics (mean, median, mode) for smoking/vaping metrics',
  },
  'oral-findings-percentages': {
    handler: oralFindingsPercentages,
    description: 'Oral findings prevalence using boolean yes/no percentages across the filtered patient population',
  },
  'vital-signs-box-plot': {
    handler: vitalSignsBoxPlot,
    description: 'Vital-sign distribution summaries for box-plot visualization',
  },
  'patient-credential-status': {
    handler: patientCredentialStatus,
    description: 'Patient credential status distribution (Active vs Inactive)',
  },
  'patient-population-by-branch': {
    handler: patientPopulationByBranch,
    description: 'Patient population split by Manila vs Quezon City',
  },
  'most-consumed-medicine': {
    handler: mostConsumedMedicine,
    description: 'Top consumed medicine items by dispensed unit count',
  },
  'most-consumed-supply': {
    handler: mostConsumedSupply,
    description: 'Top consumed supply items by issued unit count',
  },
  'inventory-consumption-trends': {
    handler: inventoryConsumptionTrends,
    description: 'Medicine and supply consumption trends over time',
  },
  'inventory-report-summary': {
    handler: inventoryReportSummary,
    description: 'Inventory summary report with stock, consumption, and low-stock counts',
  },
  'appointments-accommodated-trends': {
    handler: appointmentsAccommodatedTrends,
    description: 'Accommodated appointments by period with scheduler-level breakdown',
  },

  // ── DEMOGRAPHICS ──────────────────────────────────────────

  'patients-by-sex': {
    handler: patientsBySex,
    description: 'Patient population distribution by sex',
  },
  'consultations-by-sex': {
    handler: consultationsBySex,
    description: 'Consultation volume broken down by patient sex',
  },
  'top-diagnoses-by-sex': {
    handler: topDiagnosesBySex,
    description: 'Top diagnoses grouped by patient sex (grouped bar)',
  },
  'patients-by-age-group': {
    handler: patientsByAgeGroup,
    description: 'Patient population by institutional age brackets (17–20, 21–25, 26–30, 31–40, 41+)',
  },
  'consultations-by-age-group': {
    handler: consultationsByAgeGroup,
    description: 'Consultation demand by age group',
  },
  'bmi-by-age-group': {
    handler: bmiByAgeGroup,
    description: 'Average BMI per age group',
  },
  'diagnoses-by-age-group': {
    handler: diagnosesByAgeGroup,
    description: 'Top diagnoses per age group (heatmap-ready matrix data)',
  },
  'consultations-by-department': {
    handler: consultationsByDepartment,
    description: 'Employee consultation volume per department',
  },
  'consultations-by-program': {
    handler: consultationsByProgram,
    description: 'Student consultation volume per college/program',
  },
  'lifestyle-risks-by-department': {
    handler: lifestyleRisksByDepartment,
    description: 'Lifestyle risk factors (smoking, alcohol, vaping) per department',
  },
  'sex-age-group-matrix': {
    handler: sexAgeGroupMatrix,
    description: 'Patient count by sex × age group matrix (heatmap)',
  },
  'diagnoses-sex-age': {
    handler: diagnosesBySexAndAge,
    description: 'Top diagnoses cross-tabulated by sex and age group',
  },
};

const CHART_CONTEXT_OVERRIDES = Object.freeze({
  'consultations-by-type': {
    key: 'serviceType',
    title: 'Consultations by Service Type (Medical vs Dental)',
    datasetContext: 'serviceType',
  },
  'consultations-by-mode': {
    key: 'deliveryMode',
    title: 'Consultations by Mode of Delivery (Onsite vs Virtual)',
    datasetContext: 'deliveryMode',
  },
  'consultation-trends': {
    key: 'consultationTrends',
    title: 'Consultation Trends Over Time',
    datasetContext: 'consultationTimeline',
  },
  'top-diagnoses': {
    key: 'diagnosisFrequency',
    title: 'Most Frequent Diagnoses Recorded',
    datasetContext: 'diagnosisFrequency',
  },
  'oral-findings-percentages': {
    key: 'oralFindings',
    title: 'Oral Findings Prevalence',
    datasetContext: 'booleanOralHealthPrevalence',
  },
});

function buildChartContext(dataType, options = {}, result = {}) {
  const override = CHART_CONTEXT_OVERRIDES[dataType] || {};
  const defaultTitle = titleFromDataType(dataType);

  return {
    key: override.key || dataType,
    title: override.title || defaultTitle,
    datasetContext: override.datasetContext || override.key || dataType,
    description: QUERY_HANDLERS[dataType]?.description || '',
    filterParameters: {
      groupBy: options.groupBy || null,
      department: options.department || null,
      sex: options.sex || null,
      ageGroup: options.ageGroup || null,
    },
    total: Number.isFinite(Number(result?.total)) ? Number(result.total) : 0,
  };
}

// ============================================================
// REPORT QUERY FUNCTIONS - For PDF report generation
// ============================================================

/**
 * Example report data fetcher
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object>} Report data object
 */
async function exampleReportData(branch, startDate, endDate) {
  // TODO: Fetch and compile data for report
  return {
    sections: [],
    summary: {},
  };
}

// ============================================================
// REPORT REGISTRY - Register your report types here
// ============================================================

/**
 * Map of reportType -> { handler, description, template }
 * Add entries here to expose new report types
 */
const REPORT_HANDLERS = {
  // Example entry (uncomment and modify):
  // 'monthly-summary': {
  //   handler: monthlySummaryReport,
  //   description: 'Monthly summary report',
  //   template: 'staff-report',
  // },
};

// ============================================================
// MODULE EXPORTS
// ============================================================

/**
 * Get list of available query types
 */
function getAvailableQueries() {
  return Object.entries(QUERY_HANDLERS).map(([name, config]) => ({
    name,
    description: config.description,
  }));
}

/**
 * Get list of available report types
 */
function getAvailableReports() {
  return Object.entries(REPORT_HANDLERS).map(([name, config]) => ({
    name,
    description: config.description,
  }));
}

/**
 * Execute a query by dataType (with Redis caching)
 * @param {string} dataType
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} [options] - Extra options (e.g. { groupBy: 'weekly' })
 */
async function executeQuery(dataType, branch, startDate, endDate, options = {}) {
  const config = QUERY_HANDLERS[dataType];
  if (!config) {
    throw new Error(`Unknown query type: ${dataType}`);
  }

  // Include groupBy and department in cache key when present
  const groupSuffix = options.groupBy ? `:g=${options.groupBy}` : '';
  const deptSuffix = options.department ? `:d=${options.department}` : '';
  const sexSuffix = options.sex ? `:sx=${options.sex}` : '';
  const ageGroupSuffix = options.ageGroup ? `:ag=${options.ageGroup}` : '';
  const cacheKey = getCacheKey(dataType, branch, startDate, endDate) + groupSuffix + deptSuffix + sexSuffix + ageGroupSuffix;
  const cached = await getCachedResult(cacheKey);
  if (cached) return cached;

  logger.debug(`Executing query: ${dataType}`, { branch, startDate, endDate, options });
  const result = await config.handler(branch, startDate, endDate, options);
  const enrichedResult = {
    ...(result || {}),
    chartContext: result?.chartContext || buildChartContext(dataType, options, result),
  };

  // Store in cache
  await setCachedResult(cacheKey, enrichedResult);

  return enrichedResult;
}

/**
 * Execute multiple queries in parallel (batch endpoint optimization)
 * @param {string[]} dataTypes
 * @param {string} branch
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} [options] - Extra options (e.g. { groupBy: 'weekly' })
 */
async function executeBatchQueries(dataTypes, branch, startDate, endDate, options = {}) {
  const results = {};
  const promises = dataTypes.map(async (dataType) => {
    try {
      const data = await executeQuery(dataType, branch, startDate, endDate, options);
      results[dataType] = { success: true, data };
    } catch (err) {
      results[dataType] = { success: false, error: err.message };
    }
  });
  await Promise.all(promises);
  return results;
}

/**
 * Get report data by reportType
 */
async function getReportData(reportType, branch, startDate, endDate) {
  const config = REPORT_HANDLERS[reportType];
  if (!config) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  logger.debug(`Fetching report data: ${reportType}`, { branch, startDate, endDate });
  const data = await config.handler(branch, startDate, endDate);

  return {
    ...data,
    template: config.template,
    description: config.description,
  };
}

/**
 * Check if query type exists
 */
function hasQuery(dataType) {
  return dataType in QUERY_HANDLERS;
}

/**
 * Check if report type exists
 */
function hasReport(reportType) {
  return reportType in REPORT_HANDLERS;
}

/**
 * Get distinct departments and sex values for filter dropdowns
 */
async function getFilterOptions() {
  const cacheKey = `${CACHE_PREFIX}filter-options:v4`;
  const cached = await getCachedResult(cacheKey);
  if (cached) return cached;

  const [deptResult, programResult] = await Promise.all([
    // Fetch all departments
    db.query(`
      SELECT DISTINCT ep.department
      FROM "employee_profile" ep
      INNER JOIN "profileRecord" pr ON ep."profileId" = pr.id AND pr.profile_type = 'Employee'
      INNER JOIN "patientUpdateLog" pul ON pul.id = pr.id AND pul.status = 'Approved'
      WHERE ep.department IS NOT NULL AND ep.department <> ''
      ORDER BY ep.department
    `),
    // Fetch all programs
    db.query(`
      SELECT DISTINCT spg.label AS program
      FROM "student_profile" sp
      INNER JOIN "profileRecord" pr ON sp."profileId" = pr.id AND pr.profile_type = 'Student'
      INNER JOIN "patientUpdateLog" pul ON pul.id = pr.id AND pul.status = 'Approved'
      INNER JOIN "student_programs" spg ON spg.id = sp."programId"
      WHERE spg.label IS NOT NULL AND spg.label <> ''
      ORDER BY spg.label
    `),
  ]);

  // Combine departments and programs for the departments filter
  const departments = deptResult.rows.map(r => r.department);
  const programs = programResult.rows.map(r => r.program);

  // Academic programs list for analytics department
  const academicPrograms = [
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
    'Teaching Certificate Program'
  ];

  // Merge departments + programs from DB with required academic programs.
  const departmentProgramOptions = Array.from(
    new Set(
      [...departments, ...programs, ...academicPrograms]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const sexFilterOptions = ['Male', 'Female'];
  const ageGroupOptions = [...AGE_GROUP_CANONICAL];

  const data = {
    departments: departmentProgramOptions,
    sexes: sexFilterOptions,
    ageGroups: ageGroupOptions,
  };
  await setCachedResult(cacheKey, data);
  return data;
}

module.exports = {
  // Registry access
  QUERY_HANDLERS,
  REPORT_HANDLERS,
  VALID_GROUP_BY,

  // List available types
  getAvailableQueries,
  getAvailableReports,

  // Execute
  executeQuery,
  executeBatchQueries,
  getReportData,

  // Utilities
  hasQuery,
  hasReport,
  getFilterOptions,
};
