jest.mock('../../../../../config/query.js', () => ({ query: jest.fn(), getUserBranch: jest.fn(), connect: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ error: jest.fn() }));
jest.mock('../../../../../utils/validator.js', () => ({ ValidateBranchbyUserBranch: jest.fn() }));

const db = require('../../../../../config/query.js');
const validator = require('../../../../../utils/validator.js');
const logger = require('../../../../../utils/logger.js');
const { Query, Mutation } = require('./wrapper.js');
const ctx = (user = { id: 6 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
const makeClient = responses => ({ query: jest.fn(async sql => {
  const key = /^\s*(SELECT|INSERT|UPDATE)/.exec(sql)?.[1];
  return key ? responses.shift() : { rows: [], rowCount: 1 };
}), release: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); db.getUserBranch.mockResolvedValue('Manila'); validator.ValidateBranchbyUserBranch.mockReturnValue(true); });

test('available medicine scopes staff and patient projections and respects pagination', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ batchId: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 2 }] });
  expect(await Query._getAvailableMedicine(null, { location: 'Manila' }, ctx({ role: 'medical' }))).toEqual([{ batchId: 1 }]);
  expect(db.query.mock.calls[0][0]).toContain('mb.id AS "batchId"');
  expect(db.query.mock.calls[0][1]).toEqual(['Manila', 0, 20]);
  expect(await Query._getAvailableMedicine(null, { location: null, offset: 3, limit: 4 }, ctx({ role: 'patient' }))).toEqual([{ id: 2 }]);
  expect(db.query.mock.calls[1][0]).toContain('SELECT DISTINCT ON (mi.id)');
  expect(db.query.mock.calls[1][1]).toEqual([null, 3, 4]);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query._getAvailableMedicine(null, {}, ctx(null))).toEqual([]);
});

test('request status and patient lists load named items, including empty lists and database failure', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }).mockResolvedValueOnce({ rows: [{ itemName: 'A' }] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query._getMedicineStatus(null, { patientId: 6 }, ctx())).toEqual([{ id: 1, items: [{ itemName: 'A' }] }, { id: 2, items: [] }]);
  expect(db.query.mock.calls[0][1]).toEqual([6, 0, 20]);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query._getMedicineRequests(null, { patientId: 6, offset: 1, limit: 2 }, ctx())).toEqual([]);
  expect(db.query.mock.calls[3][1]).toEqual([6, 1, 2]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] }).mockResolvedValueOnce({ rows: [{ itemName: 'C' }] });
  expect(await Query._getMedicineRequests(null, { patientId: 6 }, ctx())).toEqual([{ id: 3, items: [{ itemName: 'C' }] }]);
  db.query.mockRejectedValueOnce(Error('offline'));
  await expect(Query._getMedicineStatus(null, { patientId: 6 }, ctx())).rejects.toThrow('offline');
  expect(logger.error).toHaveBeenCalledWith('Error in _getMedicineStatus:', expect.any(Error));
  db.query.mockRejectedValueOnce(Error('offline'));
  await expect(Query._getMedicineRequests(null, { patientId: 6 }, ctx())).rejects.toThrow('offline');
});

test('ID and staff lists return named items, null or empty results, and propagate query failures', async () => {
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query._getMedicineRequestById(null, { requestId: 8 }, ctx())).toBeNull();
  db.query.mockResolvedValueOnce({ rows: [{ id: 8 }] }).mockResolvedValueOnce({ rows: [{ itemName: 'B' }] });
  expect(await Query._getMedicineRequestById(null, { requestId: 8 }, ctx())).toEqual({ id: 8, items: [{ itemName: 'B' }] });
  db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query._getAllMedicineRequests(null, { location: 'Manila', status: 'Pending', offset: 2, limit: 3 }, ctx())).toEqual([{ id: 9, items: [] }]);
  expect(db.query.mock.calls[3][1]).toEqual(['Manila', 'Pending', 2, 3]);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query._getAllMedicineRequests(null, {}, ctx())).toEqual([]);
  expect(db.query.mock.calls[5][1]).toEqual([undefined, undefined, 0, 50]);
  db.query.mockRejectedValueOnce(Error('offline'));
  await expect(Query._getMedicineRequestById(null, { requestId: 8 }, ctx())).rejects.toThrow('offline');
  db.query.mockRejectedValueOnce(Error('offline'));
  await expect(Query._getAllMedicineRequests(null, {}, ctx())).rejects.toThrow('offline');
});

