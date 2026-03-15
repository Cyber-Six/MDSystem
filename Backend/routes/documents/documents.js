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
const db = require('../../config/query');

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
 * POST /documents/generate-docx
 * Legacy alias for POST /documents/generate.
 * Body: { template, tags }
 */
router.post('/generate-docx', async (req, res) => {
  try {
    await proxyPost(`${DOCX_SERVICE}/generate-docx`, req.body, res);
  } catch (err) {
    logger.error('Document generate-docx proxy error', { error: err.message });
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

/**
 * GET /documents/contracts
 * List tag contracts per document type (which tags each template expects).
 */
router.get('/contracts', async (req, res) => {
  try {
    const response = await axios.get(`${DOCX_SERVICE}/documents/contracts`);
    res.json(response.data);
  } catch (err) {
    logger.error('Contracts list proxy error', { error: err.message });
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

// ── Create routes (DB-driven document & report generation) ───────────────

/**
 * POST /documents/create/document/:template
 *
 * Orchestrates document generation:
 * 1. Looks up the template contract from FastAPI to know which tags are needed.
 * 2. Accepts tag values in req.body.data — values can be:
 *    - string  → plain text replacement
 *    - object with { graph, datas } → chart image generated by matplotlib
 * 3. Optionally queries PostgreSQL for additional data if req.body.query is set.
 * 4. Forwards { template, data } to FastAPI /documents/generate or /documents/pdf.
 * 5. Returns the generated DOCX or PDF to the client.
 *
 * Body: {
 *   data: { TAG_NAME: "value" | { graph: "bar"|"line"|"pie", datas: {...} }, ... },
 *   format?: "docx" | "pdf",     // default: "docx"
 *   query?: {                     // optional: fetch extra tag values from DB
 *     sql: "SELECT ...",
 *     params: [...]
 *   }
 * }
 */
router.post('/create/document/:template', async (req, res) => {
  const { template } = req.params;
  const { data = {}, format = 'docx', query: dbQuery } = req.body;

  try {
    // 1. Look up template contract from FastAPI
    let contract = null;
    try {
      const contractsRes = await axios.get(`${DOCX_SERVICE}/documents/contracts`);
      const contracts = contractsRes.data?.contracts || [];
      contract = contracts.find((c) => c.template === template);
    } catch {
      logger.warn('Could not fetch contracts from document service, proceeding without validation');
    }

    if (!contract) {
      logger.warn('No contract found for template "%s", proceeding without tag validation', template);
    }

    // 2. Optionally query DB for additional tag values
    let mergedData = { ...data };
    if (dbQuery && dbQuery.sql) {
      const result = await db.query(dbQuery.sql, dbQuery.params || []);
      if (result.rows && result.rows.length > 0) {
        // Merge the first row's columns as tag values (DB values don't override explicit data)
        const dbRow = result.rows[0];
        for (const [key, value] of Object.entries(dbRow)) {
          const tagKey = key.toUpperCase();
          if (!(tagKey in mergedData)) {
            mergedData[tagKey] = value;
          }
        }
      }
    }

    // 3. Validate required tags if contract exists
    if (contract) {
      const requiredTags = contract.tags
        .filter((t) => t.required)
        .map((t) => t.name);
      const missing = requiredTags.filter((tag) => !(tag in mergedData));
      if (missing.length > 0) {
        return res.status(400).json({
          error: 'MISSING_REQUIRED_TAGS',
          details: `Missing required tags: ${missing.join(', ')}`,
        });
      }
    }

    // 4. Forward to FastAPI (format determines endpoint)
    const endpoint = format === 'pdf'
      ? `${DOCX_SERVICE}/documents/pdf`
      : `${DOCX_SERVICE}/documents/generate`;

    const payload = { template, data: mergedData };

    const response = await axios.post(endpoint, payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    // 5. Handle FastAPI error responses
    if (response.status >= 400) {
      let detail = 'Document generation failed';
      try {
        const errBody = JSON.parse(Buffer.from(response.data).toString('utf-8'));
        detail = errBody.detail || detail;
      } catch { /* binary response, can't parse */ }

      return res.status(response.status).json({
        error: 'DOCUMENT_GENERATION_FAILED',
        details: detail,
      });
    }

    // 6. Return generated document
    res
      .status(response.status)
      .set(response.headers)
      .send(Buffer.from(response.data));

  } catch (err) {
    logger.error('Create document error', { template, error: err.message });
    res.status(500).json({
      error: 'DOCUMENT_CREATION_FAILED',
      details: err.message,
    });
  }
});


/**
 * POST /documents/create/report/:template
 *
 * Orchestrates report generation with optional chart support:
 * 1. Accepts structured report data or queries PostgreSQL for rows.
 * 2. Separates chart specs from plain data — any column value that is
 *    { graph: "bar"|"line"|"pie", datas: {...} } will be sent as a chart.
 * 3. Forwards { title, report_type, columns, data, charts, filters, template }
 *    to FastAPI /reports/pdf where Python uses matplotlib to render charts.
 * 4. Returns the PDF to the client.
 *
 * Body: {
 *   title: "Monthly Consultation Report",
 *   report_type: "consultations",
 *   columns: [{ key: "date", label: "Date" }, ...],
 *   data?: [{ date: "2026-03-01", patient: "..." }],   // provide directly OR use query
 *   charts?: [                                           // optional chart specs
 *     { graph: "bar", datas: { labels: [...], values: [...], title: "..." } }
 *   ],
 *   filters?: { month: "March 2026" },
 *   orientation?: "portrait" | "landscape",
 *   query?: {                                            // optional: fetch rows from DB
 *     sql: "SELECT ...",
 *     params: [...]
 *   }
 * }
 */
router.post('/create/report/:template', async (req, res) => {
  const { template } = req.params;
  const {
    title,
    report_type,
    columns,
    data: providedData,
    charts = [],
    filters = {},
    orientation = 'portrait',
    query: dbQuery,
  } = req.body;

  try {
    // Validate required fields
    if (!title || !report_type || !columns) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        details: 'title, report_type, and columns are required',
      });
    }

    // 1. Get report data: either from body or from DB query
    let reportData = providedData || [];
    if (dbQuery && dbQuery.sql) {
      const result = await db.query(dbQuery.sql, dbQuery.params || []);
      reportData = result.rows || [];
    }

    if (!Array.isArray(reportData) || reportData.length === 0) {
      return res.status(400).json({
        error: 'NO_REPORT_DATA',
        details: 'No data rows provided or returned from query',
      });
    }

    // 2. Build the FastAPI payload
    const payload = {
      title,
      report_type,
      columns,
      data: reportData,
      charts,
      filters,
      orientation,
      template: template || 'base.html',
    };

    // 3. Forward to FastAPI /reports/pdf
    const response = await axios.post(`${DOCX_SERVICE}/reports/pdf`, payload, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    // 4. Handle FastAPI error responses
    if (response.status >= 400) {
      let detail = 'Report generation failed';
      try {
        const errBody = JSON.parse(Buffer.from(response.data).toString('utf-8'));
        detail = errBody.detail || detail;
      } catch { /* binary response, can't parse */ }

      return res.status(response.status).json({
        error: 'REPORT_GENERATION_FAILED',
        details: detail,
      });
    }

    // 5. Proxy the PDF back to the client
    res
      .status(response.status)
      .set(response.headers)
      .send(Buffer.from(response.data));

  } catch (err) {
    logger.error('Create report error', { template, error: err.message });
    res.status(500).json({
      error: 'REPORT_CREATION_FAILED',
      details: err.message,
    });
  }
});


module.exports = router;
