const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');
const { promoteFile, deleteFile } = require('../../../config/multer.js');
const docGen = require('../../../services/doc-generate-module/index.js');
const {
  PRESCRIPTION_DOC_TYPE,
  GENERIC_BINARY_TAG,
  assertPdfBuffer: assertPrescriptionPdfBuffer,
  createPdfAuditRecord: createPrescriptionPdfAuditRecord,
  parsePrescriptionRequirementRows,
} = require('../../../services/doc-generate-module/prescription-normalized.js');
const {
  MEDICAL_CERTIFICATE_DOC_TYPE,
  assertPdfBuffer: assertMedicalCertificatePdfBuffer,
  createPdfAuditRecord: createMedicalCertificatePdfAuditRecord,
  parseMedicalCertificateRequirementRows,
} = require('../../../services/doc-generate-module/medical-certificate-normalized.js');
const { notifyUser } = require('../../../config/sockets/socket-emitter.js');
const { checkCredentialsStatus } = require("../../../config/middleware/activeCredential.js");

const router = express.Router();
const configuredCorsOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

function createRouteError(statusCode, errorCode, message, details = null) {
  const err = new Error(message || errorCode);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  if (details) err.details = details;
  return err;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
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

function applyPdfCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return;

  if (configuredCorsOrigins.length > 0 && !configuredCorsOrigins.includes(requestOrigin)) {
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Disposition, Content-Length');
  res.setHeader('Vary', 'Origin');
}

function sendPdfBuffer(req, res, buffer, filename = 'document.pdf', disposition = 'inline', context = {}) {
  assertPdfBufferAnyTemplate(buffer, {
    templateType: context.templateType || 'unknown',
    stage: context.stage || 'patient-stream',
  });

  const resolvedDisposition = disposition === 'attachment' ? 'attachment' : 'inline';
  const resolvedFilename = pickFirstNonEmpty(filename, 'document.pdf');

  applyPdfCorsHeaders(req, res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${resolvedDisposition}; filename="${resolvedFilename}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', buffer.length);

  logger.info('Patient PDF stream prepared', {
    patientId: req.user?.id || null,
    path: req.originalUrl,
    templateType: context.templateType || 'unknown',
    stage: context.stage || 'patient-stream',
    disposition: resolvedDisposition,
    filename: resolvedFilename,
    bufferLength: buffer.length,
  });

  res.end(buffer);
}

function assertPdfBufferAnyTemplate(buffer, context = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createRouteError(
      500,
      'INVALID_PDF_BUFFER',
      'Generated document buffer is empty or missing.',
      { templateType: context.templateType || 'unknown', stage: context.stage || 'unknown' }
    );
  }

  const header = buffer.slice(0, 4).toString('utf8');
  if (header !== '%PDF') {
    throw createRouteError(
      500,
      'INVALID_PDF_BUFFER',
      'Generated document buffer is not a valid PDF payload.',
      {
        templateType: context.templateType || 'unknown',
        stage: context.stage || 'unknown',
        header,
      }
    );
  }
}

async function resolvePatientDocumentMeta(documentId, patientId) {
  const docResult = await db.query(
    `SELECT pd.id, pd."patientId", pd."issuedBy", pd."created_at",
            REPLACE(LOWER(dt.template), ' ', '-') as "templateType", dt.description
     FROM "PatientDocuments" pd
     JOIN "documentTemplate" dt ON pd."templateId" = dt.id
     WHERE pd.id = $1
     LIMIT 1`,
    [documentId]
  );

  if (docResult.rows.length === 0) {
    throw createRouteError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  }

  const documentMeta = docResult.rows[0];
  if (Number(documentMeta.patientId) !== Number(patientId)) {
    throw createRouteError(403, 'FORBIDDEN', 'This document does not belong to the authenticated patient.');
  }

  return documentMeta;
}

async function resolvePatientData(patientId) {
  const fallback = {
    id: patientId,
    firstName: 'Unknown',
    lastName: '',
    age: 'Unknown',
    sex: 'Unknown',
  };

  if (!patientId) return fallback;

  try {
    const result = await db.query(
      `SELECT id, first_name, middle_name, last_name, suffix, date_of_birth, sex
       FROM "UsersPersonal"
       WHERE id = $1`,
      [patientId]
    );

    if (result.rows.length === 0) return fallback;

    const row = result.rows[0];
    const dob = row.date_of_birth ? new Date(row.date_of_birth) : null;
    let age = 'Unknown';
    if (dob && !Number.isNaN(dob.getTime())) {
      const today = new Date();
      let calculatedAge = today.getFullYear() - dob.getFullYear();
      if (
        today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
      ) {
        calculatedAge -= 1;
      }
      if (calculatedAge >= 0) age = String(calculatedAge);
    }

    return {
      id: row.id,
      firstName: pickFirstNonEmpty(row.first_name, fallback.firstName),
      middleName: pickFirstNonEmpty(row.middle_name),
      lastName: pickFirstNonEmpty(row.last_name),
      suffix: pickFirstNonEmpty(row.suffix),
      dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : undefined,
      age,
      sex: pickFirstNonEmpty(row.sex, fallback.sex),
    };
  } catch (err) {
    logger.warn('Patient prescription enrichment lookup failed', {
      patientId,
      error: err.message,
    });
    return fallback;
  }
}

async function resolvePhysicianData(physicianId) {
  const fallback = {
    id: physicianId,
    firstName: '',
    lastName: '',
    title: 'MD',
    ptrNo: '',
    licenseNo: '',
    signature: null,
    specialization: '',
  };

  if (!physicianId) return fallback;

  try {
    const result = await db.query(
      `SELECT up.first_name, up.last_name,
              mp.title, mp.designation
       FROM "UsersPersonal" up
      LEFT JOIN active_medical_personnel mp ON mp."userId" = up.id
       WHERE up.id = $1`,
      [physicianId]
    );

    if (result.rows.length === 0) return fallback;
    const row = result.rows[0];
    return {
      ...fallback,
      firstName: pickFirstNonEmpty(row.first_name),
      lastName: pickFirstNonEmpty(row.last_name),
      title: pickFirstNonEmpty(row.title, 'MD'),
      specialization: pickFirstNonEmpty(row.designation),
    };
  } catch (err) {
    logger.warn('Physician prescription enrichment lookup failed', {
      physicianId,
      error: err.message,
    });
    return fallback;
  }
}

async function getPrescriptionNormalizedRows(documentId) {
  const result = await db.query(
    `SELECT drt.vartag, dd.data
     FROM "documentData" dd
     JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
     JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
     WHERE dd."documentId" = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    const err = new Error('No normalized prescription data found for this document.');
    err.statusCode = 404;
    err.errorCode = 'DOCUMENT_DATA_NOT_FOUND';
    throw err;
  }

  return result.rows;
}

function toPrescriptionViewPayload(documentMeta, normalized) {
  return {
    id: documentMeta.id,
    patientId: documentMeta.patientId,
    issuedBy: {
      id: documentMeta.issuedBy,
      name: documentMeta.issuedByName || 'Unknown',
      ptrNumber: normalized.ptrNumber || null,
      licenseNumber: normalized.licenseNumber || null,
      signature: normalized.doctorSignature || null,
    },
    diagnosis: normalized.diagnosis || 'Not specified',
    complaints: normalized.chiefComplaints || '',
    peFindings: normalized.peFindings || '',
    medications: normalized.medications || [],
    instructions: {
      specialInstructions: normalized.specialInstructions || '',
      advice: normalized.advice || '',
    },
    followUpDate: normalized.followUpDate || null,
    expiredAt: documentMeta.expired_at,
    createdAt: documentMeta.created_at,
    downloadPath: `/documents/prescription/download/${documentMeta.id}`,
  };
}

async function getMedicalCertificateNormalizedRows(documentId) {
  const result = await db.query(
    `SELECT drt.vartag, dd.data
     FROM "documentData" dd
     JOIN "documentRequirements" dr ON dr.id = dd."requirementId"
     JOIN "documentRequirementsTag" drt ON drt.id = dr."requirementtagId"
     WHERE dd."documentId" = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    const err = new Error('No normalized medical certificate data found for this document.');
    err.statusCode = 404;
    err.errorCode = 'DOCUMENT_DATA_NOT_FOUND';
    throw err;
  }

  return result.rows;
}

async function buildPatientDocumentPdfBuffer(documentMeta, patientId) {
  const documentId = documentMeta.id;

  if (documentMeta.templateType === PRESCRIPTION_DOC_TYPE) {
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
        const patient = await resolvePatientData(patientId);
        const physician = await resolvePhysicianData(documentMeta.issuedBy);
        physician.licenseNo = prescription.licenseNumber || physician.licenseNo;
        physician.ptrNo = prescription.ptrNumber || physician.ptrNo;
        physician.signature = prescription.doctorSignature || physician.signature;

        const regenerated = await docGen.generateDocumentBuffer(PRESCRIPTION_DOC_TYPE, {
          patient,
          physician,
          issuedDate: toDateInput(documentMeta.created_at),
          prescription,
        });

        assertPrescriptionPdfBuffer(regenerated.buffer, {
          templateType: PRESCRIPTION_DOC_TYPE,
          stage: 'patient-download',
        });

        return {
          buffer: regenerated.buffer,
          filename: regenerated.filename || 'document.pdf',
          mode: 'normalized-regenerated',
          audit: createPrescriptionPdfAuditRecord(regenerated.buffer, {
            templateType: PRESCRIPTION_DOC_TYPE,
            documentId,
            storagePath: `PatientDocuments/${documentId}`,
          }),
        };
      } catch (normalizedErr) {
        logger.warn('Patient prescription regeneration failed, using legacy payload fallback', {
          documentId,
          patientId,
          error: normalizedErr.message,
        });
      }
    }
  }

  if (documentMeta.templateType === MEDICAL_CERTIFICATE_DOC_TYPE) {
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
        const certificate = parseMedicalCertificateRequirementRows(normalizedDataResult.rows);
        const patient = await resolvePatientData(patientId);
        const physician = await resolvePhysicianData(documentMeta.issuedBy);
        physician.licenseNo = certificate.licenseNumber || physician.licenseNo;
        physician.ptrNo = certificate.ptrNumber || physician.ptrNo;
        physician.signature = certificate.doctorSignature || physician.signature;

        const regenerated = await docGen.generateDocumentBuffer(MEDICAL_CERTIFICATE_DOC_TYPE, {
          patient,
          physician,
          issuedDate: toDateInput(documentMeta.created_at),
          certificate,
        });

        assertMedicalCertificatePdfBuffer(regenerated.buffer, {
          templateType: MEDICAL_CERTIFICATE_DOC_TYPE,
          stage: 'patient-download',
        });

        return {
          buffer: regenerated.buffer,
          filename: regenerated.filename || 'document.pdf',
          mode: 'normalized-regenerated-medical-certificate',
          audit: createMedicalCertificatePdfAuditRecord(regenerated.buffer, {
            templateType: MEDICAL_CERTIFICATE_DOC_TYPE,
            documentId,
            storagePath: `PatientDocuments/${documentId}`,
          }),
        };
      } catch (normalizedErr) {
        logger.warn('Patient medical certificate regeneration failed, using legacy payload fallback', {
          documentId,
          patientId,
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
    throw createRouteError(404, 'DOCUMENT_DATA_NOT_FOUND', 'Document PDF payload was not found.');
  }

  const pdfBuffer = Buffer.from(dataResult.rows[0].data, 'base64');
  assertPdfBufferAnyTemplate(pdfBuffer, {
    templateType: documentMeta.templateType,
    stage: 'legacy-payload-download',
  });

  let audit = null;
  if (documentMeta.templateType === PRESCRIPTION_DOC_TYPE) {
    audit = createPrescriptionPdfAuditRecord(pdfBuffer, {
      templateType: PRESCRIPTION_DOC_TYPE,
      documentId,
      storagePath: `PatientDocuments/${documentId}`,
    });
  } else if (documentMeta.templateType === MEDICAL_CERTIFICATE_DOC_TYPE) {
    audit = createMedicalCertificatePdfAuditRecord(pdfBuffer, {
      templateType: MEDICAL_CERTIFICATE_DOC_TYPE,
      documentId,
      storagePath: `PatientDocuments/${documentId}`,
    });
  }

  return {
    buffer: pdfBuffer,
    filename: `${documentMeta.templateType}_${documentId}.pdf`,
    mode: 'legacy-payload',
    audit,
  };
}

function toMedicalCertificateViewPayload(documentMeta, normalized) {
  return {
    id: documentMeta.id,
    patientId: documentMeta.patientId,
    issuedBy: {
      id: documentMeta.issuedBy,
      name: documentMeta.issuedByName || 'Unknown',
      ptrNumber: normalized.ptrNumber || null,
      licenseNumber: normalized.licenseNumber || null,
      signature: normalized.doctorSignature || null,
    },
    purpose: normalized.purpose || 'General Medical Evaluation',
    diagnosis: normalized.diagnosis || 'Not specified',
    recommendations: normalized.recommendations || '',
    validity: {
      validFrom: normalized.validFrom || null,
      validUntil: normalized.validUntil || null,
    },
    restrictions: normalized.restrictions || '',
    remarks: normalized.remarks || '',
    expiredAt: documentMeta.expired_at,
    createdAt: documentMeta.created_at,
    downloadPath: `/documents/medical-certificate/download/${documentMeta.id}`,
  };
}

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
router.get('/requests', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
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
router.post('/requests/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
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
      `SELECT prd.id, prd.status, prd.file, prd."recordedBy", rdt.label
       FROM "rawDocumentTag" rdt
       LEFT JOIN "patientRawDocument" prd ON
         prd."documentTagId" = rdt.id AND prd."patientId" = $2 
         AND prd.status NOT IN ('Archived', 'Rejected')
       WHERE rdt.id = $1 AND rdt."isActive" = true
       ORDER BY prd."created_at" DESC
       LIMIT 1`,
      [documentId, patientId]
    );

    logger.info('Document submission query result:', {
      documentId,
      patientId,
      resultCount: existingResult.rows.length,
      existingRow: existingResult.rows[0]
    });

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

    // Notify the staff member who requested this document
    const requestedBy = existing.recordedBy;
    logger.info('Document submission - checking notification', {
      documentId,
      patientId,
      submissionId,
      requestedBy,
      existingRecordedBy: existing.recordedBy
    });
    
    if (requestedBy) {
      try {
        // Get patient name for the notification
        const patientResult = await db.query(
          `SELECT first_name, last_name FROM "UsersPersonal" WHERE id = $1`,
          [patientId]
        );
        const patient = patientResult.rows[0];
        const patientName = patient
          ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'A patient'
          : 'A patient';

        logger.info('Sending document:submitted notification', {
          requestedBy,
          patientName,
          documentLabel: existing.label
        });

        await notifyUser(
          String(requestedBy),
          'document:submitted',
          {
            documentId,
            label: existing.label,
            submissionId,
            patientId,
            patientName,
            message: `${patientName} has submitted the requested document: ${existing.label}`,
          }
        );
        
        logger.info('Document:submitted notification sent successfully', { requestedBy });
      } catch (notifErr) {
        logger.error('Document submission notification failed', { 
          error: notifErr.message, 
          stack: notifErr.stack,
          documentId, 
          requestedBy 
        });
      }
    } else {
      logger.warn('No requestedBy found for document submission notification', {
        documentId,
        patientId,
        existingData: existing
      });
    }

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
router.get('/my', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  try {
    logger.debug('Fetching patient documents', { patientId: req.user.id });
    const patientId = req.user.id;

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType", dt.description,
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
 * GET /documents/my/prescription/view/:documentId
 * View one normalized prescription document payload for the authenticated patient
 */
router.get('/my/prescription/view/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    const docResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."issuedBy", pd."expired_at", pd."created_at",
              REPLACE(LOWER(dt.template), ' ', '-') as "templateType",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up_issuer ON up_issuer.id = pd."issuedBy"
       WHERE pd.id = $1 AND pd."patientId" = $2
       LIMIT 1`,
      [documentId, patientId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const docMeta = docResult.rows[0];
    if (docMeta.templateType !== PRESCRIPTION_DOC_TYPE) {
      return res.status(400).json({ error: 'NOT_A_PRESCRIPTION', message: 'Requested document is not a prescription.' });
    }

    const normalizedRows = await getPrescriptionNormalizedRows(documentId);
    const normalized = parsePrescriptionRequirementRows(normalizedRows);

    const payload = toPrescriptionViewPayload(
      {
        ...docMeta,
        issuedByName: `${docMeta.issuedByFirstName || ''} ${docMeta.issuedByLastName || ''}`.trim() || 'Unknown',
      },
      normalized
    );

    res.json({ success: true, prescription: payload });
  } catch (err) {
    logger.error('Patient normalized prescription view failed', {
      error: err.message,
      code: err.errorCode,
    });

    res.status(err.statusCode || 500).json({
      error: err.errorCode || 'VIEW_FAILED',
      message: err.message,
    });
  }
});

/**
 * GET /documents/my/medical-certificate/view/:documentId
 * View one normalized medical certificate payload for the authenticated patient
 */
router.get('/my/medical-certificate/view/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    const docResult = await db.query(
      `SELECT pd.id, pd."patientId", pd."issuedBy", pd."expired_at", pd."created_at",
              REPLACE(LOWER(dt.template), ' ', '-') as "templateType",
              up_issuer.first_name as "issuedByFirstName", up_issuer.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up_issuer ON up_issuer.id = pd."issuedBy"
       WHERE pd.id = $1 AND pd."patientId" = $2
       LIMIT 1`,
      [documentId, patientId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    const docMeta = docResult.rows[0];
    if (docMeta.templateType !== MEDICAL_CERTIFICATE_DOC_TYPE) {
      return res.status(400).json({ error: 'NOT_A_MEDICAL_CERTIFICATE', message: 'Requested document is not a medical certificate.' });
    }

    const normalizedRows = await getMedicalCertificateNormalizedRows(documentId);
    const normalized = parseMedicalCertificateRequirementRows(normalizedRows);

    const payload = toMedicalCertificateViewPayload(
      {
        ...docMeta,
        issuedByName: `${docMeta.issuedByFirstName || ''} ${docMeta.issuedByLastName || ''}`.trim() || 'Unknown',
      },
      normalized
    );

    res.json({ success: true, certificate: payload });
  } catch (err) {
    logger.error('Patient normalized medical certificate view failed', {
      error: err.message,
      code: err.errorCode,
    });

    res.status(err.statusCode || 500).json({
      error: err.errorCode || 'VIEW_FAILED',
      message: err.message,
    });
  }
});

/**
 * Streams a patient-owned generated PDF for a specific template route.
 */
async function streamTemplatePdfForPatient(req, res, expectedTemplateType, disposition = 'inline') {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    const documentMeta = await resolvePatientDocumentMeta(documentId, patientId);
    if (documentMeta.templateType !== expectedTemplateType) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' });
    }

    const pdfResult = await buildPatientDocumentPdfBuffer(documentMeta, patientId);
    sendPdfBuffer(req, res, pdfResult.buffer, pdfResult.filename || 'document.pdf', disposition, {
      templateType: expectedTemplateType,
      stage: 'patient-template-stream',
    });

    logger.info('Patient template document streamed', {
      documentId,
      patientId,
      templateType: expectedTemplateType,
      disposition,
      mode: pdfResult.mode,
      auditPath: pdfResult.audit?.filePath || pdfResult.audit?.storagePath || null,
      pdfHash: pdfResult.audit?.sha256 || null,
      pdfBytes: pdfResult.audit?.byteLength || pdfResult.buffer.length,
    });
  } catch (err) {
    logger.error('Patient template document stream failed', {
      error: err.message,
      code: err.errorCode,
      details: err.details,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.errorCode || 'DOWNLOAD_FAILED',
      message: err.message,
      details: err.details || null,
    });
  }
}

/**
 * GET /documents/prescription/view/:documentId
 * View a patient-owned prescription PDF (inline stream)
 */
router.get('/prescription/view/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: prescription ${req.params.documentId}`);
  await streamTemplatePdfForPatient(req, res, PRESCRIPTION_DOC_TYPE, 'inline');
});

/**
 * GET /documents/prescription/:documentId
 * Compatibility alias for inline prescription view
 */
router.get('/prescription/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: prescription ${req.params.documentId} (alias)`);
  await streamTemplatePdfForPatient(req, res, PRESCRIPTION_DOC_TYPE, 'inline');
});

/**
 * GET /documents/prescription/download/:documentId
 * Download a patient-owned prescription PDF (attachment stream)
 */
router.get('/prescription/download/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: prescription ${req.params.documentId} (download)`);
  await streamTemplatePdfForPatient(req, res, PRESCRIPTION_DOC_TYPE, 'attachment');
});

