jest.mock('multer', () => Object.assign(jest.fn(() => 'upload-middleware'), { memoryStorage: jest.fn(() => 'memory-storage') }));
// file-type exposes ESM-only conditions; isolate the detector at the boundary.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }), { virtual: true });
jest.mock('uuid', () => ({ v4: jest.fn(() => mockNewId) }));
jest.mock('fs', () => ({ promises: Object.fromEntries(['mkdir', 'writeFile', 'readdir', 'unlink', 'rename'].map(key => [key, jest.fn()])) }));
jest.mock('./redis', () => ({ incrementMediaStagingCount: jest.fn(), decrementMediaStagingCount: jest.fn() }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const path = require('path');
const { withEnvironment } = require('../test-support/fixtures.cjs');
const mockNewId = '9a0b1c2d-3e4f-4567-89ab-cdef01234567';
const stagedId = '01234567-89ab-4cde-8f01-23456789abcd';
const missingId = '23456789-abcd-4012-8e34-56789abcdef0';
let restore, media, fs, redis, types;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ MEDIA_PATH: path.resolve('test-media'), MEDIA_SIZE_MB: undefined });
  fs = require('fs').promises; redis = require('./redis'); types = require('file-type');
  redis.incrementMediaStagingCount.mockResolvedValue(true);
  media = require('./multer');
});
afterEach(() => restore());
test('configures in-memory uploads and media directories', async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(media.upload).toBe('upload-middleware');
  expect(media.MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  expect(require('multer')).toHaveBeenCalledWith({ storage: 'memory-storage', limits: { fileSize: media.MAX_FILE_SIZE } });
  expect(fs.mkdir).toHaveBeenCalledTimes(7);
});
test('uses configured upload size and handles directory creation failure', async () => {
  jest.resetModules(); process.env.MEDIA_SIZE_MB = '2';
  const filesystem = require('fs').promises;
  filesystem.mkdir.mockRejectedValue(new Error('permission denied'));
  expect(require('./multer').MAX_FILE_SIZE).toBe(2 * 1024 * 1024);
  await Promise.resolve();
  expect(require('../utils/logger').error).toHaveBeenCalledWith('Failed to create media directories', { error: 'permission denied' });
});
test.each([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['application/pdf', '.pdf'], ['video/mp4', '.mp4'], ['video/quicktime', '.mov']])('detects %s from file bytes', async (mime, extension) => {
  types.fileTypeFromBuffer.mockResolvedValue({ mime });
  await expect(media.validateFileType(Buffer.from('bytes'))).resolves.toBe(extension);
});
test.each([null, { mime: 'application/javascript' }])('rejects unsupported file type %j', async type => {
  types.fileTypeFromBuffer.mockResolvedValue(type);
  await expect(media.validateFileType(Buffer.from('bytes'))).rejects.toThrow('INVALID_FILE_TYPE');
});
test('stages a file only when quota is available', async () => {
  const buffer = Buffer.from('file');
  const ownerDirectory = path.join(media.MEDIA_PATH.staging, '12');
  await expect(media.stageFile(12, buffer, '.pdf')).resolves.toBe(mockNewId);
  expect(fs.mkdir).toHaveBeenCalledWith(ownerDirectory, { recursive: true });
  expect(redis.incrementMediaStagingCount).toHaveBeenCalledWith(12);
  expect(fs.writeFile).toHaveBeenCalledWith(path.join(ownerDirectory, `${mockNewId}.pdf`), buffer);
  redis.incrementMediaStagingCount.mockResolvedValue(false);
  await expect(media.stageFile(12, buffer, '.pdf')).rejects.toThrow('MAX_FILES_STAGING_EXCEEDED');
  expect(fs.writeFile).toHaveBeenCalledTimes(1);
});
test('releases the staging slot when writing fails', async () => {
  const error = new Error('write failed');
  fs.writeFile.mockRejectedValue(error);
  await expect(media.stageFile(12, Buffer.from('file'), '.pdf')).rejects.toBe(error);
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledWith(12);
});
test('unstages a matching file and updates the quota', async () => {
  const ownerDirectory = path.join(media.MEDIA_PATH.staging, '12');
  fs.readdir.mockResolvedValue([`${stagedId}-other.pdf`, `${stagedId}.pdf`]);
  await expect(media.unstageFile(12, stagedId)).resolves.toBe(true);
  expect(fs.readdir).toHaveBeenCalledWith(ownerDirectory);
  expect(fs.unlink).toHaveBeenCalledWith(path.join(ownerDirectory, `${stagedId}.pdf`));
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledWith(12);
  await expect(media.unstageFile(12, missingId)).rejects.toThrow('FILE_NOT_FOUND');
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledTimes(1);
});
test('promotes a staged file preserving its extension', async () => {
  const ownerDirectory = path.join(media.MEDIA_PATH.staging, '12');
  fs.readdir.mockResolvedValue([`${stagedId}.pdf`]);
  await expect(media.promoteFile(12, stagedId, 'documents')).resolves.toBe(mockNewId);
  expect(fs.readdir).toHaveBeenCalledWith(ownerDirectory);
  expect(fs.rename).toHaveBeenCalledWith(
    path.join(ownerDirectory, `${stagedId}.pdf`),
    path.join(media.MEDIA_PATH.documents, `${mockNewId}.pdf`),
  );
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledWith(12);
  await expect(media.promoteFile(12, missingId, 'documents')).rejects.toThrow('FILE_NOT_FOUND');
  await expect(media.promoteFile(12, stagedId, 'invalid')).rejects.toThrow('INVALID_TYPE');
});
test('treats a missing owner directory as a missing staged file', async () => {
  fs.readdir.mockRejectedValue(Object.assign(new Error('missing directory'), { code: 'ENOENT' }));
  await expect(media.unstageFile(13, stagedId)).rejects.toThrow('FILE_NOT_FOUND');
  expect(fs.readdir).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.staging, '13'));
  expect(fs.unlink).not.toHaveBeenCalled();
  expect(redis.decrementMediaStagingCount).not.toHaveBeenCalled();
});
test('validates search types and propagates filesystem errors', async () => {
  await expect(media.checkFileByUuid('invalid', stagedId)).rejects.toThrow('INVALID_TYPE');
  fs.readdir.mockRejectedValue(new Error('read failed'));
  await expect(media.checkFileByUuid('documents', stagedId)).rejects.toThrow('read failed');
});
test('deletes existing files and reports missing files on request', async () => {
  fs.readdir.mockResolvedValue([`${stagedId}.pdf`]);
  await expect(media.deleteFile('documents', stagedId)).resolves.toBe(true);
  expect(fs.unlink).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.documents, `${stagedId}.pdf`));
  await expect(media.deleteFile('invalid', stagedId)).rejects.toThrow('INVALID_TYPE');
  await expect(media.deleteFile('documents', missingId, true)).rejects.toThrow('FILE_NOT_FOUND');
});
test('rejects an invalid staging owner before reserving quota or writing', async () => {
  await expect(media.stageFile('../13', Buffer.from('file'), '.pdf')).rejects.toThrow('INVALID_USER_ID');
  expect(redis.incrementMediaStagingCount).not.toHaveBeenCalled();
  expect(fs.writeFile).not.toHaveBeenCalled();
});
