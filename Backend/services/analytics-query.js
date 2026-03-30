const db = require('../config/db.js');
const logger = require('../utils/logger.js');

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
// QUERY FUNCTIONS - Add your custom queries here
// ============================================================

/**
 * Consultations by Type (Medical vs Dental)
 */
async function consultationsByType(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      c.type,
      COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY c.type
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.type);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Consultations by Status
 */
async function consultationsByStatus(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      c.status,
      COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY c.status
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.status);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Top 10 Diagnoses by ICD Code
 */
async function topDiagnoses(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      COALESCE(icd.title, cd."diagnosisName") as diagnosis,
      icd.code as icd_code,
      COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    LEFT JOIN "ICDLookup" icd ON cd."icdId" = icd.id
    WHERE co."recordedAt" BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY icd.title, cd."diagnosisName", icd.code
    ORDER BY count DESC
    LIMIT 10
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.icd_code ? `${r.diagnosis} (${r.icd_code})` : r.diagnosis);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Diagnoses by Type (Primary, Secondary, etc.)
 */
async function diagnosesByType(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      cd."diagnosisType",
      COUNT(*) as count
    FROM "ConsultationDiagnosis" cd
    INNER JOIN "ConsultationOutcome" co ON cd."outcomeId" = co.id
    INNER JOIN "Consultation" c ON co."consultationId" = c.id
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE co."recordedAt" BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY cd."diagnosisType"
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.diagnosisType);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * BMI Trends Over Time (Monthly)
 */
async function bmiTrends(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      TO_CHAR(vs.recorded_at, 'YYYY-MM') as month,
      ROUND(AVG(vs.weight_kg / POWER(vs.height_cm / 100, 2))::numeric, 2) as avg_bmi,
      COUNT(*) as sample_count
    FROM "VitalSigns" vs
    INNER JOIN "Consultation" c ON vs.id = c."vitalSignsId"
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE vs.recorded_at BETWEEN $1 AND $2
    AND vs.height_cm > 0 AND vs.weight_kg > 0
    ${branchFilter}
    GROUP BY TO_CHAR(vs.recorded_at, 'YYYY-MM')
    ORDER BY month
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.month);
  const values = result.rows.map(r => parseFloat(r.avg_bmi));
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.sample_count), 0);

  return { labels, values, total };
}

/**
 * Blood Pressure Trends Over Time (Monthly - Average Systolic)
 */
async function bloodPressureTrends(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      TO_CHAR(vs.recorded_at, 'YYYY-MM') as month,
      ROUND(AVG(CAST(SPLIT_PART(vs.blood_pressure, '/', 1) AS INTEGER))::numeric, 1) as avg_systolic,
      ROUND(AVG(CAST(SPLIT_PART(vs.blood_pressure, '/', 2) AS INTEGER))::numeric, 1) as avg_diastolic,
      COUNT(*) as sample_count
    FROM "VitalSigns" vs
    INNER JOIN "Consultation" c ON vs.id = c."vitalSignsId"
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE vs.recorded_at BETWEEN $1 AND $2
    AND vs.blood_pressure IS NOT NULL
    AND vs.blood_pressure ~ '^[0-9]+/[0-9]+$'
    ${branchFilter}
    GROUP BY TO_CHAR(vs.recorded_at, 'YYYY-MM')
    ORDER BY month
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.month);
  const values = result.rows.map(r => parseFloat(r.avg_systolic));
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.sample_count), 0);

  return { labels, values, total };
}

/**
 * Immunization Coverage Rate by Vaccine Type
 */
