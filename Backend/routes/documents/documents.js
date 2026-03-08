/**
 * Express proxy routes for the MDS Document Service (Python/FastAPI).
 *
 * Mounts under /documents in staff.js:
 *   app.use('/documents', require('./routes/documents/documents.js'));
 *
 * All requests are forwarded to the Python service running on
 * localhost:DOCX_GENERATED_PORT.
 */

const express = require('express');
const axios = require('axios');
const logger = require('../../utils/logger');
const { jwtProtect } = require('../../config/middleware/jwtProtect');

const router = express.Router();

const DOCX_SERVICE = `http://127.0.0.1:${process.env.DOCX_GENERATED_PORT || 3002}`;

// ── Middleware: all document routes require authenticated medical staff ──
router.use(jwtProtect('medical'));

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Forward a JSON POST to the Python service and pipe the response back.
 */
async function proxyPost(serviceUrl, body, res) {
  const response = await axios.post(serviceUrl, body, {
    responseType: 'arraybuffer',
    validateStatus: () => true, // let us handle non-2xx
  });

  res
    .status(response.status)
    .set(response.headers)
    .send(Buffer.from(response.data));
}

// ── Document routes (UC-02.4 — Medical Document Generation) ─────────────

/**
 * POST /documents/generate
 * Generate and download a DOCX file.
 * Body: { template, tags }
 */
router.post('/generate', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/documents/generate`, req.body, res);
  } catch (err) {
    logger.error('Document generate proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

/**
 * POST /documents/preview
 * Generate DOCX and return an in-browser HTML preview.
 * Body: { template, tags }
 */
router.post('/preview', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/documents/preview`, req.body, res);
  } catch (err) {
    logger.error('Document preview proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

/**
 * POST /documents/pdf
 * Generate DOCX then convert to PDF (via LibreOffice).
 * Body: { template, tags }
 */
router.post('/pdf', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/documents/pdf`, req.body, res);
  } catch (err) {
    logger.error('Document PDF proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

/**
 * GET /documents/templates
 * List all available .docx templates.
 */
router.get('/templates', async (req, res) => {
  try {
    const response = await axios.get(`${DOCX_SERVICE}/documents/templates`);
    res.json(response.data);
  } catch (err) {
    logger.error('Template list proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

// ── Report routes (UC-02.8 — Generate Analytics and Reports) ────────────

/**
 * POST /documents/reports/pdf
 * Generate a PDF report from structured data.
 * Body: { title, report_type, columns, data, filters?, orientation?, template? }
 */
router.post('/reports/pdf', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/reports/pdf`, req.body, res);
  } catch (err) {
    logger.error('Report PDF proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

/**
 * POST /documents/reports/preview
 * Preview a report as HTML (same layout as PDF).
 * Body: { title, report_type, columns, data, filters?, orientation?, template? }
 */
router.post('/reports/preview', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/reports/preview`, req.body, res);
  } catch (err) {
    logger.error('Report preview proxy error', { error: err.message });
    res.status(502).json({ error: 'DOCUMENT_SERVICE_UNAVAILABLE', message: 'Could not reach the document service.' });
  }
});

module.exports = router;
