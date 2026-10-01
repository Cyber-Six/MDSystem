jest.mock('../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => jest.fn()) }));
jest.mock('../../../config/db.js', () => ({ query: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ connect: jest.fn() }));
jest.mock('../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../../../services/doc-generate-module/index.js', () => ({}));
jest.mock('../../../services/doc-generate-module/prescription-normalized.js', () => ({}));
jest.mock('../../../services/doc-generate-module/medical-certificate-normalized.js', () => ({}));
jest.mock('../../health-chat/resolvers/wrapper/helper.js', () => ({ formatMessage: jest.fn() }));
jest.mock('../../../config/sockets', () => ({ emitToRoom: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../../services/authorization/permit.js', () => ({ permissions: { document_allow_view: 'document_allow_view' }, isMedicalPermittedPatientBased: jest.fn(), isMedicalPermitted: jest.fn() }));

const db = require('../../../config/db.js');
const permit = require('../../../services/authorization/permit.js');
const router = require('./document-staff.js');
const route = router.stack.find(layer => layer.route?.path === '/required').route;
const handler = route.stack.at(-1).handle;
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

beforeEach(() => jest.clearAllMocks());

test('requires a patient ID and document view permission', async () => {
  const res = response();
  await handler({ query: {}, user: { id: 3 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  await handler({ query: { patientId: '7' }, user: { id: 3 } }, res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  expect(db.query).not.toHaveBeenCalled();
});

test('returns current and archived submissions grouped under required document tags', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, label: 'ID', isActive: true }, { id: 2, label: 'Photo', isActive: true }] })
    .mockResolvedValueOnce({ rows: [
      { id: 5, documentTagId: 1, status: 'Archived', file: 'old.pdf' },
      { id: 6, documentTagId: 1, status: 'Pending', file: 'new.pdf', recordedBy: 4, recordedByFirstName: 'Ada', recordedByLastName: 'Lovelace' },
    ] });
  const res = response();
  await handler({ query: { patientId: '7' }, user: { id: 3 } }, res);
  expect(db.query).toHaveBeenCalledTimes(2);
  expect(res.json).toHaveBeenCalledWith({ success: true, documents: [
    { id: 1, label: 'ID', isActive: true, submission: expect.objectContaining({ id: 6, status: 'Pending', recordedBy: { id: 4, name: 'Ada Lovelace' } }), archivedSubmissions: [expect.objectContaining({ id: 5, status: 'Archived' })] },
    { id: 2, label: 'Photo', isActive: true, submission: null, archivedSubmissions: [] },
  ] });
});
