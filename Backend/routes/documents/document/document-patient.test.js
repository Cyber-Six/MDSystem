jest.mock('../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => jest.fn()) }));
jest.mock('../../../config/db.js', () => ({ query: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ connect: jest.fn() }));
jest.mock('../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../../../services/doc-generate-module/index.js', () => ({}));
jest.mock('../../../services/doc-generate-module/prescription-normalized.js', () => ({}));
jest.mock('../../../services/doc-generate-module/medical-certificate-normalized.js', () => ({}));
jest.mock('../../../config/sockets/socket-emitter.js', () => ({ notifyUser: jest.fn() }));
jest.mock('../../../config/middleware/activeCredential.js', () => ({ checkCredentialsStatus: jest.fn() }));

const db = require('../../../config/db.js');
const router = require('./document-patient.js');
const route = router.stack.find(layer => layer.route?.path === '/requests').route;
const handler = route.stack.at(-1).handle;
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

test('lists patient document requests and groups the latest non-archived submission', async () => {
  db.query.mockResolvedValue({ rows: [
    { id: 1, label: 'ID', isActive: true, submissionId: 9, status: 'Pending', file: 'file.pdf', recordedBy: 2, recordedByFirstName: 'Ada', recordedByLastName: 'Lovelace' },
    { id: 1, label: 'ID', isActive: true, submissionId: 8, status: 'Archived', file: 'old.pdf' },
    { id: 2, label: 'Photo', isActive: true, submissionId: null },
  ] });
  const res = response();
  await handler({ user: { id: 7 } }, res);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM "rawDocumentTag"'), [7]);
  expect(res.json).toHaveBeenCalledWith({ success: true, documents: [
    { id: 1, label: 'ID', isActive: true, submission: { id: 9, status: 'Pending', file: 'file.pdf', notes: undefined, recordedBy: { id: 2, name: 'Ada Lovelace' }, submittedAt: undefined } },
    { id: 2, label: 'Photo', isActive: true, submission: null },
  ] });
});

test('reports database errors with a stable response', async () => {
  db.query.mockRejectedValueOnce(new Error('offline'));
  const res = response();
  await handler({ user: { id: 7 } }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: 'FETCH_FAILED', message: 'offline' });
});