test('creation validates caller, items, and patient branch before connecting', async () => {
  await expect(Mutation._createMedicineRequest(null, { patientId: 6, input: { items: [] } }, ctx(null))).rejects.toThrow('Unauthorized');
  await expect(Mutation._createMedicineRequest(null, { patientId: 6, input: { items: null } }, ctx())).rejects.toThrow('At least one medicine item');
  await expect(Mutation._createMedicineRequest(null, { patientId: 6, input: { items: [] } }, ctx())).rejects.toThrow('At least one medicine item');
  validator.ValidateBranchbyUserBranch.mockReturnValueOnce(false);
  await expect(Mutation._createMedicineRequest(null, { patientId: 6, input: { items: [{ batchId: 1 }] , location: 'QuezonCity' } }, ctx())).rejects.toThrow('Invalid location outside your scope');
  expect(db.connect).not.toHaveBeenCalled();
});

test('creation commits the request and line items, then fetches their medicine names', async () => {
  const client = makeClient([{ rows: [{ id: 10 }] }, { rows: [{ id: 1 }] }]); db.connect.mockResolvedValueOnce(client);
  db.query.mockResolvedValueOnce({ rows: [{ itemName: 'Medicine A' }] });
  const input = { location: 'Manila', purpose: 'Care', items: [{ batchId: 2, quantity: 1 }, { medicineId: 3, quantity: 2 }] };
  expect(await Mutation._createMedicineRequest(null, { patientId: 6, input }, ctx())).toEqual({ id: 10, items: [{ itemName: 'Medicine A' }] });
  expect(client.query.mock.calls[1][1]).toEqual([6, 'Manila', 'Care', null]);
  expect(client.query.mock.calls[2][1]).toEqual([10, 2, 1, 3, 2]);
  expect(client.query).toHaveBeenLastCalledWith('COMMIT'); expect(client.release).toHaveBeenCalled();
  const failed = makeClient([]); failed.query.mockRejectedValueOnce(Error('db failed')); db.connect.mockResolvedValueOnce(failed);
  await expect(Mutation._createMedicineRequest(null, { patientId: 6, input }, ctx())).rejects.toThrow('Database error');
  expect(failed.query).toHaveBeenCalledWith('ROLLBACK'); expect(failed.release).toHaveBeenCalled();
});

test('status transitions validate caller and allowed target statuses', async () => {
  await expect(Mutation._setStatusMedicineRequest(null, { status: 'Approved' }, ctx(null))).rejects.toThrow('Unauthorized');
  await expect(Mutation._setStatusMedicineRequest(null, { status: 'Pending' }, ctx())).rejects.toThrow('Invalid status');
  const missing = makeClient([{ rows: [] }]); db.connect.mockResolvedValueOnce(missing);
  await expect(Mutation._setStatusMedicineRequest(null, { requestId: 4, status: 'Approved' }, ctx())).rejects.toThrow('Medicine request not found');
  expect(missing.release).toHaveBeenCalled();
  const denied = makeClient([{ rows: [{ status: 'Completed' }] }]); db.connect.mockResolvedValueOnce(denied);
  await expect(Mutation._setStatusMedicineRequest(null, { requestId: 4, status: 'Approved' }, ctx())).rejects.toThrow('Cannot transition');
  expect(denied.release).toHaveBeenCalled();
});

