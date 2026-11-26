const express = require('express');
const path = require('path');
const dotenv = require("dotenv");
const logger = require('../../utils/logger.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const db = require('../../config/query.js');
const permit = require('../../services/authorization/permit.js');
// Import helpers from config/multer.js
const {
  upload,
  MEDIA_PATH, 
  validateFileType,
  stageFile,
  unstageFile,
  checkFileByUuid,
  getStagedFile,
  isMediaId,
} = require('../../config/multer.js');

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const mediaRouter = express.Router();

// --------------------
// POST - Stage upload
// --------------------
mediaRouter.post('/stage/', jwtProtect("all"), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE_UPLOADED' });
    }

    // Use helper to validate file type
    let extension;
    try {
      extension = await validateFileType(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
    }

    // Use helper to stage file
    const stagedFile = await stageFile(req.user.id, req.file.buffer, extension);

    logger.info('Media file staged', { fileId: stagedFile });
    res.json({ success: true, fileId: stagedFile });
  } catch (err) {
    if (err.message === 'MAX_FILES_STAGING_EXCEEDED') {
      logger.warn('Media staging limit exceeded', { userId: req.user.id });
      return res.status(429).json({ error: 'MAX_FILES_STAGING_EXCEEDED', message: 'You have exceeded the maximum number of files allowed in staging. Please wait before uploading more.' });
    }
    logger.error('Media staging error', { error: err.message });
    res.status(500).json({ error: 'MEDIA_STAGE_FAILED' });
  }
});

// --------------------
// DELETE - Unstage file
// --------------------
mediaRouter.delete('/unstage/:fileId', jwtProtect("all"), async (req, res) => {
  try {
    const { fileId } = req.params;

    await unstageFile(req.user.id, fileId);

    logger.info('Media file deleted', { fileId });
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'FILE_NOT_FOUND' });
    }
    logger.error('Media deletion error', { error: err.message });
    res.status(500).json({ error: 'MEDIA_DELETION_FAILED' });
  }
});

const category_lookup = {
  "staging": MEDIA_PATH.staging,
  "dentalPhoto": MEDIA_PATH.dentalPhoto,
  "appointmentRequirement": MEDIA_PATH.appointmentRequirement,
  "announcement": MEDIA_PATH.announcement,
  "eConsultation": MEDIA_PATH.eConsultation,  // Used for Health Chat feature (legacy name for backward compatibility)
  "documents": MEDIA_PATH.documents  // Patient raw documents
};

const privateMedia = {
  dentalPhoto: {
    permission: permit.permissions.emr_allow_view,
    ownerQuery: `SELECT log."patientId"
      FROM "DentalPhotoRecord" photo JOIN "patientUpdateLog" log ON log.id = photo.id
      WHERE $1 IN (photo."upperTeeth", photo."lowerTeeth")`,
  },
  documents: {
    permission: permit.permissions.document_allow_view,
    ownerQuery: 'SELECT "patientId" FROM "patientRawDocument" WHERE file = $1',
  },
  appointmentRequirement: {
    permission: permit.permissions.appointment_allow_view_records,
    strictSuperiority: false,
    ownerQuery: `SELECT slot."patientId"
      FROM "patientScheduleRequirement" attachment JOIN "patientSlot" slot ON slot.id = attachment."patientSlotId"
      WHERE attachment.filename = $1`,
  },
  eConsultation: {
    permission: permit.permissions.health_chat_allow_access,
    ownerQuery: `SELECT chat."patientId", chat."medicalId", chat.status, patient.branch
      FROM "HealthChatPrompt" attachment JOIN "HealthChat" chat ON chat.id = attachment."consultationVirtualId"
      JOIN "UsersPersonal" patient ON patient.id = chat."patientId"
      WHERE attachment.filename = $1 AND attachment."promptType" = 'file'`,
  },
};

async function canReadPrivateMedia(user, category, fileId) {
  const { ownerQuery, permission, strictSuperiority } = privateMedia[category];
  const { rows } = await db.query(ownerQuery, [fileId]);
  for (const row of rows) {
    if (user.role === 'patient' && Number(user.id) === Number(row.patientId)) return true;
    if (user.role !== 'medical') continue;
    if (category === 'eConsultation' && !(await permit.isMedicalAdmin(user.id))) {
      if (row.status !== 'Open' && Number(user.id) !== Number(row.medicalId)) continue;
      const staffBranch = await permit.getStaffBranch(user.id);
      if (staffBranch !== 'Both' && row.branch !== 'Both' && staffBranch !== row.branch) continue;
    }
    if (await permit.isMedicalPermittedPatientBased(user.id, permission, row.patientId, strictSuperiority)) return true;
  }
  return false;
}

mediaRouter.get('/record/:category/:fileId', jwtProtect("all"), async (req, res) => {
  const { category, fileId } = req.params;

  if (!Object.hasOwn(category_lookup, category)) {
    return res.status(400).json({ error: 'INVALID_CATEGORY' });
  }

  try {
    if (!isMediaId(fileId) ||
        (Object.hasOwn(privateMedia, category) && !(await canReadPrivateMedia(req.user, category, fileId)))) {
      return res.status(404).json({ error: 'FILE_NOT_FOUND' });
    }

    let filePath;
    if (category === 'staging') {
      filePath = await getStagedFile(req.user.id, fileId);
    } else {
      const fileName = await checkFileByUuid(category, fileId);
      if (fileName) filePath = path.join(category_lookup[category], fileName);
    }
    if (!filePath) return res.status(404).json({ error: 'FILE_NOT_FOUND' });

    if (category !== 'announcement') res.set('Cache-Control', 'private, no-store');

    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error('Error sending media file', { error: err.message, filePath });
        if (!res.headersSent) res.status(404).json({ error: 'FILE_NOT_FOUND' });
      }
    });
  } catch (err) {
    logger.error('Error retrieving media file', { error: err.message, category, fileId });
    res.status(500).json({ error: 'MEDIA_RETRIEVAL_FAILED' });
  }
});

module.exports = mediaRouter;