/**
 * GET /documents/medical-certificate/view/:documentId
 * View a patient-owned medical certificate PDF (inline stream)
 */
router.get('/medical-certificate/view/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: medical-certificate ${req.params.documentId}`);
  await streamTemplatePdfForPatient(req, res, MEDICAL_CERTIFICATE_DOC_TYPE, 'inline');
});

/**
 * GET /documents/medical-certificate/:documentId
 * Compatibility alias for inline medical certificate view
 */
router.get('/medical-certificate/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: medical-certificate ${req.params.documentId} (alias)`);
  await streamTemplatePdfForPatient(req, res, MEDICAL_CERTIFICATE_DOC_TYPE, 'inline');
});

/**
 * GET /documents/medical-certificate/download/:documentId
 * Download a patient-owned medical certificate PDF (attachment stream)
 */
router.get('/medical-certificate/download/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  logger.debug(`[PATIENT] PDF route hit: medical-certificate ${req.params.documentId} (download)`);
  await streamTemplatePdfForPatient(req, res, MEDICAL_CERTIFICATE_DOC_TYPE, 'attachment');
});

/**
 * GET /documents/me/download/:documentId
 * Download a specific generated document as PDF for the authenticated patient
 */
router.get('/my/download/:documentId', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  try {
    const { documentId } = req.params;
    const patientId = req.user.id;

    const documentMeta = await resolvePatientDocumentMeta(documentId, patientId);
    const pdfResult = await buildPatientDocumentPdfBuffer(documentMeta, patientId);

    sendPdfBuffer(req, res, pdfResult.buffer, pdfResult.filename || 'document.pdf', 'attachment', {
      templateType: documentMeta.templateType,
      stage: 'patient-generic-download',
    });

    logger.info('Patient document downloaded', {
      documentId,
      patientId,
      templateType: documentMeta.templateType,
      mode: pdfResult.mode,
      disposition: 'attachment',
      auditPath: pdfResult.audit?.filePath || pdfResult.audit?.storagePath || null,
      pdfHash: pdfResult.audit?.sha256 || null,
      pdfBytes: pdfResult.audit?.byteLength || pdfResult.buffer.length,
    });
  } catch (err) {
    logger.error('Patient document download failed', {
      error: err.message,
      code: err.errorCode,
      details: err.details,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.errorCode || 'DOWNLOAD_FAILED',
      message: err.message,
      details: err.details || null,
    });
  }
});

/**
 * GET /documents/me/:docType
 * List documents of a specific type for the authenticated patient
 */
router.get('/my/:docType', jwtProtect("patient"), checkCredentialsStatus, async (req, res) => {
  try {
    const { docType } = req.params;
    const patientId = req.user.id;

    const result = await db.query(
      `SELECT pd.id, pd."templateId", pd."issuedBy", pd."expired_at", pd."created_at",
              LOWER(dt.template) as "templateType", dt.description,
              up.first_name as "issuedByFirstName", up.last_name as "issuedByLastName"
       FROM "PatientDocuments" pd
       JOIN "documentTemplate" dt ON pd."templateId" = dt.id
       LEFT JOIN "UsersPersonal" up ON pd."issuedBy" = up.id
       WHERE pd."patientId" = $1 AND REPLACE(LOWER(dt.template), ' ', '-') = LOWER($2)
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
