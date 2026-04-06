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
 * 
 * Returns ALL documents with their current active status:
 * - Requested: Staff requested, waiting for patient upload
 * - Pending: Patient uploaded, waiting for staff review
 * - Recorded: Approved by staff
 * - Rejected: Rejected by staff (shown for history/resubmission awareness)
 * 
 * Also includes rejectedSubmissions array for audit trail
 */
router.get('/requests', jwtProtect("patient"), async (req, res) => {
  try {
    const patientId = req.user.id;

    // Get all submissions for this patient, grouped by document tag
    const result = await db.query(
      `SELECT rdt.id, rdt.label, rdt."isActive",
              prd.id as "submissionId", prd.status, prd.file,
              prd."notes",
              prd."recordedBy", prd."created_at" as "submittedAt",
              up.first_name as "recordedByFirstName", up.last_name as "recordedByLastName"
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON prd."documentTagId" = rdt.id
         AND prd."patientId" = $1
       LEFT JOIN "UsersPersonal" up ON prd."recordedBy" = up.id
       WHERE rdt."isActive" = true
       ORDER BY rdt.id, prd."created_at" DESC`,
      [patientId]
    );

    // Group by document tag ID
    const docMap = new Map();
    
    result.rows.forEach((row) => {
      if (!docMap.has(row.id)) {
        docMap.set(row.id, {
          id: row.id,
          label: row.label,
          isActive: row.isActive,
          submission: null,
        });
      }
      
      const doc = docMap.get(row.id);
      
      if (row.submissionId && row.status !== 'Archived') {
        // Active submission (Requested, Pending, Recorded)
        // Only set if not already set (first one is most recent)
        if (!doc.submission) {
          doc.submission = {
            id: row.submissionId,
            status: row.status,
            file: row.file,
            notes: row.notes,
            recordedBy: row.recordedBy
              ? {
                  id: row.recordedBy,
                  name: `${row.recordedByFirstName || ''} ${row.recordedByLastName || ''}`.trim() || 'Unknown',
                }
              : null,
            submittedAt: row.submittedAt,
          };
        }
      }
    });

    const documents = Array.from(docMap.values());

    logger.info('Patient document requests listed', { patientId, count: documents.length });
    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Error fetching document requests', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

/**
 * POST /documents/requests/:documentId
 * Submit a document request (upload file and set status to 'Pending')
 * Body: file (required - UUID of uploaded/staged file)
 * 
 * RULES:
 * - Patient can ONLY submit for documents with status 'Requested'
 * - Selecting file + calling this API = submission (manual submit required from UI)
 * - Cannot submit if already Pending, Recorded, or no request exists
 */
router.post('/requests/:documentId', jwtProtect("patient"), async (req, res) => {
  const client = await connect();
  let promotedFile = null;
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { file } = req.body;
    const patientId = req.user.id;

    // File is required for submission
    if (!file) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'FILE_REQUIRED',
        message: 'A file must be uploaded to submit a document.',
      });
    }

    // Check if the document tag exists and get CURRENT active submission
    // (not Archived, not Rejected)
    const existingResult = await client.query(
      `SELECT prd.id, prd.status, prd.file, rdt.label
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON
         prd."documentTagId" = rdt.id AND prd."patientId" = $2 
         AND prd.status NOT IN ('Archived', 'Rejected')
       WHERE rdt.id = $1 AND rdt."isActive" = true
       ORDER BY prd."created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const existing = existingResult.rows[0];
    const oldFile = existing?.file;

    // Validate: can only submit for 'Requested' status
    if (!existing.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'NO_REQUEST_EXISTS',
        message: 'This document has not been requested by staff. You cannot upload documents without a request.',
      });
    }

    if (existing.status !== 'Requested') {
      await client.query('ROLLBACK');
      
      if (existing.status === 'Pending') {
        return res.status(400).json({
          error: 'ALREADY_SUBMITTED',
          message: 'You have already submitted this document. Please wait for staff review.',
        });
      }
      
      if (existing.status === 'Recorded') {
        return res.status(400).json({
          error: 'ALREADY_APPROVED',
          message: 'This document has already been approved.',
        });
      }
      
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Cannot submit document with status '${existing.status}'.`,
      });
    }

    // Promote file from staging
    try {
      promotedFile = await promoteFile(patientId, file, 'documents');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.warn('Failed to promote document file', { error: err.message });
      return res.status(400).json({ error: 'INVALID_FILE', message: 'Failed to process document file' });
    }

    // Update submission to 'Pending' status with the uploaded file
    const updateResult = await client.query(
      `UPDATE "patientRawDocument"
       SET file = $1, status = 'Pending'
       WHERE id = $2
       RETURNING id`,
      [promotedFile, existing.id]
    );
    const submissionId = updateResult.rows[0].id;

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
router.get('/me', jwtProtect("patient"), async (req, res) => {
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
