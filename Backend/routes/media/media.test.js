const mockRouter = { post: jest.fn(), delete: jest.fn(), get: jest.fn() };
const mockUpload = { single: jest.fn(() => 'upload-file') };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => 'auth') }));
jest.mock('../../config/multer.js', () => ({ upload: mockUpload, MEDIA_PATH: { staging: 'C:\\media\\staging', dentalPhoto: 'C:\\media\\dental', appointmentRequirement: 'C:\\media\\requirements', announcement: 'C:\\media\\announcement', eConsultation: 'C:\\media\\chat', documents: 'C:\\media\\documents' }, validateFileType: jest.fn(), stageFile: jest.fn(), unstageFile: jest.fn(), checkFileByUuid: jest.fn() }));
const media = require('../../config/multer.js');
require('./media');
const stage = mockRouter.post.mock.calls[0][3]; const unstage = mockRouter.delete.mock.calls[0][2]; const record = mockRouter.get.mock.calls[0][2];
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn(), sendFile: jest.fn((file, callback) => { response.file = file; response.callback = callback; }) });
const err = message => new Error(message);
beforeEach(() => { jest.clearAllMocks(); });

test('stages a valid upload and handles missing files and rejected file types', async () => {
  const res = response(); await stage({ file: null }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith({ error: 'NO_FILE_UPLOADED' });
  media.validateFileType.mockRejectedValueOnce(err('unsupported'));
  const invalid = response(); await stage({ file: { buffer: Buffer.from('x') }, user: { id: 2 } }, invalid);
  expect(invalid.status).toHaveBeenCalledWith(400); expect(invalid.json).toHaveBeenCalledWith({ error: 'INVALID_FILE_TYPE' });
  media.validateFileType.mockResolvedValue('png'); media.stageFile.mockResolvedValue('uuid');
  const success = response(); await stage({ file: { buffer: Buffer.from('png') }, user: { id: 2 } }, success);
  expect(media.stageFile).toHaveBeenCalledWith(2, Buffer.from('png'), 'png'); expect(success.json).toHaveBeenCalledWith({ success: true, fileId: 'uuid' });
});

test.each([['MAX_FILES_STAGING_EXCEEDED', 429, 'MAX_FILES_STAGING_EXCEEDED'], ['storage down', 500, 'MEDIA_STAGE_FAILED']])('maps stage failures %s', async (message, status, error) => {
  media.validateFileType.mockResolvedValue('png'); media.stageFile.mockRejectedValue(err(message));
  const res = response(); await stage({ file: { buffer: Buffer.from('x') }, user: { id: 9 } }, res);
  expect(res.status).toHaveBeenCalledWith(status); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
});

test('unstages an owned file and maps missing or unexpected failures', async () => {
  media.unstageFile.mockResolvedValue(); const res = response();
  await unstage({ params: { fileId: 'f' }, user: { id: 5 } }, res);
  expect(media.unstageFile).toHaveBeenCalledWith(5, 'f'); expect(res.json).toHaveBeenCalledWith({ success: true });
  media.unstageFile.mockRejectedValueOnce(err('FILE_NOT_FOUND'));
  const absent = response(); await unstage({ params: { fileId: 'missing' }, user: { id: 5 } }, absent);
  expect(absent.status).toHaveBeenCalledWith(404);
  media.unstageFile.mockRejectedValueOnce(err('offline'));
  const failure = response(); await unstage({ params: { fileId: 'f' }, user: { id: 5 } }, failure);
  expect(failure.status).toHaveBeenCalledWith(500); expect(failure.json).toHaveBeenCalledWith({ error: 'MEDIA_DELETION_FAILED' });
});

test('validates category, missing records, safe file paths, and send errors', async () => {
  let res = response(); await record({ params: { category: 'unknown', fileId: 'x' } }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_CATEGORY' });
  media.checkFileByUuid.mockResolvedValueOnce(null); res = response(); await record({ params: { category: 'staging', fileId: 'x' } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
  media.checkFileByUuid.mockResolvedValueOnce('../../secret'); res = response(); await record({ params: { category: 'staging', fileId: 'x' } }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_FILE_PATH' });
  media.checkFileByUuid.mockResolvedValueOnce('file.png'); res = response(); await record({ params: { category: 'documents', fileId: 'x' } }, res);
  expect(res.sendFile).toHaveBeenCalledWith('C:\\media\\documents\\file.png', expect.any(Function));
  res.sendFile.mock.calls[0][1](err('gone'));
  expect(res.status).toHaveBeenCalledWith(404);
  media.checkFileByUuid.mockResolvedValueOnce('ready.png'); res = response(); await record({ params: { category: 'documents', fileId: 'x' } }, res);
  res.sendFile.mock.calls[0][1]();
  media.checkFileByUuid.mockRejectedValueOnce(err('redis down')); res = response(); await record({ params: { category: 'announcement', fileId: 'x' } }, res);
  expect(res.status).toHaveBeenCalledWith(500); expect(res.json).toHaveBeenLastCalledWith({ error: 'MEDIA_RETRIEVAL_FAILED' });
});
