const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');
const { promoteFile, deleteFile } = require('../../../config/multer.js');
const docGen = require('../../../services/doc-generate-module/index.js');
const {
  PRESCRIPTION_TEMPLATE_NAME,
  PRESCRIPTION_DOC_TYPE,
  PRESCRIPTION_REQUIRED_TAGS,
  GENERIC_BINARY_TAG,
  normalizeTag,
  buildPrescriptionRequirementValues,
  parsePrescriptionRequirementRows,
} = require('../../../services/doc-generate-module/prescription-normalized.js');
const { formatMessage } = require('../../health-chat/resolvers/wrapper/helper.js');
const { emitToRoom, notifyUser } = require('../../../config/sockets');
const { permissions, isMedicalPermittedPatientBased, isMedicalPermitted } = require('../../../services/permit.js');

const router = express.Router();

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function calculateAgeFromDob(dateOfBirth) {
  if (!dateOfBirth) return '';

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : '';
}

async function normalizePrescriptionPatientData(patientId, incomingPatient = {}) {
  const normalized = { ...(incomingPatient || {}) };
  const sourcePatientId = patientId || incomingPatient?.id || null;

  if (sourcePatientId) {
    try {
      const patientResult = await db.query(
        `SELECT id, first_name, middle_name, last_name, suffix, date_of_birth, sex
         FROM "UsersPersonal"
         WHERE id = $1`,
        [sourcePatientId]
      );

      if (patientResult.rows.length > 0) {
        const row = patientResult.rows[0];
        const dob = row.date_of_birth ? new Date(row.date_of_birth) : null;
        const dobFromDb = dob && !Number.isNaN(dob.getTime())
          ? dob.toISOString().slice(0, 10)
          : '';

        normalized.id = sourcePatientId;
        normalized.firstName = pickFirstNonEmpty(normalized.firstName, normalized.first_name, row.first_name);
        normalized.middleName = pickFirstNonEmpty(normalized.middleName, normalized.middle_name, row.middle_name);
        normalized.lastName = pickFirstNonEmpty(normalized.lastName, normalized.last_name, row.last_name);
        normalized.suffix = pickFirstNonEmpty(normalized.suffix, row.suffix);
        normalized.dateOfBirth = pickFirstNonEmpty(normalized.dateOfBirth, normalized.date_of_birth, dobFromDb);
        normalized.sex = pickFirstNonEmpty(normalized.sex, normalized.gender, row.sex);
      }
    } catch (err) {
      logger.warn('Prescription patient enrichment lookup failed', {
        patientId: sourcePatientId,
        error: err.message,
      });
    }
  }

  if (!normalized.firstName && normalized.name) {
    const parts = String(normalized.name).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      normalized.firstName = parts[0];
      if (!normalized.lastName && parts.length > 1) {
        normalized.lastName = parts.slice(1).join(' ');
      }
    }
  }

  const fullName = [normalized.firstName, normalized.middleName, normalized.lastName, normalized.suffix]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!fullName) {
    normalized.firstName = 'Unknown';
  }

  if (!normalized.age) {
    normalized.age = calculateAgeFromDob(normalized.dateOfBirth);
  }

  if (!normalized.age) {
    normalized.age = 'Unknown';
  }

  if (!normalized.sex) {
    normalized.sex = 'Unknown';
  }

  normalized.id = normalized.id || sourcePatientId;
  return normalized;
}

function createRouteError(statusCode, errorCode, message, details = null) {
  const err = new Error(message || errorCode);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  if (details) err.details = details;
  return err;
}

function toDateInput(value) {
  const fallback = new Date().toISOString().slice(0, 10);
  if (!value) return fallback;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  return text ? text.slice(0, 10) : fallback;
}