async function immunizationCoverage(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      dtc.name as vaccine,
      COUNT(DISTINCT pul."patientId") as patient_count,
      SUM(ir."doseNumber") as total_doses
    FROM "ImmunizationRecord" ir
    INNER JOIN "Immunization" i ON ir."immunizationId" = i.id
    INNER JOIN "patientUpdateLog" pul ON i.id = pul.id
    INNER JOIN "DomainTypeCatalog" dtc ON ir."vaccineTypeId" = dtc.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE ir."immunizationDate" BETWEEN $1 AND $2
    AND dtc.domain = 'Immunization'
    ${branchFilter}
    GROUP BY dtc.name
    ORDER BY patient_count DESC
    LIMIT 10
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.vaccine);
  const values = result.rows.map(r => parseInt(r.patient_count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Top Dental Procedures
 */
async function dentalProcedures(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      dtc.name as procedure,
      COUNT(*) as count
    FROM "DentalProcedureRecord" dpr
    INNER JOIN "DentalProcedure" dp ON dpr."dentalProcedureId" = dp.id
    INNER JOIN "patientUpdateLog" pul ON dp.id = pul.id
    INNER JOIN "DomainTypeCatalog" dtc ON dpr."procedureTypeId" = dtc.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE dpr."procedureDate" BETWEEN $1 AND $2
    AND dtc.domain = 'DentalProcedure'
    ${branchFilter}
    GROUP BY dtc.name
    ORDER BY count DESC
    LIMIT 10
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.procedure);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Lifestyle Risk Factors Prevalence
 */
async function lifestyleRisks(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      SUM(CASE WHEN l.smoker = true THEN 1 ELSE 0 END) as smokers,
      SUM(CASE WHEN l."alcoholConsumer" = true THEN 1 ELSE 0 END) as alcohol_consumers,
      SUM(CASE WHEN l."vapeUser" = true THEN 1 ELSE 0 END) as vape_users,
      COUNT(*) as total_records
    FROM "Lifestyle" l
    INNER JOIN "patientUpdateLog" pul ON l.id = pul.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2
    AND pul.status = 'Approved'
    ${branchFilter}
  `, [startDate, endDate]);

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
async function allergyByType(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      ac.type,
      COUNT(*) as count
    FROM "AllergyRecord" ar
    INNER JOIN "Allergy" a ON ar."allergyId" = a.id
    INNER JOIN "patientUpdateLog" pul ON a.id = pul.id
    INNER JOIN "AllergenCatalog" ac ON ar."allergenCatalogId" = ac.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2
    AND pul.status = 'Approved'
    ${branchFilter}
    GROUP BY ac.type
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.type);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Allergy by Severity
 */
async function allergyBySeverity(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      ar.severity,
      COUNT(*) as count
    FROM "AllergyRecord" ar
    INNER JOIN "Allergy" a ON ar."allergyId" = a.id
    INNER JOIN "patientUpdateLog" pul ON a.id = pul.id
    INNER JOIN "UsersPersonal" up ON pul."patientId" = up.id
    WHERE pul.created_at BETWEEN $1 AND $2
    AND pul.status = 'Approved'
    ${branchFilter}
    GROUP BY ar.severity
    ORDER BY
      CASE ar.severity
        WHEN 'Severe' THEN 1
        WHEN 'Moderate' THEN 2
        WHEN 'Mild' THEN 3
        WHEN 'Unknown' THEN 4
      END
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.severity);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Appointment Usage per Category (Student/Employee)
 */
async function appointmentsByCategory(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      p.profile as category,
      COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY p.profile
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.category);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Appointment Status Distribution
 */
async function appointmentsByStatus(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      ps.status,
      COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY ps.status
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.status);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Appointments by Session (Morning/Afternoon)
 */
async function appointmentsBySession(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      ps.session,
      COUNT(*) as count
    FROM "patientSlot" ps
    INNER JOIN "Patients" p ON ps."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE ps.created_at BETWEEN $1 AND $2
    AND ps.session IS NOT NULL
    ${branchFilter}
    GROUP BY ps.session
    ORDER BY count DESC
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.session);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
}

/**
 * Monthly Consultation Trends
 */
async function consultationTrends(branch, startDate, endDate) {
  const branchFilter = branch === 'Both'
    ? ''
    : `AND up."branch" = '${branch}'`;

  const result = await db.query(`
    SELECT
      TO_CHAR(c."createdAt", 'YYYY-MM') as month,
      COUNT(*) as count
    FROM "Consultation" c
    INNER JOIN "Patients" p ON c."patientId" = p.id
    INNER JOIN "UsersPersonal" up ON p.id = up.id
    WHERE c."createdAt" BETWEEN $1 AND $2
    ${branchFilter}
    GROUP BY TO_CHAR(c."createdAt", 'YYYY-MM')
    ORDER BY month
  `, [startDate, endDate]);

  const labels = result.rows.map(r => r.month);
  const values = result.rows.map(r => parseInt(r.count));
  const total = values.reduce((sum, val) => sum + val, 0);

  return { labels, values, total };
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
  'consultations-by-status': {
    handler: consultationsByStatus,
    description: 'Consultations grouped by status (Open, Completed, etc.)',
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
 * Execute a query by dataType
 */
async function executeQuery(dataType, branch, startDate, endDate) {
  const config = QUERY_HANDLERS[dataType];
  if (!config) {
    throw new Error(`Unknown query type: ${dataType}`);
  }

  logger.debug(`Executing query: ${dataType}`, { branch, startDate, endDate });
  return await config.handler(branch, startDate, endDate);
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

module.exports = {
  // Registry access
  QUERY_HANDLERS,
  REPORT_HANDLERS,

  // List available types
  getAvailableQueries,
  getAvailableReports,

  // Execute
  executeQuery,
  getReportData,

  // Utilities
  hasQuery,
  hasReport,
};
