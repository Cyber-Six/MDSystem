const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');
const { promoteFile, deleteFile } = require('../../../config/multer.js');
const docGen = require('../../../services/doc-generate-module/index.js');
const { notifyUser } = require('../../../config/sockets/socket-emitter.js');

const router = express.Router();

// ============================================================
// NON-GENERATED DOCUMENTS (REQUIRED/RAW)
// ============================================================

/**
 * GET /documents/required/
 * List all required document tags with patient's submission status
 * Query: patientId (required)
 * 
 * Returns for each document tag:
 * - submission: The CURRENT active submission (Requested, Pending, or Recorded) or null (Missing)
 * - archivedSubmissions: Array of all Archived submissions (append-only history)
 * - rejectedSubmissions: Array of all Rejected submissions (audit trail)
 */
router.get('/required', jwtProtect('medical'), async (req, res) => {
  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Get all document tags
    const tagsResult = await db.query(
      `SELECT id, label, "isActive" FROM "rawDocumentTag" WHERE "isActive" = true ORDER BY id`
    );

    // Get all submissions for this patient (including archived)
    const submissionsResult = await db.query(
      `SELECT prd.id, prd."documentTagId", prd.file, prd.status,
              prd."recordedBy", prd."notes",
              prd."archived_at", prd."created_at" as "submittedAt",
              up.first_name as "recordedByFirstName", up.last_name as "recordedByLastName"
       FROM "patientRawDocument" prd
       LEFT JOIN "UsersPersonal" up ON prd."recordedBy" = up.id
       WHERE prd."patientId" = $1
       ORDER BY prd."created_at" DESC`,
      [patientId]
    );

    // Group submissions by document tag
    const submissionsByTag = {};
    submissionsResult.rows.forEach(sub => {
      if (!submissionsByTag[sub.documentTagId]) {
        submissionsByTag[sub.documentTagId] = [];
      }
      submissionsByTag[sub.documentTagId].push({
        id: sub.id,
        file: sub.file,
        status: sub.status,
        recordedBy: sub.recordedBy ? {
          id: sub.recordedBy,
          name: `${sub.recordedByFirstName || ''} ${sub.recordedByLastName || ''}`.trim() || 'Unknown',
        } : null,
        notes: sub.notes,
        archivedAt: sub.archived_at,
        submittedAt: sub.submittedAt,
      });
    });

    // Build response with all submissions categorized
    const documents = tagsResult.rows.map((tag) => {
      const allSubmissions = submissionsByTag[tag.id] || [];
      
      // Current submission = first non-archived
      const currentSubmission = allSubmissions.find(s => s.status !== 'Archived') || null;
      
      // Archived submissions (historical approved versions - append-only)
      const archivedSubmissions = allSubmissions.filter(s => s.status === 'Archived');

      return {
        id: tag.id,
        label: tag.label,
        isActive: tag.isActive,
        submission: currentSubmission,
        archivedSubmissions: archivedSubmissions,
      };
    });

    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Error fetching required documents', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

/**
 * GET /documents/required/:documentId
 * Get specific required document details for a patient
 * Query: patientId (required)
 */
router.get('/required/:documentId', jwtProtect('medical'), async (req, res) => {
  try {
    const { documentId } = req.params;
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    const result = await db.query(
      `SELECT rdt.id, rdt.label, rdt."isActive",
              prd.id as "submissionId", prd.file, prd.status,
              prd."recordedBy", prd."archived_at", prd."created_at" as "submittedAt",
              up.first_name as "recordedByFirstName", up.last_name as "recordedByLastName"
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON prd."documentTagId" = rdt.id
         AND prd."patientId" = $1
       LEFT JOIN "UsersPersonal" up ON prd."recordedBy" = up.id
       WHERE rdt.id = $2`,
      [patientId, documentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_TAG_NOT_FOUND' });
    }

    const row = result.rows[0];
    const document = {
      id: row.id,
      label: row.label,
      isActive: row.isActive,
      submission: row.submissionId
        ? {
            id: row.submissionId,
            file: row.file,
            status: row.status,
            recordedBy: row.recordedBy
              ? {
                  id: row.recordedBy,
                  name: `${row.recordedByFirstName || ''} ${row.recordedByLastName || ''}`.trim() || 'Unknown',
                }
              : null,
            archivedAt: row.archived_at,
            submittedAt: row.submittedAt,
          }
        : null,
    };

    res.json({ success: true, document });
  } catch (err) {
    logger.error('Error fetching required document', { error: err.message });
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

/**
 * POST /documents/required/:documentId
 * Record a required document (update status to 'Recorded')
 * Body: patientId (required), file (optional - UUID of uploaded file)
 */
router.post('/required/:documentId', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  let promotedFile = null;
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId, file } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Check if the document tag exists
    const tagResult = await client.query(
      `SELECT id, label FROM "rawDocumentTag" WHERE id = $1`,
      [documentId]
    );

    if (tagResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'DOCUMENT_TAG_NOT_FOUND' });
    }

    // Check if submission exists
    const existingResult = await client.query(
      `SELECT id, status, file FROM "patientRawDocument"
       WHERE "documentTagId" = $1 AND "patientId" = $2`,
      [documentId, patientId]
    );

    const oldFile = existingResult.rows[0]?.file;

    // Promote file if provided
    if (file) {
      try {
        promotedFile = await promoteFile(req.user.id, file, 'documents');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.warn('Failed to promote document file', { error: err.message });
        return res.status(400).json({ error: 'INVALID_FILE', message: 'Failed to process document file' });
      }
    }

    let submissionId;

    if (existingResult.rows.length > 0) {
      // Update existing submission
      const updateResult = await client.query(
        `UPDATE "patientRawDocument"
         SET status = 'Recorded', "recordedBy" = $1, file = COALESCE($2, file)
         WHERE "documentTagId" = $3 AND "patientId" = $4
         RETURNING id`,
        [req.user.id, promotedFile || null, documentId, patientId]
      );
      submissionId = updateResult.rows[0].id;
    } else {
      // Create new submission with 'Recorded' status
      const insertResult = await client.query(
        `INSERT INTO "patientRawDocument" ("documentTagId", "patientId", status, "recordedBy", file)
         VALUES ($1, $2, 'Recorded', $3, $4)
         RETURNING id`,
        [documentId, patientId, req.user.id, promotedFile || null]
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

    logger.info('Required document recorded', {
      documentId,
      patientId,
      submissionId,
      recordedBy: req.user.id,
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
    logger.error('Error recording required document', { error: err.message });
    res.status(500).json({ error: 'RECORD_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /documents/required/:documentId/approve
 * Approve a submitted document (sets status to 'Recorded')
 * Body: patientId (required), notes (optional)
 */
router.post('/required/:documentId/approve', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId, notes } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Find the CURRENT (non-archived) submission
    const existingResult = await client.query(
      `SELECT prd.id, prd.status, rdt.label
       FROM "patientRawDocument" prd
       JOIN "rawDocumentTag" rdt ON rdt.id = prd."documentTagId"
       WHERE prd."documentTagId" = $1 AND prd."patientId" = $2 AND prd.status != 'Archived'
       ORDER BY prd."created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'SUBMISSION_NOT_FOUND' });
    }

    const existing = existingResult.rows[0];
    const tagLabel = existing.label;

    // Update ONLY this specific submission to Recorded status
    const updateResult = await client.query(
      `UPDATE "patientRawDocument"
       SET status = 'Recorded', "recordedBy" = $1, "notes" = $2
       WHERE id = $3
       RETURNING id`,
      [req.user.id, notes || null, existing.id]
    );

    const submissionId = updateResult.rows[0].id;
    await client.query('COMMIT');

    // Notify patient
    try {
      await notifyUser(
        String(patientId),
        'document:approved',
        {
          documentId,
          label: tagLabel,
          message: `Your submitted document "${tagLabel}" has been approved.`,
          notes,
        }
      );
    } catch (notifErr) {
      logger.warn('Document approval notification failed', { error: notifErr.message });
    }

    logger.info('Document approved', {
      documentId,
      patientId,
      submissionId,
      approvedBy: req.user.id,
    });

    res.json({ success: true, submissionId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error approving document', { error: err.message });
    res.status(500).json({ error: 'APPROVE_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /documents/required/:documentId/reject
 * Reject a submitted document
 * Body: patientId (required), notes (optional)
 * 
 * BEHAVIOR:
 * - Deletes the current submission
 * - Document type becomes available for re-request (Missing state)
 * - Staff can request a new version
 */
router.post('/required/:documentId/reject', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId, notes } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Find the CURRENT (non-archived) submission - only Pending can be rejected
    const existingResult = await client.query(
      `SELECT prd.id, prd.status, rdt.label
       FROM "patientRawDocument" prd
       JOIN "rawDocumentTag" rdt ON rdt.id = prd."documentTagId"
       WHERE prd."documentTagId" = $1 AND prd."patientId" = $2 
         AND prd.status NOT IN ('Archived', 'Recorded')
       ORDER BY prd."created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'SUBMISSION_NOT_FOUND' });
    }

    const existing = existingResult.rows[0];
    const tagLabel = existing.label;

    // Delete the submission so staff can request again
    await client.query(
      `DELETE FROM "patientRawDocument" WHERE id = $1`,
      [existing.id]
    );

    await client.query('COMMIT');

    // Notify patient
    try {
      await notifyUser(
        String(patientId),
        'document:rejected',
        {
          documentId,
          label: tagLabel,
          message: `Your submitted document "${tagLabel}" has been rejected.${notes ? ` Reason: ${notes}` : ' Please contact your healthcare provider for more information.'}`,
          notes,
        }
      );
    } catch (notifErr) {
      logger.warn('Document rejection notification failed', { error: notifErr.message });
    }

    logger.info('Document rejected and removed', {
      documentId,
      patientId,
      rejectedBy: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error rejecting document', { error: err.message });
    res.status(500).json({ error: 'REJECT_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /documents/required/:documentId/request
 * Request a document from patient (create or update submission with 'Requested' status)
 * Body: patientId (required), notes (optional - explains why the document is needed)
 * 
 * BEHAVIOR:
 * - If no active submission exists (Missing or all Archived): Creates new 'Requested' submission
 * - If Recorded submission exists: Must archive first before requesting new
 * - If Requested/Pending submission exists: Updates existing with new notes
 */
router.post('/required/:documentId/request', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId, notes } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Check if the document tag exists
    const tagResult = await client.query(
      `SELECT id, label FROM "rawDocumentTag" WHERE id = $1 AND "isActive" = true`,
      [documentId]
    );

    if (tagResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'DOCUMENT_TAG_NOT_FOUND' });
    }

    // Check if there's an ACTIVE submission (not Archived)
    const existingResult = await client.query(
      `SELECT id, status FROM "patientRawDocument"
       WHERE "documentTagId" = $1 AND "patientId" = $2 
         AND status != 'Archived'
       ORDER BY "created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    const existing = existingResult.rows[0];

    // Validate: cannot request if currently recorded (must archive first)
    if (existing?.status === 'Recorded') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'DOCUMENT_ALREADY_RECORDED',
        message: 'This document is already recorded. Archive it first before requesting a new one.',
      });
    }

    let submissionId;

    if (existing) {
      // Update existing active submission (Requested or Pending) to 'Requested' status
      const updateResult = await client.query(
        `UPDATE "patientRawDocument"
         SET status = 'Requested', "recordedBy" = $1, "notes" = $2, file = NULL
         WHERE id = $3
         RETURNING id`,
        [req.user.id, notes || null, existing.id]
      );
      submissionId = updateResult.rows[0].id;
    } else {
      // No active submission exists (all are Archived, or never requested)
      // Create NEW submission
      const insertResult = await client.query(
        `INSERT INTO "patientRawDocument" ("documentTagId", "patientId", status, "recordedBy", "notes")
         VALUES ($1, $2, 'Requested', $3, $4)
         RETURNING id`,
        [documentId, patientId, req.user.id, notes || null]
      );
      submissionId = insertResult.rows[0].id;
    }

    await client.query('COMMIT');

    // Notify patient about the document request
    try {
      const tagLabel = tagResult.rows[0].label;
      await notifyUser(
        String(patientId),
        'document:requested',
        {
          documentId,
          label: tagLabel,
          message: `Your healthcare provider has requested you to submit: ${tagLabel}`,
          notes,
        }
      );
    } catch (notifErr) {
      logger.warn('Document request notification failed', { error: notifErr.message, documentId });
    }

    logger.info('Document requested from patient', {
      documentId,
      patientId,
      submissionId,
      requestedBy: req.user.id,
    });

    res.json({ success: true, submissionId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error requesting document', { error: err.message });
    res.status(500).json({ error: 'REQUEST_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /documents/required/:documentId/archive
 * Archive a recorded document (keeps it as historical record)
 * Body: patientId (required), notes (optional - reason for archiving)
 */
router.post('/required/:documentId/archive', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId, notes } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    // Find the current non-archived submission
    const existingResult = await client.query(
      `SELECT prd.id, prd.status, rdt.label
       FROM "patientRawDocument" prd
       JOIN "rawDocumentTag" rdt ON rdt.id = prd."documentTagId"
       WHERE prd."documentTagId" = $1 AND prd."patientId" = $2 AND prd.status != 'Archived'
       ORDER BY prd."created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'SUBMISSION_NOT_FOUND' });
    }

    const existing = existingResult.rows[0];

    if (existing.status !== 'Recorded') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'INVALID_STATUS', 
        message: 'Only recorded documents can be archived.' 
      });
    }

    const tagLabel = existing.label;

    // Update to Archived status - keeps the record as history
    const updateResult = await client.query(
      `UPDATE "patientRawDocument"
       SET status = 'Archived', "archived_at" = NOW(), "notes" = $1
       WHERE id = $2
       RETURNING id`,
      [notes || null, existing.id]
    );

    const submissionId = updateResult.rows[0].id;
    await client.query('COMMIT');

    // Notify patient
    try {
      await notifyUser(
        String(patientId),
        'document:archived',
        {
          documentId,
          label: tagLabel,
          message: `Your document "${tagLabel}" has been archived.`,
          notes,
        }
      );
    } catch (notifErr) {
      logger.warn('Document archive notification failed', { error: notifErr.message });
    }

    logger.info('Document archived', {
      documentId,
      patientId,
      submissionId,
      archivedBy: req.user.id,
    });

    res.json({ success: true, submissionId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error archiving document', { error: err.message });
    res.status(500).json({ error: 'ARCHIVE_FAILED', message: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// GENERATED DOCUMENTS - TEMPLATE INFO
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
 * GET /documents/templates/:docType/sample
 * Get sample data for a template
 */
router.get('/templates/:docType/sample', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType } = req.params;
    const sampleData = docGen.getSampleData(docType);

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
// GENERATED DOCUMENTS - DOCUMENT GENERATION
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

    // Auto-fill physician details from DB when not provided
    if (!enrichedData.physician?.firstName) {
      try {
        const physicianResult = await db.query(
          `SELECT up.first_name, up.last_name,
                  mp.title, mp.designation
           FROM "UsersPersonal" up
           LEFT JOIN "MedicalPersonnel" mp ON mp.id = up.id
           WHERE up.id = $1`,
          [req.user.id]
        );
        if (physicianResult.rows.length > 0) {
          const row = physicianResult.rows[0];
          enrichedData.physician = {
            id: req.user.id,
            ...enrichedData.physician,
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            title: row.title || enrichedData.physician?.title || 'MD',
            licenseNo: enrichedData.physician?.licenseNo || '',
            specialization: row.designation || '',
          };
        }
      } catch (err) {
        logger.warn('Physician auto-fill lookup failed', { error: err.message });
      }
    }

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

      // Notify patient about the new document
      try {
        const physicianName = enrichedData.physician?.firstName
          ? `${enrichedData.physician.firstName} ${enrichedData.physician.lastName}`.trim()
          : 'your healthcare provider';

        await notifyUser(
          String(actualPatientId),
          'document:new',
          {
            documentId,
            templateType: docType,
            issuedBy: physicianName,
            message: `A new ${template.displayName.toLowerCase()} has been issued for you by ${physicianName}.`,
          }
        );
      } catch (notifErr) {
        logger.warn('Document notification failed', { error: notifErr.message, documentId });
      }

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
// GENERATED DOCUMENTS - DOCUMENT ACCESS
// ============================================================

/**
 * GET /documents/:docType/patient/:patientId
 * List documents of a specific type for a patient
 */
router.get('/:docType/patient/:patientId', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType, patientId } = req.params;

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

    res.json({ success: true, documents });
  } catch (err) {
    logger.error('Document list by type failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/:docType/patients
 * List all patients who have documents of a specific type
 */
router.get('/:docType/patients', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType } = req.params;

    const result = await db.query(
      `SELECT DISTINCT pd."patientId",
              up.first_name, up.last_name,
              COUNT(pd.id) as "documentCount",
              MAX(pd."created_at") as "lastDocumentAt"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."patientId" = up.id
       WHERE dt.template = $1
       GROUP BY pd."patientId", up.first_name, up.last_name
       ORDER BY "lastDocumentAt" DESC`,
      [docType]
    );

    const patients = result.rows.map((row) => ({
      id: row.patientId,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
      documentCount: parseInt(row.documentCount, 10),
      lastDocumentAt: row.lastDocumentAt,
    }));

    res.json({ success: true, patients });
  } catch (err) {
    logger.error('Patient list by document type failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/:docType
 * List all documents of a specific type
 */
router.get('/:docType', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType } = req.params;

    const result = await db.query(
      `SELECT pd.id, pd."patientId", pd."templateId", pd."issuedBy",
              pd."expired_at", pd."created_at",
              dt.template as "templateType", dt.description,
              up_patient.first_name as "patientFirstName", up_patient.last_name as "patientLastName",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up_patient ON pd."patientId" = up_patient.id
       LEFT JOIN "UsersPersonal" up_issuer ON pd."issuedBy" = up_issuer.id
       WHERE dt.template = $1
       ORDER BY pd."created_at" DESC`,
      [docType]
    );

    const documents = result.rows.map((row) => ({
      id: row.id,
      patient: {
        id: row.patientId,
        name: `${row.patientFirstName || ''} ${row.patientLastName || ''}`.trim() || 'Unknown',
      },
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
    logger.error('Document list by type failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

module.exports = router;
