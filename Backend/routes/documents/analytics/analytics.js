const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const query = require('../../../config/query.js');
const analytics = require('../../../services/analytics-query.js');
const docGen = require('../../../services/doc-generate-module/index.js');
const analyticsExport = require('../../../services/analytics-export.js');

const router = express.Router();

/**
 * GET /analytics/queries
 * List available query types
 */
router.get('/queries', jwtProtect('medical'), async (req, res) => {
  try {
    const queries = analytics.getAvailableQueries();
    res.json({ success: true, queries });
  } catch (err) {
    logger.error('Error fetching query types', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /analytics/reports
 * List available report types
 */
router.get('/reports', jwtProtect('medical'), async (req, res) => {
  try {
    const reports = analytics.getAvailableReports();
    res.json({ success: true, reports });
  } catch (err) {
    logger.error('Error fetching report types', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /analytics/query/:dataType
 * Get analytics data for frontend rendering
 *
 * Query params:
 *   - branch: 'Manila' | 'QuezonCity' | 'Both'
 *   - startDate: ISO date (YYYY-MM-DD)
 *   - endDate: ISO date (YYYY-MM-DD)
 */
router.get('/query/:dataType', jwtProtect('medical'), async (req, res) => {
  try {
    const { dataType } = req.params;
    const { branch, startDate, endDate } = req.query;

    // Validate required params
    if (!branch) {
      return res.status(400).json({ error: 'BRANCH_REQUIRED' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'DATE_RANGE_REQUIRED' });
    }

    // Validate branch
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({ error: 'INVALID_BRANCH' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'INVALID_DATE_FORMAT' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    }

    // Check query type exists
    if (!analytics.hasQuery(dataType)) {
      return res.status(404).json({ error: 'QUERY_NOT_FOUND' });
    }

    // Check user branch access
    const userBranch = await query.getUserBranch(req.user.id);
    if (userBranch !== 'Both' && userBranch !== branch && branch !== 'Both') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED' });
    }

    logger.info('Analytics query requested', {
      dataType,
      branch,
      startDate,
      endDate,
      userId: req.user.id,
    });

    const data = await analytics.executeQuery(dataType, branch, startDate, endDate);

    res.json({
      success: true,
      dataType,
      branch,
      dateRange: { startDate, endDate },
      data,
    });
  } catch (err) {
    logger.error('Analytics query failed', { error: err.message });
    res.status(500).json({ error: 'QUERY_FAILED', message: err.message });
  }
});

/**
 * POST /analytics/batch
 * Execute multiple analytics queries in a single request
 * Reduces HTTP overhead when loading the analytics dashboard.
 *
 * Body: { dataTypes: string[], branch, startDate, endDate }
 */
router.post('/batch', jwtProtect('medical'), async (req, res) => {
  try {
    const { dataTypes, branch, startDate, endDate } = req.body;

    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      return res.status(400).json({ error: 'DATA_TYPES_REQUIRED' });
    }
    if (dataTypes.length > 20) {
      return res.status(400).json({ error: 'TOO_MANY_QUERIES', message: 'Maximum 20 queries per batch' });
    }
    if (!branch || !startDate || !endDate) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({ error: 'INVALID_BRANCH' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    }

    // Validate all query types exist
    const invalidTypes = dataTypes.filter(dt => !analytics.hasQuery(dt));
    if (invalidTypes.length > 0) {
      return res.status(400).json({ error: 'INVALID_QUERY_TYPES', invalidTypes });
    }

    // Check user branch access
    const userBranch = await query.getUserBranch(req.user.id);
    if (userBranch !== 'Both' && userBranch !== branch && branch !== 'Both') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED' });
    }

    logger.info('Analytics batch query requested', {
      count: dataTypes.length,
      branch,
      startDate,
      endDate,
      userId: req.user.id,
    });

    const results = await analytics.executeBatchQueries(dataTypes, branch, startDate, endDate);

    res.json({
      success: true,
      branch,
      dateRange: { startDate, endDate },
      results,
    });
  } catch (err) {
    logger.error('Analytics batch query failed', { error: err.message });
    res.status(500).json({ error: 'BATCH_QUERY_FAILED', message: err.message });
  }
});

/**
 * GET /analytics/report/:reportType
 * Generate and download PDF report
 *
 * Query params:
 *   - branch: 'Manila' | 'QuezonCity' | 'Both'
 *   - startDate: ISO date (YYYY-MM-DD)
 *   - endDate: ISO date (YYYY-MM-DD)
 *   - title: (optional) Report title
 */
router.get('/report/:reportType', jwtProtect('medical'), async (req, res) => {
  try {
    const { reportType } = req.params;
    const { branch, startDate, endDate, title } = req.query;

    // Validate required params
    if (!branch) {
      return res.status(400).json({ error: 'BRANCH_REQUIRED' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'DATE_RANGE_REQUIRED' });
    }

    // Validate branch
    const validBranches = ['Manila', 'QuezonCity', 'Both'];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({ error: 'INVALID_BRANCH' });
    }

    // Check report type exists
    if (!analytics.hasReport(reportType)) {
      return res.status(404).json({ error: 'REPORT_NOT_FOUND' });
    }

    // Check user branch access
    const userBranch = await query.getUserBranch(req.user.id);
    if (userBranch !== 'Both' && userBranch !== branch && branch !== 'Both') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED' });
    }

    // Fetch report data
    const reportData = await analytics.getReportData(reportType, branch, startDate, endDate);

    // Fetch physician info
    const physicianResult = await require('../../../config/db.js').query(
      `SELECT up.first_name, up.last_name, mp.title
       FROM "UsersPersonal" up
       LEFT JOIN "MedicalPersonnel" mp ON up.id = mp.id
       WHERE up.id = $1`,
      [req.user.id]
    );
    const physician = physicianResult.rows[0] || {};

    // Build document data
    const docData = {
      report: {
        title: title || reportData.description || 'Analytics Report',
        subtitle: `${startDate} to ${endDate}`,
        branch,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString(),
      },
      sections: reportData.sections || [],
      summary: reportData.summary || {},
      physician: {
        id: req.user.id,
        firstName: physician.first_name,
        lastName: physician.last_name,
        title: physician.title || '',
      },
      clinic: {
        name: 'MDSystem Medical Clinic',
        address: branch === 'QuezonCity'
          ? 'Quezon City Campus, Philippines'
          : 'Manila Campus, Philippines',
      },
    };

    logger.info('Analytics report requested', {
      reportType,
      branch,
      startDate,
      endDate,
      userId: req.user.id,
    });

    // Generate and stream the report
    await docGen.downloadDocument(reportData.template || 'staff-report', docData, res);
  } catch (err) {
    logger.error('Analytics report failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'REPORT_FAILED', message: err.message });
    }
  }
});

// ============================================================
// EXPORT ENDPOINTS (CSV / Excel / PDF)
// ============================================================

/**
 * Shared validation middleware for export requests
 */
function validateExportParams(req, res) {
  const { format, branch, startDate, endDate } = req.body;

  if (!format || !['csv', 'excel', 'pdf'].includes(format)) {
    res.status(400).json({ error: 'INVALID_FORMAT', message: 'format must be csv, excel, or pdf' });
    return null;
  }
  if (!branch) {
    res.status(400).json({ error: 'BRANCH_REQUIRED' });
    return null;
  }
  const validBranches = ['Manila', 'QuezonCity', 'Both'];
  if (!validBranches.includes(branch)) {
    res.status(400).json({ error: 'INVALID_BRANCH' });
    return null;
  }
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'DATE_RANGE_REQUIRED' });
    return null;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    return null;
  }

  return { format, branch, startDate, endDate };
}

/**
 * GET /analytics/export/presets
 * Get available export presets
 */
router.get('/export/presets', jwtProtect('medical'), (req, res) => {
  res.json({ success: true, presets: analyticsExport.EXPORT_PRESETS });
});

/**
 * GET /analytics/export/types
 * Get available export data types with metadata
 */
router.get('/export/types', jwtProtect('medical'), (req, res) => {
  res.json({ success: true, types: analyticsExport.EXPORT_META });
});

/**
 * POST /analytics/export
 * Export analytics data to the requested format.
 *
 * Body:
 *   - format: 'csv' | 'excel' | 'pdf'
 *   - branch: 'Manila' | 'QuezonCity' | 'Both'
 *   - startDate: YYYY-MM-DD
 *   - endDate: YYYY-MM-DD
 *   - dataTypes?: string[]     (specific queries to include)
 *   - preset?: string          (preset name, overrides dataTypes)
 */
router.post('/export', jwtProtect('medical'), async (req, res) => {
  try {
    const params = validateExportParams(req, res);
    if (!params) return;

    const { format, branch, startDate, endDate } = params;
    const { dataTypes: rawDataTypes, preset } = req.body;

    // Resolve which queries to include
    const dataTypes = analyticsExport.resolveDataTypes(rawDataTypes, preset);
    if (dataTypes.length === 0) {
      return res.status(400).json({ error: 'NO_VALID_DATA_TYPES' });
    }

    // Check user branch access
    const userBranch = await query.getUserBranch(req.user.id);
    if (userBranch !== 'Both' && userBranch !== branch && branch !== 'Both') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED' });
    }

    logger.info('Analytics export requested', {
      format,
      branch,
      startDate,
      endDate,
      dataTypes: dataTypes.length,
      preset: preset || null,
      userId: req.user.id,
    });

    // Fetch analytics data
    const data = await analyticsExport.fetchExportData(dataTypes, branch, startDate, endDate);

    if (Object.keys(data).length === 0) {
      return res.status(404).json({ error: 'NO_DATA', message: 'No data found for the selected queries' });
    }

    const meta = { branch, startDate, endDate };

    // ── CSV ──────────────────────────────────────────────────
    if (format === 'csv') {
      const csv = analyticsExport.generateCSV(data, meta);
      const filename = analyticsExport.buildFilename(
        preset || 'analytics', branch, startDate, endDate, 'csv'
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // ── Excel ────────────────────────────────────────────────
    if (format === 'excel') {
      const workbook = await analyticsExport.generateExcel(data, meta);
      const filename = analyticsExport.buildFilename(
        preset || 'analytics', branch, startDate, endDate, 'xlsx'
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return workbook.xlsx.write(res).then(() => res.end());
    }

    // ── PDF ──────────────────────────────────────────────────
    if (format === 'pdf') {
      // Fetch physician info for PDF signature
      const physicianResult = await require('../../../config/db.js').query(
        `SELECT up.first_name, up.last_name, mp.title
         FROM "UsersPersonal" up
         LEFT JOIN "MedicalPersonnel" mp ON up.id = mp.id
         WHERE up.id = $1`,
        [req.user.id]
      );
      const physician = physicianResult.rows[0] || {};

      meta.physician = {
        id: req.user.id,
        firstName: physician.first_name,
        lastName: physician.last_name,
        title: physician.title || '',
      };
      meta.title = preset
        ? (analyticsExport.EXPORT_PRESETS[preset]?.label || 'Analytics Report')
        : 'Analytics Report';

      const { buffer, filename } = await analyticsExport.generatePDF(data, meta);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }
  } catch (err) {
    logger.error('Analytics export failed', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'EXPORT_FAILED', message: err.message });
    }
  }
});

/**
 * POST /analytics/export/single
 * Export a single metric to PDF (focused report with table + chart).
 *
 * Body:
 *   - dataType: string
 *   - branch: 'Manila' | 'QuezonCity' | 'Both'
 *   - startDate: YYYY-MM-DD
 *   - endDate: YYYY-MM-DD
 */
router.post('/export/single', jwtProtect('medical'), async (req, res) => {
  try {
    const { dataType, branch, startDate, endDate } = req.body;

    if (!dataType || !analyticsExport.EXPORT_META[dataType]) {
      return res.status(400).json({ error: 'INVALID_DATA_TYPE' });
    }
    if (!branch || !['Manila', 'QuezonCity', 'Both'].includes(branch)) {
      return res.status(400).json({ error: 'INVALID_BRANCH' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'DATE_RANGE_REQUIRED' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    }

    // Check user branch access
    const userBranch = await query.getUserBranch(req.user.id);
    if (userBranch !== 'Both' && userBranch !== branch && branch !== 'Both') {
      return res.status(403).json({ error: 'BRANCH_ACCESS_DENIED' });
    }

    logger.info('Single metric export requested', {
      dataType,
      branch,
      startDate,
      endDate,
      userId: req.user.id,
    });

    // Fetch data for single metric
    const fetchResult = await analyticsExport.fetchExportData([dataType], branch, startDate, endDate);
    const result = fetchResult[dataType];

    if (!result) {
      return res.status(404).json({ error: 'NO_DATA' });
    }

    // Fetch physician info
    const physicianResult = await require('../../../config/db.js').query(
      `SELECT up.first_name, up.last_name, mp.title
       FROM "UsersPersonal" up
       LEFT JOIN "MedicalPersonnel" mp ON up.id = mp.id
       WHERE up.id = $1`,
      [req.user.id]
    );
    const physician = physicianResult.rows[0] || {};

    const meta = {
      branch,
      startDate,
      endDate,
      physician: {
        id: req.user.id,
        firstName: physician.first_name,
        lastName: physician.last_name,
        title: physician.title || '',
      },
    };

    const { buffer, filename } = await analyticsExport.generateSingleMetricPDF(dataType, result, meta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    logger.error('Single metric export failed', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'EXPORT_FAILED', message: err.message });
    }
  }
});

module.exports = router;
