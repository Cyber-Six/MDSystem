const express = require('express');
const path = require('path');
const dotenv = require("dotenv");
const logger = require('../../utils/logger.js');
const { v4: uuidv4 } = require('uuid');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
// Import helpers from config/multer.js
const {
  upload,
  validateFileType,
  stageFile,
  unstageFile,
} = require('../../config/multer.js');

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const mediaRouter = express.Router();

// --------------------
// POST - Stage upload
// --------------------
mediaRouter.post('/', jwtProtect(""), upload.single('file'), async (req, res) => {
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
mediaRouter.delete('/:fileId', jwtProtect(""), async (req, res) => {
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

module.exports = mediaRouter;
