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
 * Example query function (replace with your own)
 * @param {string} branch - 'Manila' | 'QuezonCity' | 'Both'
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<{labels: string[], values: number[], total: number}>}
 */
async function exampleQuery(branch, startDate, endDate) {
  // TODO: Replace with actual query
  // const result = await db.query(`SELECT ... WHERE ... BETWEEN $1 AND $2`, [startDate, endDate]);

  return {
    labels: [],
    values: [],
    total: 0,
  };
}

// ============================================================
// QUERY REGISTRY - Register your queries here
// ============================================================

/**
 * Map of dataType -> { handler, description }
 * Add entries here to expose new query types
 */
const QUERY_HANDLERS = {
  // Example entry (uncomment and modify):
  // 'consultations-by-type': {
  //   handler: consultationsByType,
  //   description: 'Consultations grouped by type',
  // },
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
