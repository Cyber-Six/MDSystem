const handlers = { get: [], post: [], put: [], delete: [] };
jest.mock('express', () => ({ Router: () => Object.fromEntries(Object.keys(handlers).map(method => [method, (...args) => handlers[method].push(args)])) }));
jest.mock('../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ query: jest.fn(), queryClient: jest.fn(), queryControlled: jest.fn(), getUserBranch: jest.fn(), connect: jest.fn() }));
jest.mock('../../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => (_req, _res, next) => next()) }));
jest.mock('../../../services/authorization/permit.js', () => ({ isMedicalPermitted: jest.fn(), isMedicalPermittedLocationBased: jest.fn(), permissions: { announcement_allow_crud: 'ANNOUNCE' }, getStaffBranch: jest.fn() }));
jest.mock('../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../../../utils/validator.js', () => ({ ValidateBranchbyUserBranch: jest.fn(), ValidateLocationDesignation: jest.fn(location => ['Manila', 'QuezonCity', 'Both'].includes(location)) }));

const db = require('../../../config/query.js');
const permit = require('../../../services/authorization/permit.js');
const files = require('../../../config/multer.js');
require('./announcement.js');
const route = (method, path) => handlers[method].find(([candidate]) => candidate === path).at(-1);
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const client = (responses) => ({ query: jest.fn(async (sql) => /^\s*(SELECT|UPDATE|DELETE)/.test(sql) ? responses.shift() : { rowCount: 1, rows: [] }), release: jest.fn() });

beforeEach(() => { jest.clearAllMocks(); db.getUserBranch.mockResolvedValue('Manila'); permit.isMedicalPermitted.mockResolvedValue({ permitted: true }); permit.isMedicalPermittedLocationBased.mockResolvedValue(true); permit.getStaffBranch.mockResolvedValue('Manila'); });

test('patient reads are branch-scoped, return empty/not-found states, and map database errors', async () => {
  db.query.mockResolvedValueOnce({ rows: [] }); let response = res(); await route('get', '/')({ user: { id: 3 } }, response);
  expect(db.query.mock.calls[0][1]).toEqual(['Manila']); expect(response.json).toHaveBeenCalledWith({ success: true, data: [] });
  db.getUserBranch.mockResolvedValueOnce(null); db.query.mockResolvedValueOnce({ rows: [] }); response = res(); await route('get', '/')({ user: null }, response);
  expect(db.query.mock.calls.at(-1)[1]).toEqual(['Both']);
  db.query.mockResolvedValueOnce({ rows: [] }); response = res(); await route('get', '/:id')({ params: { id: 'a' }, user: { id: 3 } }, response);
  expect(response.status).toHaveBeenCalledWith(404);
  db.query.mockRejectedValueOnce(Error('offline')); response = res(); await route('get', '/')({ user: {} }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  db.query.mockResolvedValueOnce({ rows: [{ id: 'a' }] }); response = res(); await route('get', '/:id')({ params: { id: 'a' }, user: { id: 3 } }, response);
  expect(response.status).toHaveBeenCalledWith(200);
  db.getUserBranch.mockResolvedValueOnce(null); db.query.mockResolvedValueOnce({ rows: [{ id: 'b' }] }); response = res(); await route('get', '/:id')({ params: { id: 'b' }, user: null }, response);
  expect(db.query.mock.calls.at(-1)[1]).toEqual(['b', 'Both']);
  db.query.mockRejectedValueOnce(Error('offline')); response = res(); await route('get', '/:id')({ params: { id: 'a' }, user: { id: 3 } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
});

test('admin list enforces permission and branch scope, with invalid and forbidden locations', async () => {
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false }); let response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: {} }, response);
  expect(response.status).toHaveBeenCalledWith(403);
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true }); response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: { location: 'Mars' } }, response);
  expect(response.status).toHaveBeenCalledWith(400);
  response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: { location: 'QuezonCity' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);
  db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] }); response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: {} }, response);
  expect(response.json).toHaveBeenCalledWith({ success: true, data: [{ id: 9 }], branch: 'Manila' });
  permit.getStaffBranch.mockResolvedValueOnce(null); db.query.mockResolvedValueOnce({ rows: [] }); response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: {} }, response);
  expect(db.query.mock.calls.at(-1)[1]).toEqual(['Both']);
  db.query.mockRejectedValueOnce(Error('database offline')); response = res(); await route('get', '/admin/all')({ user: { id: 1 }, query: {} }, response);
  expect(response.status).toHaveBeenCalledWith(500);
});

