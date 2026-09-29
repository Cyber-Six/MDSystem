jest.mock('multer', () => Object.assign(jest.fn(() => 'upload-middleware'), { memoryStorage: jest.fn(() => 'memory-storage') }));
// file-type exposes ESM-only conditions; isolate the detector at the boundary.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }), { virtual: true });
jest.mock('uuid', () => ({ v4: jest.fn(() => 'new-id') }));
jest.mock('fs', () => ({ promises: Object.fromEntries(['mkdir', 'writeFile', 'readdir', 'unlink', 'rename'].map(key => [key, jest.fn()])) }));
jest.mock('./redis', () => ({ incrementMediaStagingCount: jest.fn(), decrementMediaStagingCount: jest.fn() }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const path = require('path');
const { withEnvironment } = require('../test-support/fixtures.cjs');
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
  await expect(media.stageFile(12, buffer, '.pdf')).resolves.toBe('new-id');
  expect(fs.writeFile).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.staging, 'new-id.pdf'), buffer);
  redis.incrementMediaStagingCount.mockResolvedValue(false);
  await expect(media.stageFile(12, buffer, '.pdf')).rejects.toThrow('MAX_FILES_STAGING_EXCEEDED');
  expect(fs.writeFile).toHaveBeenCalledTimes(1);
});
test('unstages a matching file and updates the quota', async () => {
  fs.readdir.mockResolvedValue(['other.pdf', 'old-id.pdf']);
  await expect(media.unstageFile(12, 'old-id')).resolves.toBe(true);
  expect(fs.unlink).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.staging, 'old-id.pdf'));
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledWith(12);
  await expect(media.unstageFile(12, 'missing')).rejects.toThrow('FILE_NOT_FOUND');
});
test('promotes a staged file preserving its extension', async () => {
  fs.readdir.mockResolvedValue(['old-id.pdf']);
  await expect(media.promoteFile(12, 'old-id', 'documents')).resolves.toBe('new-id');
  expect(fs.rename).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.staging, 'old-id.pdf'), path.join(media.MEDIA_PATH.documents, 'new-id.pdf'));
  expect(redis.decrementMediaStagingCount).toHaveBeenCalledWith(12);
  await expect(media.promoteFile(12, 'missing', 'documents')).rejects.toThrow('FILE_NOT_FOUND');
  await expect(media.promoteFile(12, 'old-id', 'invalid')).rejects.toThrow('INVALID_TYPE');
});
test('validates search types and propagates filesystem errors', async () => {
  await expect(media.checkFileByUuid('invalid', 'id')).rejects.toThrow('INVALID_TYPE');
  fs.readdir.mockRejectedValue(new Error('read failed'));
  await expect(media.checkFileByUuid('documents', 'id')).rejects.toThrow('read failed');
});
test('deletes existing files and reports missing files on request', async () => {
  fs.readdir.mockResolvedValue(['old-id.pdf']);
  await expect(media.deleteFile('documents', 'old-id')).resolves.toBe(true);
  expect(fs.unlink).toHaveBeenCalledWith(path.join(media.MEDIA_PATH.documents, 'old-id.pdf'));
  await expect(media.deleteFile('invalid', 'id')).rejects.toThrow('INVALID_TYPE');
  await expect(media.deleteFile('documents', 'missing', true)).rejects.toThrow('FILE_NOT_FOUND');
});
test('rejects a path traversal before writing', async () => {
  require('uuid').v4.mockReturnValue('../../escape');
  await expect(media.stageFile(12, Buffer.from('file'), '.pdf')).rejects.toThrow('INVALID_PATH');
  expect(fs.writeFile).not.toHaveBeenCalled();
});
