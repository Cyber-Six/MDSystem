jest.mock('../../../../../config/query.js', () => ({ query: jest.fn(), connect: jest.fn(), findEmailByUserId: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../../config/sockets', () => ({ isConnectedAnywhere: jest.fn(), emitToUserWithAck: jest.fn(), emitToRole: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../../../../services/emailservice.js', () => ({ enqueueNotificationEmail: jest.fn() }));

const db = require('../../../../../config/query.js'); const logger = require('../../../../../utils/logger.js'); const sockets = require('../../../../../config/sockets');
const { Query, Mutation } = require('./wrapper.js');
const ctx = () => ({ res: { status: jest.fn().mockReturnThis() } });
const input = (overrides = {}) => ({ patientId: 7, items: [{ batchId: 2, quantity: 2 }], notes: 'care', ...overrides });
const client = responses => ({ query: jest.fn(async sql => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) ? { rows: [] } : responses.shift()), release: jest.fn() });
beforeEach(() => jest.clearAllMocks());

test('available medicine and patient prescriptions use location and pagination filters', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ batchId: 2 }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 8 }] });
  expect(await Query._getAvailableMedicine(null, { location: 'Manila' }, ctx())).toEqual([{ batchId: 2 }]);
  expect(db.query.mock.calls[0][1]).toEqual(['Manila', 0, 20]);
  expect(await Query._getAvailableMedicine(null, { offset: 3, limit: 4 }, ctx())).toEqual([]);
  expect(db.query.mock.calls[1][1]).toEqual([3, 4]);
  expect(await Query._getPatientPrescriptions(null, { patientId: 7, offset: 1, limit: 2 }, ctx())).toEqual([{ id: 8 }]);
  expect(db.query.mock.calls[2][1]).toEqual([7, 1, 2]);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query._getPatientPrescriptions(null, { patientId: 7 }, ctx())).toEqual([]);
  expect(db.query.mock.calls[3][1]).toEqual([7, 0, 20]);
});

