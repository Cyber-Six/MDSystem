const path = require('path');
const multer = require('multer');
const FileType = require('file-type');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { incrementMediaStagingCount, decrementMediaStagingCount } = require('./redis.js');
const logger = require('../utils/logger.js');

const MEDIA_PATH_ENV = path.resolve(process.env.MEDIA_PATH);
const MAX_FILE_SIZE = parseInt(process.env.MEDIA_SIZE_MB, 10) * 1024 * 1024 || 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const MEDIA_PATH = {
  staging: path.join(MEDIA_PATH_ENV, 'staging'),
  promoted: path.join(MEDIA_PATH_ENV, 'committed'),
  dentalPhoto: path.join(MEDIA_PATH_ENV, 'committed', 'dental_photos'),
  appointmentRequirement: path.join(MEDIA_PATH_ENV, 'committed', 'appointment_requirements'),
  eConsultation: path.join(MEDIA_PATH_ENV, 'committed', 'e_consultation'),
  announcement: path.join(MEDIA_PATH_ENV, 'committed', 'announcement'),
};

// Ensure base directories exist
(async () => {
  try {
    await fs.mkdir(MEDIA_PATH.staging, { recursive: true });
    await fs.mkdir(MEDIA_PATH.promoted, { recursive: true });
    await fs.mkdir(MEDIA_PATH.dentalPhoto, { recursive: true });
    await fs.mkdir(MEDIA_PATH.appointmentRequirement, { recursive: true });
    await fs.mkdir(MEDIA_PATH.announcement, { recursive: true });
  } catch (err) {
    logger.error('Failed to create media directories', { error: err.message });
  }
})();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

// Path traversal protection
function safeResolve(base, fileId) {
  const resolved = path.resolve(base, fileId);
  if (!resolved.startsWith(base)) throw new Error('INVALID_PATH');
  return resolved;
}

async function validateFileType(buffer) {
  const fileType = await FileType.fromBuffer(buffer);
  if (!fileType || !ALLOWED_MIME_TYPES[fileType.mime]) {
    throw new Error('INVALID_FILE_TYPE');
  }
  return ALLOWED_MIME_TYPES[fileType.mime];
}

// Stage file into MEDIA_PATH/staging
async function stageFile(userId, buffer, extension) {
  const uniqueId = uuidv4();
  const safeName = `${uniqueId}${extension}`;
  const stagedPath = safeResolve(MEDIA_PATH.staging, safeName);

  const allowed = await incrementMediaStagingCount(userId);
  if (!allowed) throw new Error("MAX_FILES_STAGING_EXCEEDED");

  await fs.writeFile(stagedPath, buffer);
  logger.info('File staged', { userId, stagedPath, safeName });
  return uniqueId;
}

// Delete staged file
async function unstageFile(userId, uuid) {
  // Find the actual staged filename by UUID
  const files = await fs.readdir(MEDIA_PATH.staging);
  const match = files.find(file => file.startsWith(uuid));

  if (!match) {
    throw new Error("FILE_NOT_FOUND");
  }

  const stagedPath = safeResolve(MEDIA_PATH.staging, match);

  await fs.unlink(stagedPath);
  await decrementMediaStagingCount(userId);

  logger.info("Staged file deleted", { userId, uuid, stagedPath });
  return true;
}


// Promote staged file into MEDIA_PATH/<type>
async function promoteFile(userId, stagedFileName, type) {
  const fullStagedName = await checkFileByUuid("staging", stagedFileName);
  if (!fullStagedName) throw new Error("FILE_NOT_FOUND");                  // ← null check
  const stagedPath = safeResolve(MEDIA_PATH.staging, fullStagedName);

  if (!MEDIA_PATH[type]) throw new Error("INVALID_TYPE");

  const typeDir = MEDIA_PATH[type];
  await fs.mkdir(typeDir, { recursive: true });

  const uniqueId = uuidv4();
  const extension = path.extname(fullStagedName);  // ← use fullStagedName, not stagedFileName
  const promotedName = `${uniqueId}${extension}`;
  const targetPath = safeResolve(typeDir, promotedName);

  await fs.rename(stagedPath, targetPath);
  await decrementMediaStagingCount(userId);

  logger.info("File promoted", { userId, type, stagedPath, targetPath, promotedName });
  return uniqueId;
}

// Check if a file exists in MEDIA_PATH[type] by UUID and return its extension
async function checkFileByUuid(type, uuid) {
  // Validate type
  if (!MEDIA_PATH[type]) {
    throw new Error("INVALID_TYPE");
  }

  const typeDir = MEDIA_PATH[type];

  try {
    const files = await fs.readdir(typeDir);

    // Find file that starts with the uuid
    const match = files.find(file => file.startsWith(uuid));
    if (!match) {
      return null; // return null if no file found
    }

    // Return full filename (uuid + extension)
    return match;
  } catch (err) {
    logger.error("File check failed", { type, uuid, error: err.message });
    throw err;
  }
}

// Delete file from MEDIA_PATH[type] by UUID
async function deleteFile(type, uuid) {
  // Validate type
  if (!MEDIA_PATH[type]) {
    throw new Error("INVALID_TYPE");
  }

  const typeDir = MEDIA_PATH[type];
  const filename = await checkFileByUuid(type, uuid);

  if (!filename) {
    throw new Error("FILE_NOT_FOUND");
  }

  const fileToDelete = safeResolve(typeDir, filename);

  await fs.unlink(fileToDelete);
  logger.info("File deleted", { type, uuid, fileToDelete });
  return true;
}




module.exports = {
  upload,
  validateFileType,
  stageFile,
  unstageFile,
  promoteFile,
  deleteFile,
  checkFileByUuid,
  MEDIA_PATH,
  MAX_FILE_SIZE,
};
