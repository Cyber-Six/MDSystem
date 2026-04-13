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
 * Returns empty string when the value is not a supported filter option.
 */
function normalizeSexFilterValue(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm') return 'Male';
  if (normalized === 'female' || normalized === 'f') return 'Female';
  return '';
}

/**
 * Generate SQL WHERE clause fragment to filter patients by department, program, or sex.
 * @param {object} options - { department?: string, sex?: string }
 * @param {string} patientIdExpr - SQL expression for patient ID (e.g. 'p.id')
 * @param {number} startIdx - Starting $N param index (after existing params)
 * @returns {{ clause: string, params: any[], nextIndex: number }}
 */
function profileFilterClause(options = {}, patientIdExpr = 'p.id', startIdx = 3) {
  let clause = '';
  const params = [];

  if (options.department) {
    // Filter by department OR program (since both are treated as department filter from frontend)
    clause += ` AND ${patientIdExpr} IN (
      SELECT DISTINCT pul_df."patientId" FROM "patientUpdateLog" pul_df
      LEFT JOIN "profileRecord" pr_df ON pr_df.id = pul_df.id AND pr_df.profile_type = 'Employee'
      LEFT JOIN "employee_profile" ep_df ON ep_df."profileId" = pr_df.id
      LEFT JOIN "profileRecord" pr_prog ON pr_prog.id = pul_df.id AND pr_prog.profile_type = 'Student'
      LEFT JOIN "student_profile" sp_prog ON sp_prog."profileId" = pr_prog.id
      WHERE pul_df.status = 'Approved'
        AND (ep_df.department = $${startIdx} OR sp_prog.program = $${startIdx})
    )`;
    params.push(options.department);
    startIdx++;
  }

  if (options.sex) {
    const normalizedSex = normalizeSexFilterValue(options.sex);
    if (normalizedSex) {
      clause += ` AND LOWER(COALESCE((
        SELECT up_sex.sex FROM "UsersPersonal" up_sex WHERE up_sex.id = ${patientIdExpr}
      ), '')) = LOWER($${startIdx})`;
      params.push(normalizedSex);
      startIdx++;
    }
  }

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
    WHEN DATE_PART('year', AGE(up.date_of_birth)) < 17  THEN 1
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 20 THEN 2
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 25 THEN 3
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 30 THEN 4
    WHEN DATE_PART('year', AGE(up.date_of_birth)) <= 40 THEN 5
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

  const deptCteFilter = options.department ? `AND ep.department = $${paramIndex}` : '';
  if (options.department) {
    params.push(options.department);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  const normalizedSex = normalizeSexFilterValue(options.sex);
  const sexFilter = normalizedSex ? `AND LOWER(COALESCE(up.sex, '')) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
  }

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
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${sexFilter}
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

  const programCteFilter = options.department ? `AND sp.program = $${paramIndex}` : '';
  if (options.department) {
    params.push(options.department);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  const normalizedSex = normalizeSexFilterValue(options.sex);
  const sexFilter = normalizedSex ? `AND LOWER(COALESCE(up.sex, '')) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
  }

  const result = await db.query(`
    WITH patient_prog AS (
      SELECT DISTINCT ON (pul."patientId") pul."patientId", sp.program
      FROM "patientUpdateLog" pul
      INNER JOIN "profileRecord" pr ON pr.id = pul.id AND pr.profile_type = 'Student'
      INNER JOIN "student_profile" sp ON sp."profileId" = pr.id
      WHERE pul.status = 'Approved' AND sp.program IS NOT NULL ${programCteFilter}
      ORDER BY pul."patientId", pul.created_at DESC
    )
    SELECT pp.program, COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    INNER JOIN patient_prog pp ON pp."patientId" = p.id
    WHERE c."createdAt" BETWEEN $1 AND $2 ${bf.clause} ${sexFilter}
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

  const deptCteFilter = options.department ? `AND ep.department = $${paramIndex}` : '';
  if (options.department) {
    params.push(options.department);
    paramIndex++;
  }

  const bf = branchFilter(branch, 'up', paramIndex);
  params.push(...bf.params);
  paramIndex += bf.params.length;

  const normalizedSex = normalizeSexFilterValue(options.sex);
  const sexFilter = normalizedSex ? `AND LOWER(COALESCE(up.sex, '')) = LOWER($${paramIndex})` : '';
  if (normalizedSex) {
    params.push(normalizedSex);
  }

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
    WHERE pul.created_at BETWEEN $1 AND $2 ${bf.clause} ${sexFilter}
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
    description: 'Consultations grouped by Medical/Dental type',
  },
  'consultations-by-mode': {
    handler: consultationsByMode,
    description: 'Consultations grouped by mode (Onsite, Virtual)',
  },
  'consultation-trends': {
    handler: consultationTrends,
    description: 'Monthly consultation volume trends',
  },
  'top-diagnoses': {
    handler: topDiagnoses,
    description: 'Top 10 most common diagnoses with ICD codes',
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
  const cacheKey = getCacheKey(dataType, branch, startDate, endDate) + groupSuffix + deptSuffix + sexSuffix;
  const cached = await getCachedResult(cacheKey);
  if (cached) return cached;

  logger.debug(`Executing query: ${dataType}`, { branch, startDate, endDate, options });
  const result = await config.handler(branch, startDate, endDate, options);

  // Store in cache
  await setCachedResult(cacheKey, result);

  return result;
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
  const cacheKey = `${CACHE_PREFIX}filter-options:v3`;
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
      ORDER BY sp.program
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

  const data = {
    departments: departmentProgramOptions,
    sexes: sexFilterOptions,
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