test('create validates location, permission, optional file promotion and SQL errors', async () => {
  let response = res(); await route('post', '/')({ user: { id: 2 }, body: { location: 'Mars' } }, response); expect(response.status).toHaveBeenCalledWith(400);
  permit.isMedicalPermittedLocationBased.mockResolvedValueOnce(false); response = res(); await route('post', '/')({ user: { id: 2 }, body: { location: 'Manila' } }, response); expect(response.status).toHaveBeenCalledWith(403);
  files.promoteFile.mockRejectedValueOnce(Error('missing staged file')); response = res(); await route('post', '/')({ user: { id: 2 }, body: { location: 'Manila', pubmat: 'x' } }, response); expect(response.status).toHaveBeenCalledWith(400);
  files.promoteFile.mockResolvedValueOnce('committed.png'); db.queryControlled.mockResolvedValueOnce({ rows: [{ id: 1 }] }); response = res();
  await route('post', '/')({ user: { id: 2 }, body: { location: 'Manila', pubmat: 'x' } }, response);
  expect(response.status).toHaveBeenCalledWith(201); expect(db.queryControlled.mock.calls[0][1]).toEqual([null, null, 'committed.png', true, 'Manila', null]);
  db.queryControlled.mockRejectedValueOnce(Error('database')); response = res(); await route('post', '/')({ user: { id: 2 }, body: { location: 'Manila' } }, response); expect(response.status).toHaveBeenCalledWith(500);
  db.queryControlled.mockResolvedValueOnce({ rows: [] }); response = res(); await route('post', '/')({ user: { id: 2 }, body: { location: 'Both', isActive: false, viewableUntil: 'tomorrow' } }, response);
  expect(response.status).toHaveBeenCalledWith(201);
  expect(db.queryControlled.mock.calls.at(-1)[1]).toEqual([null, null, null, false, 'Both', 'tomorrow']);
});

test('update rolls back missing/unauthorized records and commits successful edits while releasing client', async () => {
  const update = route('put', '/:id');
  const missing = client([{ rows: [] }]); db.connect.mockResolvedValueOnce(missing); let response = res(); await update({ user: { id: 2 }, params: { id: 'x' }, body: {} }, response);
  expect(missing.query).toHaveBeenLastCalledWith('ROLLBACK'); expect(missing.release).toHaveBeenCalled();
  const success = client([{ rows: [{ pubmat: null, location: 'Manila' }] }, { rowCount: 1, rows: [{ id: 7 }] }]); db.connect.mockResolvedValueOnce(success); response = res(); await update({ user: { id: 2 }, params: { id: '7' }, body: { label: 'Updated', viewableUntil: '2030-01-01' } }, response);
  expect(success.query).toHaveBeenLastCalledWith('COMMIT'); expect(response.status).toHaveBeenCalledWith(200); expect(success.release).toHaveBeenCalled();
});