test('direct prescriptions merge duplicate batches, commit stock and mirror into request history', async () => {
  const transaction = { id: 10 }; const connection = client([
    { rows: [{ available_count: '4' }] }, { rows: [transaction] },
    { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    { rows: [{ id: 2, medicalItemId: 22, location: 'Arlegui' }] },
    { rows: [{ id: 30 }] }, { rows: [{ id: 31 }] }
  ]); db.connect.mockResolvedValueOnce(connection);
  const request = input({ items: [{ batchId: 2, quantity: 1 }, { batchId: 2, quantity: 2 }] });
  expect(await Mutation._issuePrescription(null, { input: request, issuedBy: 5 }, ctx())).toEqual({ id: 10, items: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO "MedicineTransactionLog"'))[1]).toEqual([7, 3, 5, 'care']);
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('UPDATE "MedicineEntity"'))[1]).toEqual([10, 2, 3]);
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO "MedicineRequestEntity"'))[1]).toEqual([30, 22, 3]);
  expect(connection.query).toHaveBeenCalledWith('COMMIT'); expect(connection.release).toHaveBeenCalled();
  expect(sockets.emitToRole).toHaveBeenCalledWith('medical', 'inventory:stock-changed', expect.objectContaining({ totalQuantity: 3 }));
  expect(sockets.notifyUser).toHaveBeenCalledWith(7, 'medicine:prescription:issued', { transactionId: 10 }, expect.objectContaining({ notes: 'care' }));
});

test('direct prescription without batch metadata leaves location empty and tolerates notification errors', async () => {
  const connection = client([{ rows: [{ available_count: '1' }] }, { rows: [{ id: 11 }] }, { rows: [{ id: 1 }] }, { rows: [] }, { rows: [{ id: 31 }] }]);
  db.connect.mockResolvedValueOnce(connection); sockets.emitToRole.mockImplementationOnce(() => { throw Error('socket'); }); sockets.notifyUser.mockRejectedValueOnce(Error('notify'));
  expect(await Mutation._issuePrescription(null, { input: input({ items: [{ batchId: 2, quantity: 1 }], notes: null, requestId: null }), issuedBy: 5 }, ctx())).toEqual({ id: 11, items: [{ id: 1 }] });
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO "MedicineRequestLog"'))[1]).toEqual([7, null, null, 5]);
  expect(logger.warn).toHaveBeenCalled(); expect(logger.error).toHaveBeenCalledWith('Failed to send prescription notification:', expect.any(Error));
});

test('stock checks reject unavailable units with accurate singular and plural counts', async () => {
  for (const [available, quantity, expected] of [[1, 2, '1 unit available'], [2, 3, '2 units available']]) {
    const connection = client([{ rows: [{ available_count: String(available) }] }]); db.connect.mockResolvedValueOnce(connection);
    await expect(Mutation._issuePrescription(null, { input: input({ items: [{ batchId: 2, quantity }] }), issuedBy: 5 }, ctx())).rejects.toThrow(expected);
    expect(connection.query).toHaveBeenCalledWith('ROLLBACK'); expect(connection.release).toHaveBeenCalled();
  }
});

test('linked requests must exist, belong to the patient, be approved and remain undispensed', async () => {
  for (const [requestRows, expected] of [
    [[], 'Medicine request not found'],
    [[{ patientId: 8, status: 'Approved' }], 'does not belong'],
    [[{ patientId: 7, status: 'Pending' }], 'Only approved'],
    [[{ patientId: 7, status: 'Approved', transactionId: 100 }], 'already been dispensed']
  ]) {
    const connection = client([{ rows: [{ available_count: '2' }] }, { rows: requestRows }]); db.connect.mockResolvedValueOnce(connection);
    await expect(Mutation._issuePrescription(null, { input: input({ requestId: 20 }), issuedBy: 5 }, ctx())).rejects.toThrow(expected);
    expect(connection.query).toHaveBeenCalledWith('ROLLBACK'); expect(connection.release).toHaveBeenCalled();
  }
});

test('approved linked request is completed after stock assignment', async () => {
  const connection = client([
    { rows: [{ available_count: '2' }] }, { rows: [{ id: 20, patientId: '7', status: 'Approved', transactionId: null }] },
    { rows: [{ id: 12 }] }, { rows: [{ id: 1 }, { id: 2 }] }, { rows: [{ id: 20 }] }
  ]); db.connect.mockResolvedValueOnce(connection);
  expect(await Mutation._issuePrescription(null, { input: input({ requestId: 20, notes: '' }), issuedBy: 5 }, ctx())).toEqual({ id: 12, items: [{ id: 1 }, { id: 2 }] });
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('SET status = \'Completed\''))[1]).toEqual([5, null, 20]);
  expect(connection.query).toHaveBeenCalledWith('COMMIT');
});

test('assignment shortages and database failures roll back and preserve error type', async () => {
  const short = client([{ rows: [{ available_count: '2' }] }, { rows: [{ id: 13 }] }, { rows: [{ id: 1 }] }]); db.connect.mockResolvedValueOnce(short);
  await expect(Mutation._issuePrescription(null, { input: input(), issuedBy: 5 }, ctx())).rejects.toThrow('Insufficient available units');
  expect(short.query).toHaveBeenCalledWith('ROLLBACK');
  const failed = client([]); failed.query.mockRejectedValueOnce(Error('database down')); db.connect.mockResolvedValueOnce(failed);
  await expect(Mutation._issuePrescription(null, { input: input(), issuedBy: 5 }, ctx())).rejects.toThrow('Database error');
  expect(failed.release).toHaveBeenCalled();
  const httpError = Object.assign(Error('upstream rejected'), { extensions: { http: { status: 409 } } });
  const httpFailed = client([]); httpFailed.query.mockRejectedValueOnce(httpError); db.connect.mockResolvedValueOnce(httpFailed);
  await expect(Mutation._issuePrescription(null, { input: input(), issuedBy: 5 }, ctx())).rejects.toBe(httpError);
});