function sendPdfBuffer(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

async function resolvePhysicianData(physicianId, existingPhysician = {}) {
  const base = {
    ...(existingPhysician || {}),
    id: physicianId || existingPhysician?.id,
  };

  if (!physicianId) return base;

  try {
    const physicianResult = await db.query(
      `SELECT up.first_name, up.last_name,
              mp.title, mp.designation
       FROM "UsersPersonal" up
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = up.id
       WHERE up.id = $1`,
      [physicianId]
    );

    if (physicianResult.rows.length === 0) {
      return {
        ...base,
        title: pickFirstNonEmpty(base.title, 'MD'),
      };
    }

    const row = physicianResult.rows[0];
    return {
      ...base,
      id: physicianId,
      firstName: pickFirstNonEmpty(base.firstName, base.first_name, row.first_name),
      lastName: pickFirstNonEmpty(base.lastName, base.last_name, row.last_name),
      title: pickFirstNonEmpty(base.title, row.title, 'MD'),
      licenseNo: pickFirstNonEmpty(base.licenseNo),
      ptrNo: pickFirstNonEmpty(base.ptrNo, base.ptr_number, base.ptrNumber),
      specialization: pickFirstNonEmpty(base.specialization, row.designation),
      signature: base.signature || base.doctorSignature || null,
    };
  } catch (err) {
    logger.warn('Physician enrichment lookup failed', {
      physicianId,
      error: err.message,
    });

    return {
      ...base,
      title: pickFirstNonEmpty(base.title, 'MD'),
    };
  }
}

async function resolveOrCreateTemplate(client, templateName, templateDescription, createdBy) {
  const templateResult = await client.query(
    `SELECT id, template
     FROM "documentTemplate"
     WHERE LOWER(template) = LOWER($1)
     LIMIT 1`,
    [templateName]
  );

  if (templateResult.rows.length > 0) {
    return templateResult.rows[0];
  }

  const insertResult = await client.query(
    `INSERT INTO "documentTemplate" (template, description, "revisedDate", "createdBy")
     VALUES ($1, $2, $3, $4)
     RETURNING id, template`,
    [
      templateName,
      templateDescription,
      new Date().toISOString().slice(0, 7),
      createdBy,
    ]
  );

  return insertResult.rows[0];
}

async function resolveOrCreateTemplateRequirement(client, templateId, tagName) {
  let tagResult = await client.query(
    `SELECT id
     FROM "documentRequirementsTag"
     WHERE LOWER(vartag) = LOWER($1)
     LIMIT 1`,
    [tagName]
  );

  if (tagResult.rows.length === 0) {
    tagResult = await client.query(
      `INSERT INTO "documentRequirementsTag" (vartag)
       VALUES ($1)
       RETURNING id`,
      [tagName]
    );
  }

  const tagId = tagResult.rows[0].id;

  let requirementResult = await client.query(
    `SELECT id
     FROM "documentRequirements"
     WHERE "templateId" = $1
       AND "requirementtagId" = $2
     LIMIT 1`,
    [templateId, tagId]
  );

  if (requirementResult.rows.length === 0) {
    requirementResult = await client.query(
      `INSERT INTO "documentRequirements" ("templateId", "requirementtagId")
       VALUES ($1, $2)
       RETURNING id`,
      [templateId, tagId]
    );
  }

  return requirementResult.rows[0].id;
}

async function resolvePrescriptionTemplateRequirements(client) {
  const templateResult = await client.query(
    `SELECT id, template
     FROM "documentTemplate"
     WHERE LOWER(template) = LOWER($1)
     LIMIT 1`,
    [PRESCRIPTION_TEMPLATE_NAME]
  );

  if (templateResult.rows.length === 0) {
    throw createRouteError(
      500,
      'PRESCRIPTION_TEMPLATE_NOT_INITIALIZED',
      'Prescription template setup is missing. Run post_build_setup.sql first.'
    );
  }

  const templateId = templateResult.rows[0].id;
  const requirementsResult = await client.query(
    `SELECT dr.id as "requirementId", drt.vartag
     FROM "documentRequirements" dr
     JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
     WHERE dr."templateId" = $1`,
    [templateId]
  );

  const requirementByTag = new Map();
  requirementsResult.rows.forEach((row) => {
    requirementByTag.set(normalizeTag(row.vartag), row.requirementId);
  });

  const missingTags = PRESCRIPTION_REQUIRED_TAGS.filter((tag) => !requirementByTag.has(tag));
  if (missingTags.length > 0) {
    throw createRouteError(
      500,
      'PRESCRIPTION_REQUIREMENTS_NOT_INITIALIZED',
      'Prescription requirement mapping is incomplete. Run post_build_setup.sql first.',
      { missingTags }
    );
  }

  return { templateId, requirementByTag };
}

function parseOptionalChatId(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createRouteError(400, 'INVALID_CHAT_ID', 'chatId must be a positive integer.');
  }
  return parsed;
}