test('status changes handle approval and patient cancellation with transaction cleanup', async () => {
  const approved = makeClient([{ rows: [{ status: 'Pending' }] }, { rows: [{ id: 4, status: 'Approved' }] }]); db.connect.mockResolvedValueOnce(approved);
  db.query.mockResolvedValueOnce({ rows: [{ itemName: 'A' }] });
  expect(await Mutation._setStatusMedicineRequest(null, { requestId: 4, status: 'Approved', approvedBy: 5, notes: 'ready' }, ctx())).toEqual({ id: 4, status: 'Approved', items: [{ itemName: 'A' }] });
  expect(approved.query.mock.calls[2][1]).toEqual(['Approved', 5, 'ready', 4]);
  expect(approved.query).toHaveBeenCalledWith('COMMIT'); expect(approved.release).toHaveBeenCalled();
  const cancelled = makeClient([{ rows: [{ status: 'Approved' }] }, { rows: [{ id: 4, status: 'Cancelled' }] }]); db.connect.mockResolvedValueOnce(cancelled);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Mutation._setStatusMedicineRequest(null, { requestId: 4, status: 'Cancelled', approvedBy: null, notes: null }, ctx())).toMatchObject({ status: 'Cancelled' });
  expect(cancelled.query.mock.calls[2][1]).toEqual(['Cancelled', null, 4]);
  const failed = makeClient([{ rows: [{ status: 'Pending' }] }]); failed.query.mockRejectedValueOnce(Error('database down')); db.connect.mockResolvedValueOnce(failed);
  await expect(Mutation._setStatusMedicineRequest(null, { requestId: 4, status: 'Rejected' }, ctx())).rejects.toThrow('Database error');
  expect(failed.query).toHaveBeenCalledWith('ROLLBACK'); expect(failed.release).toHaveBeenCalled();
});

test('adding medicine requires a pending request, inserts each item and rolls back failures', async () => {
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: [] }, ctx(null))).rejects.toThrow('Unauthorized');
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: null }, ctx())).rejects.toThrow('At least one medicine item');
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: [] }, ctx())).rejects.toThrow('At least one medicine item');
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: [{ medicineId: 2 }] }, ctx())).rejects.toThrow('Medicine request not found');
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Approved' }] });
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: [{ medicineId: 2 }] }, ctx())).rejects.toThrow('Only Pending requests can be modified');
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Pending' }] });
  const client = makeClient([{ rows: [{ id: 1 }] }, { rows: [{ id: 2 }] }, { rows: [{ id: 4 }] }]); db.connect.mockResolvedValueOnce(client);
  db.query.mockResolvedValueOnce({ rows: [{ itemName: 'A' }] });
  expect(await Mutation._addMedicineToRequest(null, { requestId: 4, items: [{ medicineId: 2, quantity: 3 }, { batchId: 3 }] }, ctx())).toEqual({ id: 4, items: [{ itemName: 'A' }] });
  expect(client.query.mock.calls[1][1]).toEqual([4, 2, 3]);
  expect(client.query.mock.calls[2][1]).toEqual([4, 3, 1]);
  expect(client.query).toHaveBeenCalledWith('COMMIT'); expect(client.release).toHaveBeenCalled();
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Pending' }] });
  const empty = makeClient([{ rows: [{ id: 1 }] }, { rows: [] }]); db.connect.mockResolvedValueOnce(empty);
  expect(await Mutation._addMedicineToRequest(null, { requestId: 4, items: [{ medicineId: 2 }] }, ctx())).toBeUndefined();
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Pending' }] });
  const failed = makeClient([]); failed.query.mockRejectedValueOnce(Error('write failed')); db.connect.mockResolvedValueOnce(failed);
  await expect(Mutation._addMedicineToRequest(null, { requestId: 4, items: [{ medicineId: 2 }] }, ctx())).rejects.toThrow('Failed to add medicine to request');
  expect(failed.query).toHaveBeenCalledWith('ROLLBACK'); expect(failed.release).toHaveBeenCalled();
});
