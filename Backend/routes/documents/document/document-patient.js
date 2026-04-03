const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');
const { promoteFile, deleteFile } = require('../../../config/multer.js');

const router = express.Router();

// ============================================================
// NON-GENERATED DOCUMENTS (REQUESTS)
// ============================================================

/**
 * GET /documents/requests
 * List document requests for the authenticated patient
 */
router.get('/requests', jwtProtect('patient'), async (req, res) => {
  try {
    const patientId = req.user.id;

    const result = await db.query(
      `SELECT rdt.id, rdt.label, rdt."isActive",
              prd.id as "submissionId", prd.status,
              prd."recordedBy", prd."created_at" as "submittedAt",
              up.first_name as "recordedByFirstName", up.last_name as "recordedByLastName"
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON prd."documentTagId" = rdt.id
         AND prd."patientId" = $1
       LEFT JOIN "UsersPersonal" up ON prd."recordedBy" = up.id
       WHERE rdt."isActive" = true AND prd.status = 'Requested'
       ORDER BY rdt.id`,
      [patientId]
    );

    const documents = result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      isActive: row.isActive,
      submission: row.submissionId
        ? {
            id: row.submissionId,
            status: row.status,
            recordedBy: row.recordedBy
              ? {
                  id: row.recordedBy,
                  name: `${row.recordedByFirstName || ''} ${row.recordedByLastName || ''}`.trim() || 'Unknown',
                }
              : null,
            submittedAt: row.submittedAt,
          }
        : null,
    }));

    logger.info('Patient document requests listed', { patientId, count: documents.length });
    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Error fetching document requests', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

/**
 * POST /documents/requests/:documentId
 * Submit a document request (create or update submission with 'Pending' status)
 * Body: file (optional - UUID of uploaded file)
 */
router.post('/requests/:documentId', jwtProtect('patient'), async (req, res) => {
  const client = await connect();
  let promotedFile = null;
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { file } = req.body;
    const patientId = req.user.id;

    // Check if the document tag exists and get existing submission
    const existingResult = await client.query(
      `SELECT prd.id, prd.status, prd.file
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON
         prd."documentTagId" = rdt.id AND prd."patientId" = $2
       WHERE rdt.id = $1 AND rdt."isActive" = true`,
      [documentId, patientId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const existing = existingResult.rows[0];
    const oldFile = existing?.file;

    // Validate status transitions
    if (existing.id) {
      switch (existing.status) {
        case 'Pending':
          if (!file) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: 'REQUEST_ALREADY_PENDING',
              message: 'A request for this document is already pending review.',
            });
          }
          // Allow file upload/replacement for pending requests
          break;
        case 'Recorded':
        case 'Archived':
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'DOCUMENT_ALREADY_PROCESSED',
            message: 'This document has already been recorded or archived.',
          });
      }
    }

    // Promote file if provided
    if (file) {
      try {
        promotedFile = await promoteFile(patientId, file, 'documents');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.warn('Failed to promote document file', { error: err.message });
        return res.status(400).json({ error: 'INVALID_FILE', message: 'Failed to process document file' });
      }
    }

    let submissionId;

    if (existing.id) {
      // Update existing submission
      const updateResult = await client.query(
        `UPDATE "patientRawDocument"
         SET file = COALESCE($1, file), status = 'Pending'
         WHERE "documentTagId" = $2 AND "patientId" = $3
         RETURNING id`,
        [promotedFile || null, documentId, patientId]
      );
      submissionId = updateResult.rows[0].id;
    } else {
      // Create new submission with 'Pending' status
      const insertResult = await client.query(
        `INSERT INTO "patientRawDocument" ("documentTagId", "patientId", file, status)
         VALUES ($1, $2, $3, 'Pending')
         RETURNING id`,
        [documentId, patientId, promotedFile || null]
      );
      submissionId = insertResult.rows[0].id;
    }

    // Delete old file only after SQL succeeds
    if (oldFile && promotedFile && promotedFile !== oldFile) {
      try {
        await deleteFile('documents', oldFile);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Failed to delete old document file', { error: err.message });
        // Cleanup new promoted file
        if (promotedFile) {
          await deleteFile('documents', promotedFile);
        }
        return res.status(500).json({ error: 'FILE_DELETE_ERROR', message: 'Failed to delete old document file' });
      }
    }

    await client.query('COMMIT');

    logger.info('Document request submitted', {
      documentId,
      patientId,
      submissionId,
    });

    res.json({ success: true, submissionId });
  } catch (err) {
    // Cleanup promoted file on error
    if (promotedFile) {
      try {
        await deleteFile('documents', promotedFile);
      } catch (cleanupErr) {
        logger.error('Failed to cleanup promoted file after error', { error: cleanupErr.message });
      }
    }

    await client.query('ROLLBACK');
    logger.error('Error submitting document request', { error: err.message });
    res.status(500).json({ error: 'SUBMIT_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// GENERATED DOCUMENTS (PATIENT ACCESS)
// ============================================================

/**
 * GET /documents/me
 * List all generated documents for the authenticated patient
 */
router.get('/me', jwtProtect('patient'), async (req, res) => {
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
 * GET /documents/me/:docType
 * List documents of a specific type for the authenticated patient
 */
router.get('/me/:docType', jwtProtect('patient'), async (req, res) => {
  try {
    const { docType } = req.params;
    const patientId = req.user.id;

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              dt.template as "templateType", dt.description,
              up.first_name as "issuedByFirstName", up.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."issuedBy" = up.id
       WHERE pd."patientId" = $1 AND dt.template = $2
       ORDER BY pd."created_at" DESC`,
      [patientId, docType]
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

    logger.info('Patient documents by type listed', {
      patientId,
      docType,
      count: documents.length,
    });
    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Patient document list by type failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

module.exports = router;
