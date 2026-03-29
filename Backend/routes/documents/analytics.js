const express = require('express');
const logger = require('../../utils/logger.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const query = require('../../config/query.js');
const analytics = require('../../services/analytics-query.js');
const docGen = require('../../services/doc-generate-module/index.js');

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
    const physicianResult = await require('../../config/db.js').query(
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

module.exports = router;