async function validatePrescriptionChatAccess(chatId, patientId, medicalId) {
  if (!chatId) return null;

  const chatResult = await db.query(
    `SELECT id, "patientId", "medicalId", status
     FROM "HealthChat"
     WHERE id = $1
     LIMIT 1`,
    [chatId]
  );

  if (chatResult.rows.length === 0) {
    throw createRouteError(404, 'HEALTH_CHAT_NOT_FOUND', 'Health chat ticket was not found.');
  }

  const chat = chatResult.rows[0];
  if (Number(chat.patientId) !== Number(patientId)) {
    throw createRouteError(400, 'HEALTH_CHAT_PATIENT_MISMATCH', 'The health chat ticket does not belong to this patient.');
  }

  if (chat.status !== 'Ongoing' && chat.status !== 'Open') {
    throw createRouteError(400, 'HEALTH_CHAT_NOT_ACTIVE', `Cannot attach prescription to a ${chat.status || 'closed'} ticket.`);
  }

  if (chat.medicalId && Number(chat.medicalId) !== Number(medicalId)) {
    throw createRouteError(403, 'HEALTH_CHAT_FORBIDDEN', 'Only the assigned staff can attach a prescription to this ticket.');
  }

  return chat;
}

async function emitHealthChatMessage(chatId, message, patientId) {
  emitToRoom(`healthchat:${chatId}`, 'healthchat:new-message', {
    chatId,
    message,
    senderType: 'Medical',
  });

  if (patientId) {
    await notifyUser(String(patientId), 'healthchat:new-message', {
      chatId,
      message,
      senderType: 'Medical',
    });
  }
}

async function attachPrescriptionToHealthChat({
  chatId,
  documentId,
  patientId,
  medicalId,
  physicianName,
}) {
  if (!chatId) return;

  const documentPath = `/documents/generated/download/${documentId}`;
  const logText = `Prescription issued by ${physicianName}. View PDF Document: ${documentPath}`;
  const virtualDocumentFileId = `document:${documentId}`;

  const insertResult = await db.query(
    `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "filename", "promptType", "userId", "userType")
     VALUES
       ($1, $2, NULL, 'text', $3, 'Medical'),
       ($1, NULL, $4, 'file', $3, 'Medical')
     RETURNING *`,
    [chatId, logText, medicalId, virtualDocumentFileId]
  );

  for (const row of insertResult.rows) {
    const formatted = await formatMessage(row);
    await emitHealthChatMessage(chatId, formatted, patientId);
  }

  logger.info('Prescription attached to health chat ticket', {
    chatId,
    documentId,
    patientId,
    issuedBy: medicalId,
  });
}

async function getPrescriptionNormalizedRows(documentId) {
  const normalizedDataResult = await db.query(
    `SELECT drt.vartag, dd.data
     FROM "documentData" dd
     JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
     JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
     WHERE dd."documentId" = $1`,
    [documentId]
  );

  if (normalizedDataResult.rows.length === 0) {
    throw createRouteError(404, 'DOCUMENT_DATA_NOT_FOUND', 'No normalized prescription data found for this document.');
  }

  return normalizedDataResult.rows;
}

function toPrescriptionViewPayload(documentMeta, normalizedPrescription, resolvedByName) {
  return {
    id: documentMeta.id,
    patientId: documentMeta.patientId,
    issuedBy: {
      id: documentMeta.issuedBy,
      name: resolvedByName,
      ptrNumber: normalizedPrescription.ptrNumber || null,
      licenseNumber: normalizedPrescription.licenseNumber || null,
      signature: normalizedPrescription.doctorSignature || null,
    },
    diagnosis: normalizedPrescription.diagnosis || 'Not specified',
    complaints: normalizedPrescription.chiefComplaints || '',
    peFindings: normalizedPrescription.peFindings || '',
    medications: normalizedPrescription.medications || [],
    instructions: {
      specialInstructions: normalizedPrescription.specialInstructions || '',
      advice: normalizedPrescription.advice || '',
    },
    followUpDate: normalizedPrescription.followUpDate || null,
    expiredAt: documentMeta.expired_at,
    createdAt: documentMeta.created_at,
    downloadPath: `/documents/generated/download/${documentMeta.id}`,
  };
}

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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view this patient\'s documents.' });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view this patient\'s documents.' });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
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
 * DELETE /documents/required/:documentId/cancel
 * Cancel a document request (delete the submission)
 * Query: patientId (required)
 * 
 * BEHAVIOR:
 * - Deletes the document submission
 * - Can only cancel Requested or Pending submissions
 * - Cannot cancel Recorded or Archived documents
 * - Document type becomes "Missing" again
 */
