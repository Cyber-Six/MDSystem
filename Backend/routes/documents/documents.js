const express = require('express');
const logger = require('../../utils/logger.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const db = require('../../config/db.js');
const docGen = require('../../services/doc-generate-module/index.js');

const router = express.Router();

// ============================================================
// TEMPLATE INFO
// ============================================================

/**
 * GET /documents/templates
 * List available document templates
 */
router.get('/templates', jwtProtect('medical'), async (req, res) => {
  try {
    const templates = docGen.getTemplateMetadata();
    res.json({ success: true, templates });
  } catch (err) {
    logger.error('Error fetching templates', { error: err.message });
    res.status(500).json({ error: 'TEMPLATE_FETCH_FAILED' });
  }
});

/**
 * GET /documents/templates/:type/sample
 * Get sample data for a template
 */
router.get('/templates/:type/sample', jwtProtect('medical'), async (req, res) => {
  try {
    const { type } = req.params;
    const sampleData = docGen.getSampleData(type);

    if (!sampleData) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }

    res.json({ success: true, data: sampleData });
  } catch (err) {
    logger.error('Error fetching sample data', { error: err.message });
    res.status(500).json({ error: 'SAMPLE_FETCH_FAILED' });
  }
});

// ============================================================
// DOCUMENT GENERATION (STAFF)
// ============================================================

/**
 * POST /documents/:docType/preview
 * Preview a document (stream PDF without saving)
 */
router.post('/:docType/preview', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType } = req.params;
    const { data } = req.body;

    const template = docGen.getTemplate(docType);
    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }

    const enrichedData = {
      ...data,
      physician: data?.physician || { id: req.user.id },
    };

    logger.info('Document preview requested', {
      docType,
      userId: req.user.id,
      patientId: data?.patient?.id,
    });

    await docGen.previewDocument(docType, enrichedData, res);
  } catch (err) {
    logger.error('Document preview failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'PREVIEW_FAILED', message: err.message });
    }
  }
});

/**
 * POST /documents/:docType/generate
 * Generate a document (save to DB for patient documents)
 */
router.post('/:docType/generate', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType } = req.params;
    const { patientId, data } = req.body;

    const template = docGen.getTemplate(docType);
    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }

    const shouldPersist = docGen.shouldPersist(docType);

    const enrichedData = {
      ...data,
      patient: { ...data?.patient, id: patientId || data?.patient?.id },
      physician: data?.physician || { id: req.user.id },
    };

    if (shouldPersist) {
      if (!patientId && !data?.patient?.id) {
        return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
      }

      const { buffer, filename, metadata } = await docGen.generateDocumentBuffer(
        docType,
        enrichedData
      );

      let templateRecord = await db.query(
        `SELECT id FROM "documentTemplate" WHERE template = $1`,
        [docType]
      );

      if (templateRecord.rows.length === 0) {
        templateRecord = await db.query(
          `INSERT INTO "documentTemplate" (template, description, "revisedDate", "createdBy")
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [
            docType,
            template.displayName,
            new Date().toISOString().slice(0, 7),
            req.user.id,
          ]
        );
      }

      const templateId = templateRecord.rows[0].id;
      const actualPatientId = patientId || data?.patient?.id;

      const docResult = await db.query(
        `INSERT INTO "PatientDocuments" ("patientId", "templateId", "issuedBy", "expired_at")
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [actualPatientId, templateId, req.user.id, data?.expiredAt || null]
      );

      const documentId = docResult.rows[0].id;

      await db.query(
        `INSERT INTO "documentData" ("documentId", "data") VALUES ($1, $2)`,
        [documentId, buffer.toString('base64')]
      );

      logger.info('Document generated and saved', {
        documentId,
        docType,
        patientId: actualPatientId,
        issuedBy: req.user.id,
      });

      res.json({ success: true, documentId, filename, metadata });
    } else {
      logger.info('Document generated (stream only)', {
        docType,
        userId: req.user.id,
        patientId: enrichedData.patient?.id,
      });

      await docGen.downloadDocument(docType, enrichedData, res);
    }
  } catch (err) {
    logger.error('Document generation failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'GENERATION_FAILED', message: err.message });
    }
  }
});

// ============================================================
// DOCUMENT ACCESS (STAFF)
// ============================================================

/**
 * GET /documents/patient/:patientId
 * List documents for a patient (staff)
 */