test('update validates both locations, handles promotion failure, and rolls back/cleans up replaced files', async () => {
  const update = route('put', '/:id');
  const invalidLocation = client([{ rows: [{ pubmat: 'old.png', location: 'Manila' }] }]);
  db.connect.mockResolvedValueOnce(invalidLocation);
  let response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { location: 'Mars' } }, response);
  expect(response.status).toHaveBeenCalledWith(400);
  expect(invalidLocation.query).toHaveBeenLastCalledWith('ROLLBACK');

  const currentDenied = client([{ rows: [{ pubmat: null, location: 'QuezonCity' }] }]);
  db.connect.mockResolvedValueOnce(currentDenied);
  permit.isMedicalPermittedLocationBased.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { location: 'Both' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);

  const moveLocation = client([{ rows: [{ pubmat: null, location: 'Manila' }] }, { rowCount: 1, rows: [{ id: 'moved' }] }]);
  db.connect.mockResolvedValueOnce(moveLocation);
  permit.isMedicalPermittedLocationBased.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { location: 'Both' } }, response);
  expect(response.status).toHaveBeenCalledWith(200);

  const newLocationDenied = client([{ rows: [{ pubmat: null, location: 'Manila' }] }]);
  db.connect.mockResolvedValueOnce(newLocationDenied);
  permit.isMedicalPermittedLocationBased.mockResolvedValueOnce(false);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { location: 'Manila' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);

  const promotionFailure = client([{ rows: [{ pubmat: null, location: 'Manila' }] }]);
  db.connect.mockResolvedValueOnce(promotionFailure);
  files.promoteFile.mockRejectedValueOnce(new Error('bad upload'));
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { pubmat: 'staged', location: 'Manila' } }, response);
  expect(response.status).toHaveBeenCalledWith(400);
  expect(promotionFailure.query).toHaveBeenLastCalledWith('ROLLBACK');

  const replaced = client([{ rows: [{ pubmat: 'old.png', location: 'Manila' }] }, { rowCount: 1, rows: [{ id: 1 }] }]);
  db.connect.mockResolvedValueOnce(replaced);
  files.promoteFile.mockResolvedValueOnce('new.png');
  files.deleteFile.mockRejectedValueOnce(new Error('old file locked')).mockResolvedValueOnce(undefined);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { pubmat: 'staged', location: 'Manila' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(files.deleteFile).toHaveBeenNthCalledWith(2, 'announcement', 'new.png');
  expect(replaced.query).toHaveBeenLastCalledWith('ROLLBACK');
  expect(replaced.release).toHaveBeenCalled();

  const zeroRows = client([{ rows: [{ pubmat: null, location: 'Manila' }] }, { rowCount: 0, rows: [] }]);
  db.connect.mockResolvedValueOnce(zeroRows);
  files.promoteFile.mockResolvedValueOnce('orphan.png');
  files.deleteFile.mockResolvedValueOnce(undefined);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { pubmat: 'staged', location: 'Manila' } }, response);
  expect(response.status).toHaveBeenCalledWith(404);
  expect(files.deleteFile).toHaveBeenLastCalledWith('announcement', 'orphan.png');

  const zeroRowsNoFile = client([{ rows: [{ pubmat: null, location: 'Manila' }] }, { rowCount: 0, rows: [] }]);
  db.connect.mockResolvedValueOnce(zeroRowsNoFile);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { label: 'missing' } }, response);
  expect(response.status).toHaveBeenCalledWith(404);

  const updateThrows = { query: jest.fn(async sql => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 1, rows: [] };
    if (/^\s*SELECT/.test(sql)) return { rows: [{ pubmat: null, location: 'Manila' }] };
    throw new Error('update failed');
  }), release: jest.fn() };
  db.connect.mockResolvedValueOnce(updateThrows);
  files.promoteFile.mockResolvedValueOnce('cleanup.png');
  files.deleteFile.mockRejectedValueOnce(new Error('cleanup failed'));
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { pubmat: 'staged', location: 'Manila' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(updateThrows.query).toHaveBeenLastCalledWith('ROLLBACK');

  const updateThrowsWithoutFile = { query: jest.fn(async sql => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 1, rows: [] };
    if (/^\s*SELECT/.test(sql)) return { rows: [{ pubmat: null, location: 'Manila' }] };
    throw new Error('update failed without file');
  }), release: jest.fn() };
  db.connect.mockResolvedValueOnce(updateThrowsWithoutFile);
  response = res();
  await update({ user: { id: 2 }, params: { id: '1' }, body: { label: 'bad' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
});

test('delete handles absent rows and removes authorized announcements transactionally', async () => {
  const del = route('delete', '/:id');
  const missing = client([{ rows: [] }]); db.connect.mockResolvedValueOnce(missing); let response = res(); await del({ user: { id: 2 }, params: { id: 'x' } }, response); expect(response.status).toHaveBeenCalledWith(404);
  const success = client([{ rows: [{ location: 'Manila' }] }, { rowCount: 1, rows: [{ pubmat: null }] }]); db.connect.mockResolvedValueOnce(success); db.queryClient.mockImplementation((c, ...args) => c.query(...args)); response = res();
  await del({ user: { id: 2 }, params: { id: '7' } }, response); expect(response.status).toHaveBeenCalledWith(200); expect(success.query).toHaveBeenLastCalledWith('COMMIT'); expect(success.release).toHaveBeenCalled();
});

test('delete handles permission denial, empty deletes, file cleanup errors, and database errors', async () => {
  const del = route('delete', '/:id');
  const forbidden = client([{ rows: [{ location: 'Manila' }] }]);
  db.connect.mockResolvedValueOnce(forbidden);
  permit.isMedicalPermittedLocationBased.mockResolvedValueOnce(false);
  let response = res();
  await del({ user: { id: 2 }, params: { id: '2' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);

  const noDelete = client([{ rows: [{ location: 'Manila' }] }, { rowCount: 0, rows: [] }]);
  db.connect.mockResolvedValueOnce(noDelete);
  db.queryClient.mockImplementation((c, ...args) => c.query(...args));
  response = res();
  await del({ user: { id: 2 }, params: { id: '3' } }, response);
  expect(response.status).toHaveBeenCalledWith(404);

  const deletedWithFile = client([{ rows: [{ location: 'Manila' }] }, { rowCount: 1, rows: [{ pubmat: 'good.png' }] }]);
  db.connect.mockResolvedValueOnce(deletedWithFile);
  files.deleteFile.mockResolvedValueOnce(undefined);
  response = res();
  await del({ user: { id: 2 }, params: { id: '5' } }, response);
  expect(response.status).toHaveBeenCalledWith(200);
  expect(files.deleteFile).toHaveBeenLastCalledWith('announcement', 'good.png');

  const fileFailure = client([{ rows: [{ location: 'Manila' }] }, { rowCount: 1, rows: [{ pubmat: 'pub.png' }] }]);
  db.connect.mockResolvedValueOnce(fileFailure);
  files.deleteFile.mockRejectedValueOnce(new Error('cannot delete'));
  response = res();
  await del({ user: { id: 2 }, params: { id: '4' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(fileFailure.query).toHaveBeenLastCalledWith('ROLLBACK');

  const queryFailure = client([{ rows: [{ location: 'Manila' }] }]);
  db.connect.mockResolvedValueOnce(queryFailure);
  db.queryClient.mockRejectedValueOnce(new Error('delete query failed'));
  response = res();
  await del({ user: { id: 2 }, params: { id: '6' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(queryFailure.query).toHaveBeenLastCalledWith('ROLLBACK');
});