router.delete('/required/:documentId/cancel', jwtProtect('medical'), async (req, res) => {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { documentId } = req.params;
    const { patientId } = req.query;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
    }

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
    }

    // Find the current submission
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

    // Only allow canceling Requested or Pending submissions
    if (existing.status !== 'Requested' && existing.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'CANNOT_CANCEL', 
        message: 'Can only cancel Requested or Pending documents. Use Archive for Recorded documents.' 
      });
    }

    // Delete the submission
    await client.query(
      `DELETE FROM "patientRawDocument" WHERE id = $1`,
      [existing.id]
    );

    await client.query('COMMIT');

    // Notify patient
    try {
      await notifyUser(
        String(patientId),
        'document:cancelled',
        {
          documentId,
          label: tagLabel,
          message: `The document request for "${tagLabel}" has been cancelled by staff.`,
        }
      );
    } catch (notifErr) {
      logger.warn('Document cancellation notification failed', { error: notifErr.message });
    }

    logger.info('Document request cancelled', {
      documentId,
      patientId,
      cancelledBy: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error cancelling document', { error: err.message });
    res.status(500).json({ error: 'CANCEL_FAILED', message: err.message });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
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

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_manage, patientId);
    if (!isPermitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to manage this patient\'s documents.' });
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

    const { permitted } = await isMedicalPermitted(req.user.id, permissions.document_allow_generate);
    if (!permitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view document templates.' });
    }

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

    const { permitted } = await isMedicalPermitted(req.user.id, permissions.document_allow_generate);
    if (!permitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view document templates.' });
    }

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
    
    const { permitted } = await isMedicalPermitted(req.user.id, permissions.document_allow_generate);
    if (!permitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to generate documents.' });
    }

    const template = docGen.getTemplate(docType);
    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }

    const enrichedData = {
      ...data,
      physician: data?.physician || { id: req.user.id },
    };

    if (docType === PRESCRIPTION_DOC_TYPE) {
      enrichedData.patient = await normalizePrescriptionPatientData(data?.patient?.id, enrichedData.patient);
    }

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
    const { patientId, data, chatId: requestChatId } = req.body;
    const scopedPatientId = patientId || data?.patient?.id;
    const scopedChatId = parseOptionalChatId(
      requestChatId || data?.healthChatTicketId || data?.chatId
    );

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_generate, scopedPatientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to generate documents for this patient.' });
    }

    const template = docGen.getTemplate(docType);
    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }

    const shouldPersist = docGen.shouldPersist(docType);

    const enrichedData = {
      ...data,
      patient: { ...data?.patient, id: scopedPatientId },
      physician: data?.physician || { id: req.user.id },
    };

    if (docType === PRESCRIPTION_DOC_TYPE) {
      enrichedData.patient = await normalizePrescriptionPatientData(scopedPatientId, enrichedData.patient);
    }

    enrichedData.physician = await resolvePhysicianData(req.user.id, enrichedData.physician);

    let prescriptionRequirementValues = null;
    let normalizedPrescriptionPhysician = null;
    let validatedChat = null;
    if (shouldPersist && docType === PRESCRIPTION_DOC_TYPE) {
      if (scopedChatId) {
        validatedChat = await validatePrescriptionChatAccess(
          scopedChatId,
          scopedPatientId,
          req.user.id
        );
      }

      const prescriptionPayload = buildPrescriptionRequirementValues(enrichedData);
      prescriptionRequirementValues = prescriptionPayload.requirementValues;
      enrichedData.prescription = prescriptionPayload.normalizedPrescription;
      normalizedPrescriptionPhysician = prescriptionPayload.normalizedPhysician;
      enrichedData.physician = {
        ...enrichedData.physician,
        ...normalizedPrescriptionPhysician,
      };
    }

    if (shouldPersist) {
      if (!scopedPatientId) {
        return res.status(400).json({ error: 'PATIENT_ID_REQUIRED' });
      }

      const generatedDocument = await docGen.generateDocumentBuffer(
        docType,
        enrichedData
      );
      const actualPatientId = scopedPatientId;
      const client = await connect();
      let documentId;

      try {
        await client.query('BEGIN');

        if (docType === PRESCRIPTION_DOC_TYPE) {
          const prescriptionTemplate = await resolvePrescriptionTemplateRequirements(client);

          const docResult = await client.query(
            `INSERT INTO "PatientDocuments" ("patientId", "templateId", "issuedBy", "expired_at")
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [actualPatientId, prescriptionTemplate.templateId, req.user.id, data?.expiredAt || null]
          );

          documentId = docResult.rows[0].id;

          for (const tag of PRESCRIPTION_REQUIRED_TAGS) {
            const requirementId = prescriptionTemplate.requirementByTag.get(tag);
            await client.query(
              `INSERT INTO "documentData" ("documentId", "requirementId", "data")
               VALUES ($1, $2, $3)`,
              [documentId, requirementId, prescriptionRequirementValues[tag]]
            );
          }

          logger.info('Prescription generated and normalized rows stored', {
            documentId,
            patientId: actualPatientId,
            issuedBy: req.user.id,
            templateId: prescriptionTemplate.templateId,
            requirementCount: PRESCRIPTION_REQUIRED_TAGS.length,
          });
        } else {
          const templateRecord = await resolveOrCreateTemplate(
            client,
            docType,
            template.displayName,
            req.user.id
          );

          const payloadRequirementId = await resolveOrCreateTemplateRequirement(
            client,
            templateRecord.id,
            GENERIC_BINARY_TAG
          );

          const docResult = await client.query(
            `INSERT INTO "PatientDocuments" ("patientId", "templateId", "issuedBy", "expired_at")
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [actualPatientId, templateRecord.id, req.user.id, data?.expiredAt || null]
          );

          documentId = docResult.rows[0].id;

          await client.query(
            `INSERT INTO "documentData" ("documentId", "requirementId", "data")
             VALUES ($1, $2, $3)`,
            [documentId, payloadRequirementId, generatedDocument.buffer.toString('base64')]
          );

          logger.info('Generated document payload stored', {
            documentId,
            docType,
            patientId: actualPatientId,
            issuedBy: req.user.id,
            requirementTag: GENERIC_BINARY_TAG,
          });
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Notify patient about the new document
      const physicianName = enrichedData.physician?.firstName
        ? `${enrichedData.physician.firstName} ${enrichedData.physician.lastName}`.trim()
        : 'your healthcare provider';

      if (docType === PRESCRIPTION_DOC_TYPE && validatedChat?.id) {
        try {
          await attachPrescriptionToHealthChat({
            chatId: validatedChat.id,
            documentId,
            patientId: actualPatientId,
            medicalId: req.user.id,
            physicianName,
          });
        } catch (chatErr) {
          logger.warn('Prescription generated but health chat attachment failed', {
            documentId,
            chatId: validatedChat.id,
            error: chatErr.message,
          });
        }
      }

      try {
        await notifyUser(
          String(actualPatientId),
          'document:new',
          {
            documentId,
            templateType: normalizeTag(docType),
            issuedBy: physicianName,
            message: `A new ${template.displayName.toLowerCase()} has been issued for you by ${physicianName}.`,
          }
        );
      } catch (notifErr) {
        logger.warn('Document notification failed', { error: notifErr.message, documentId });
      }

      res.json({
        success: true,
        documentId,
        filename: generatedDocument.filename,
        metadata: generatedDocument.metadata,
      });
    } else {
      logger.info('Document generated (stream only)', {
        docType,
        userId: req.user.id,
        patientId: enrichedData.patient?.id,
      });

      await docGen.downloadDocument(docType, enrichedData, res);
    }
  } catch (err) {
    logger.error('Document generation failed', {
      error: err.message,
      code: err.errorCode,
      details: err.details,
    });
    if (!res.headersSent) {
      const statusCode = err.statusCode || 500;
      const errorCode = err.errorCode || 'GENERATION_FAILED';
      const payload = { error: errorCode, message: err.message };
      if (err.details) payload.details = err.details;
      res.status(statusCode).json(payload);
    }
  }
});