router.get('/patient/:patientId', jwtProtect('medical'), async (req, res) => {
  try {
    const { patientId } = req.params;

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              dt.template as "templateType", dt.description,
              up.first_name as "issuedByFirstName", up.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."issuedBy" = up.id
       WHERE pd."patientId" = $1
       ORDER BY pd."created_at" DESC`,
      [patientId]
    );

    const documents = result.rows.map((row) => ({
      id: row.id,
      templateType: row.templateType,
      description: row.description,
      issuedBy: {
        id: row.issuedBy,
        name: `${row.issuedByFirstName || ''} ${row.issuedByLastName || ''}`.trim() || 'Unknown',
      },
      expiredAt: row.expired_at,
      createdAt: row.created_at,
    }));

    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Document list failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/:documentId  (numeric IDs only)
 * Download a saved document (staff)
 */
router.get('/:documentId(\\d+)', jwtProtect('medical'), async (req, res) => {
  try {
    const { documentId } = req.params;

    const docResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."templateId", pd."issuedBy", pd."created_at",
              dt.template as "templateType", dt.description,
              dd.data as "documentBuffer"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "documentData" dd ON dd."documentId" = pd.id
       WHERE pd.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const doc = docResult.rows[0];

    if (!doc.documentBuffer) {
      return res.status(404).json({ error: 'DOCUMENT_DATA_NOT_FOUND' });
    }

    const buffer = Buffer.from(doc.documentBuffer, 'base64');

    const patientResult = await db.query(
      `SELECT up.first_name, up.last_name FROM "UsersPersonal" up WHERE up.id = $1`,
      [doc.patientId]
    );

    let filename = `document_${documentId}.pdf`;
    if (patientResult.rows.length > 0) {
      const patient = patientResult.rows[0];
      const dateStr = new Date(doc.created_at).toISOString().split('T')[0];
      filename = `${doc.templateType}_${patient.last_name}_${patient.first_name}_${dateStr}.pdf`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    logger.info('Document downloaded', { documentId, userId: req.user.id });
  } catch (err) {
    logger.error('Document download failed', { error: err.message });
    res.status(500).json({ error: 'DOWNLOAD_FAILED', message: err.message });
  }
});

// ============================================================
// PATIENT DOCUMENT ACCESS
// ============================================================

/**
 * GET /documents/my
 * List documents for the authenticated patient
 */
router.get('/my', jwtProtect('patient'), async (req, res) => {
  try {
    const patientId = req.user.id;

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              dt.template as "templateType", dt.description,
              up.first_name as "issuedByFirstName", up.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."issuedBy" = up.id
       WHERE pd."patientId" = $1
       ORDER BY pd."created_at" DESC`,
      [patientId]
    );

    const documents = result.rows.map((row) => ({
      id: row.id,
      templateType: row.templateType,
      description: row.description,
      issuedBy: {
        id: row.issuedBy,
        name: `${row.issuedByFirstName || ''} ${row.issuedByLastName || ''}`.trim() || 'Unknown',
      },
      expiredAt: row.expired_at,
      createdAt: row.created_at,
    }));

    logger.info('Patient documents listed', { patientId, count: documents.length });
    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Patient document list failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/my/:documentId
 * Download patient's own document
 */
router.get('/my/:documentId', jwtProtect('patient'), async (req, res) => {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    const docResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."templateId", pd."issuedBy", pd."created_at",
              dt.template as "templateType", dt.description,
              dd.data as "documentBuffer"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "documentData" dd ON dd."documentId" = pd.id
       WHERE pd.id = $1 AND pd."patientId" = $2`,
      [documentId, patientId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const doc = docResult.rows[0];

    if (!doc.documentBuffer) {
      return res.status(404).json({ error: 'DOCUMENT_DATA_NOT_FOUND' });
    }

    const buffer = Buffer.from(doc.documentBuffer, 'base64');

    const patientResult = await db.query(
      `SELECT up.first_name, up.last_name FROM "UsersPersonal" up WHERE up.id = $1`,
      [patientId]
    );

    let filename = `document_${documentId}.pdf`;
    if (patientResult.rows.length > 0) {
      const patient = patientResult.rows[0];
      const dateStr = new Date(doc.created_at).toISOString().split('T')[0];
      filename = `${doc.templateType}_${patient.last_name}_${patient.first_name}_${dateStr}.pdf`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    logger.info('Patient document viewed', { documentId, patientId });
  } catch (err) {
    logger.error('Patient document download failed', { error: err.message });
    res.status(500).json({ error: 'DOWNLOAD_FAILED', message: err.message });
  }
});

module.exports = router;
