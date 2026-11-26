const path = require('path');
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
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
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const MEDIA_PATH = {
  staging: path.join(MEDIA_PATH_ENV, 'staging'),
  promoted: path.join(MEDIA_PATH_ENV, 'committed'),
  dentalPhoto: path.join(MEDIA_PATH_ENV, 'committed', 'dental_photos'),
  appointmentRequirement: path.join(MEDIA_PATH_ENV, 'committed', 'appointment_requirements'),
  eConsultation: path.join(MEDIA_PATH_ENV, 'committed', 'e_consultation'), // Used for Health Chat feature
  announcement: path.join(MEDIA_PATH_ENV, 'committed', 'announcement'),
  documents: path.join(MEDIA_PATH_ENV, 'committed', 'documents'),
};

// Ensure base directories exist
(async () => {
  try {
    await fs.mkdir(MEDIA_PATH.staging, { recursive: true });
    await fs.mkdir(MEDIA_PATH.promoted, { recursive: true });
    await fs.mkdir(MEDIA_PATH.dentalPhoto, { recursive: true });
    await fs.mkdir(MEDIA_PATH.appointmentRequirement, { recursive: true });
    await fs.mkdir(MEDIA_PATH.eConsultation, { recursive: true }); // Health Chat files
    await fs.mkdir(MEDIA_PATH.announcement, { recursive: true });
    await fs.mkdir(MEDIA_PATH.documents, { recursive: true });
  } catch (err) {
    logger.error('Failed to create media directories', { error: err.message });
  }
})();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

function isMediaId(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

function stagedDirectory(userId) {
  const owner = String(userId);
  if (!/^\d+$/.test(owner)) throw new Error('INVALID_USER_ID');
  return path.join(MEDIA_PATH.staging, owner);
}

async function findMediaFile(directory, uuid) {
  if (!isMediaId(uuid)) return null;
  try {
    const files = await fs.readdir(directory);
    return files.find(file => path.basename(file, path.extname(file)) === uuid.toLowerCase()) || null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function getStagedFile(userId, uuid) {
  const directory = stagedDirectory(userId);
  const filename = await findMediaFile(directory, uuid);
  return filename ? path.join(directory, filename) : null;
}

async function validateFileType(buffer) {
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !ALLOWED_MIME_TYPES[fileType.mime]) {
    throw new Error('INVALID_FILE_TYPE');
  }
  return ALLOWED_MIME_TYPES[fileType.mime];
}

// Stage file into MEDIA_PATH/staging
async function stageFile(userId, buffer, extension) {
  const uniqueId = uuidv4();
  const safeName = `${uniqueId}${extension}`;
  const ownerDir = stagedDirectory(userId);
  await fs.mkdir(ownerDir, { recursive: true });
  const stagedPath = path.join(ownerDir, safeName);

  const allowed = await incrementMediaStagingCount(userId);
  if (!allowed) throw new Error("MAX_FILES_STAGING_EXCEEDED");

  try {
    await fs.writeFile(stagedPath, buffer);
  } catch (err) {
    await decrementMediaStagingCount(userId);
    throw err;
  }
  logger.info('File staged', { userId, stagedPath, safeName });
  return uniqueId;
}

// Delete staged file
async function unstageFile(userId, uuid) {
  const stagedPath = await getStagedFile(userId, uuid);
  if (!stagedPath) throw new Error('FILE_NOT_FOUND');
  try {
    await fs.unlink(stagedPath);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('FILE_NOT_FOUND');
    throw err;
  }
  await decrementMediaStagingCount(userId);

  logger.info("Staged file deleted", { userId, uuid, stagedPath });
  return true;
}


// Promote staged file into MEDIA_PATH/<type>
async function promoteFile(userId, stagedFileName, type) {
  const stagedPath = await getStagedFile(userId, stagedFileName);
  if (!stagedPath) throw new Error('FILE_NOT_FOUND');

  if (!Object.hasOwn(MEDIA_PATH, type)) throw new Error("INVALID_TYPE");

  const typeDir = MEDIA_PATH[type];
  await fs.mkdir(typeDir, { recursive: true });

  const uniqueId = uuidv4();
  const extension = path.extname(stagedPath);
  const promotedName = `${uniqueId}${extension}`;
  const targetPath = path.join(typeDir, promotedName);

  await fs.rename(stagedPath, targetPath);
  await decrementMediaStagingCount(userId);

  logger.info("File promoted", { userId, type, stagedPath, targetPath, promotedName });
  return uniqueId;
}

// Check if a file exists in MEDIA_PATH[type] by UUID and return its extension
async function checkFileByUuid(type, uuid) {
  // Validate type
  if (!Object.hasOwn(MEDIA_PATH, type)) {
    throw new Error("INVALID_TYPE");
  }

  return findMediaFile(MEDIA_PATH[type], uuid);
}

// Delete file from MEDIA_PATH[type] by UUID
async function deleteFile(type, uuid, throwNotFound = false) {
  // Validate type
  if (!Object.hasOwn(MEDIA_PATH, type)) {
    throw new Error("INVALID_TYPE");
  }

  const typeDir = MEDIA_PATH[type];
  const filename = await checkFileByUuid(type, uuid);

  if (!filename) {
    if (throwNotFound) throw new Error('FILE_NOT_FOUND');
    return false;
  }

  const fileToDelete = path.join(typeDir, filename);

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
  getStagedFile,
  isMediaId,
  MEDIA_PATH,
  MAX_FILE_SIZE,
};