// ============================================================
// GENERATED DOCUMENTS - DOCUMENT ACCESS
// ============================================================

/**
 * GET /documents/generated/patient/:patientId
 * List all generated documents for a patient (all templates)
 */
router.get('/generated/patient/:patientId', jwtProtect('medical'), async (req, res) => {
  try {
    const { patientId } = req.params;

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view documents for this patient.' });
    }

    const result = await db.query(
      `SELECT pd.id, pd."patientId", pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType", dt.description,
              up_patient.first_name as "patientFirstName", up_patient.last_name as "patientLastName",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up_patient ON pd."patientId" = up_patient.id
       LEFT JOIN "UsersPersonal" up_issuer ON pd."issuedBy" = up_issuer.id
       WHERE pd."patientId" = $1
       ORDER BY pd."created_at" DESC`,
      [patientId]
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
    logger.error('Generated document list for patient failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/generated/prescription/patient/:patientId
 * List normalized prescriptions for a patient
 */
router.get('/generated/prescription/patient/:patientId', jwtProtect('medical'), async (req, res) => {
  try {
    const { patientId } = req.params;

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view prescriptions for this patient.' });
    }

    const result = await db.query(
      `SELECT pd.id, pd."patientId", pd."issuedBy", pd."expired_at", pd."created_at",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName",
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'vartag', drt.vartag,
                    'data', dd.data
                  )
                ) FILTER (WHERE dd.id IS NOT NULL),
                '[]'::json
              ) as "normalizedRows"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON dt.id = pd."templateId"
       LEFT JOIN "UsersPersonal" up_issuer ON up_issuer.id = pd."issuedBy"
       LEFT JOIN "documentData" dd ON dd."documentId" = pd.id
       LEFT JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
       LEFT JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
       WHERE pd."patientId" = $1 AND LOWER(dt.template) = LOWER($2)
       GROUP BY pd.id, pd."patientId", pd."issuedBy", pd."expired_at", pd."created_at",
                up_issuer.first_name, up_issuer.last_name
       ORDER BY pd."created_at" DESC`,
      [patientId, PRESCRIPTION_TEMPLATE_NAME]
    );

    const prescriptions = result.rows
      .map((row) => {
        try {
          const normalizedRows = Array.isArray(row.normalizedRows) ? row.normalizedRows : [];
          const normalized = parsePrescriptionRequirementRows(normalizedRows);
          const issuedByName = `${row.issuedByFirstName || ''} ${row.issuedByLastName || ''}`.trim() || 'Unknown';

          return toPrescriptionViewPayload(row, normalized, issuedByName);
        } catch (parseErr) {
          logger.warn('Skipping malformed normalized prescription row during list', {
            documentId: row.id,
            error: parseErr.message,
          });
          return null;
        }
      })
      .filter(Boolean);

    res.json({ success: true, prescriptions });
  } catch (err) {
    logger.error('Normalized prescription list failed', { error: err.message });
    res.status(500).json({ error: 'LIST_FAILED', message: err.message });
  }
});

/**
 * GET /documents/generated/prescription/view/:documentId
 * View one normalized prescription document payload
 */
router.get('/generated/prescription/view/:documentId', jwtProtect('medical'), async (req, res) => {
  try {
    const { documentId } = req.params;

    const docMetaResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."issuedBy", pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON dt.id = pd."templateId"
       LEFT JOIN "UsersPersonal" up_issuer ON up_issuer.id = pd."issuedBy"
       WHERE pd.id = $1
       LIMIT 1`,
      [documentId]
    );

    if (docMetaResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const documentMeta = docMetaResult.rows[0];
    if (documentMeta.templateType !== PRESCRIPTION_DOC_TYPE) {
      return res.status(400).json({ error: 'NOT_A_PRESCRIPTION', message: 'Requested document is not a prescription.' });
    }

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, documentMeta.patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view this prescription.' });
    }

    const normalizedRows = await getPrescriptionNormalizedRows(documentId);
    const normalized = parsePrescriptionRequirementRows(normalizedRows);
    const issuedByName = `${documentMeta.issuedByFirstName || ''} ${documentMeta.issuedByLastName || ''}`.trim() || 'Unknown';

    res.json({
      success: true,
      prescription: toPrescriptionViewPayload(documentMeta, normalized, issuedByName),
    });
  } catch (err) {
    logger.error('Normalized prescription view failed', {
      error: err.message,
      code: err.errorCode,
      details: err.details,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.errorCode || 'VIEW_FAILED',
      message: err.message,
      details: err.details || null,
    });
  }
});

/**
 * GET /documents/generated/download/:documentId
 * Download a generated document for staff (permission-scoped by patient)
 */
router.get('/generated/download/:documentId', jwtProtect('medical'), async (req, res) => {
  try {
    const { documentId } = req.params;

    const docResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."issuedBy", pd."created_at",
              LOWER(dt.template) as "templateType"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       WHERE pd.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const docMeta = docResult.rows[0];
    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, docMeta.patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to download this document.' });
    }

    if (docMeta.templateType === PRESCRIPTION_DOC_TYPE) {
      const normalizedDataResult = await db.query(
        `SELECT drt.vartag, dd.data
         FROM "documentData" dd
         JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
         JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
         WHERE dd."documentId" = $1`,
        [documentId]
      );

      if (normalizedDataResult.rows.length > 0) {
        try {
          const prescription = parsePrescriptionRequirementRows(normalizedDataResult.rows);
          const patient = await normalizePrescriptionPatientData(docMeta.patientId, { id: docMeta.patientId });
          const physician = await resolvePhysicianData(docMeta.issuedBy, {
            id: docMeta.issuedBy,
            licenseNo: prescription.licenseNumber,
            ptrNo: prescription.ptrNumber,
            signature: prescription.doctorSignature,
          });

          const regenerated = await docGen.generateDocumentBuffer(PRESCRIPTION_DOC_TYPE, {
            patient,
            physician,
            issuedDate: toDateInput(docMeta.created_at),
            prescription,
          });

          return sendPdfBuffer(res, regenerated.buffer, regenerated.filename || `${docMeta.templateType}_${documentId}.pdf`);
        } catch (normalizedErr) {
          logger.warn('Prescription normalized download regeneration failed, using legacy payload fallback', {
            documentId,
            error: normalizedErr.message,
          });
        }
      }
    }

    const dataResult = await db.query(
      `SELECT dd.data
       FROM "documentData" dd
       LEFT JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
       LEFT JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
       WHERE dd."documentId" = $1
         AND (
           dd."requirementId" IS NULL
           OR LOWER(COALESCE(drt.vartag, '')) = $2
         )
       ORDER BY CASE WHEN dd."requirementId" IS NULL THEN 0 ELSE 1 END, dd.id ASC
       LIMIT 1`,
      [documentId, GENERIC_BINARY_TAG]
    );

    if (dataResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_DATA_NOT_FOUND' });
    }

    const pdfBuffer = Buffer.from(dataResult.rows[0].data, 'base64');
    const filename = `${docMeta.templateType}_${documentId}.pdf`;
    sendPdfBuffer(res, pdfBuffer, filename);
  } catch (err) {
    logger.error('Generated document download failed', { error: err.message });
    res.status(500).json({ error: 'DOWNLOAD_FAILED', message: err.message });
  }
});

/**
 * GET /documents/:docType/patient/:patientId
 * List documents of a specific type for a patient
 */
router.get('/:docType/patient/:patientId', jwtProtect('medical'), async (req, res) => {
  try {
    const { docType, patientId } = req.params;

    const isPermitted = await isMedicalPermittedPatientBased(req.user.id, permissions.document_allow_view, patientId);
    if (!isPermitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view documents for this patient.' });
    }

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType", dt.description,
              up.first_name as "issuedByFirstName", up.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."issuedBy" = up.id
       WHERE pd."patientId" = $1 AND LOWER(dt.template) = LOWER($2)
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

    const { permitted } = await isMedicalPermitted(req.user.id, permissions.document_allow_view);
    if (!permitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view documents.' });
    }

    const result = await db.query(
      `SELECT DISTINCT pd."patientId",
              up.first_name, up.last_name,
              COUNT(pd.id) as "documentCount",
              MAX(pd."created_at") as "lastDocumentAt"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."patientId" = up.id
       WHERE LOWER(dt.template) = LOWER($1)
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

    const { permitted } = await isMedicalPermitted(req.user.id, permissions.document_allow_view);
    if (!permitted) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions to view documents.' });
    }

    const result = await db.query(
      `SELECT pd.id, pd."patientId", pd."templateId", pd."issuedBy",
              pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType", dt.description,
              up_patient.first_name as "patientFirstName", up_patient.last_name as "patientLastName",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up_patient ON pd."patientId" = up_patient.id
       LEFT JOIN "UsersPersonal" up_issuer ON pd."issuedBy" = up_issuer.id
       WHERE LOWER(dt.template) = LOWER($1)
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
