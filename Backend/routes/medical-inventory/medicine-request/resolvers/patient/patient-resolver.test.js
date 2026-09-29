jest.mock('../wrapper/wrapper.js', () => ({ Query: { _getAvailableMedicine: jest.fn(), _getMedicineStatus: jest.fn(), _getMedicineRequestById: jest.fn(), _getMedicineRequests: jest.fn() }, Mutation: { _createMedicineRequest: jest.fn(), _setStatusMedicineRequest: jest.fn() } }));
jest.mock('../wrapper/helper.js', () => ({ hasActiveRequest: jest.fn(), validateBatchesWithQuantity: jest.fn() }));
jest.mock('../../../../../config/sockets', () => ({ emitToRoom: jest.fn() }));
jest.mock('../../../../../config/query.js', () => ({ getUserBranch: jest.fn(), query: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const helper = require('../wrapper/helper.js');
const db = require('../../../../../config/query.js');
const sockets = require('../../../../../config/sockets');
const logger = require('../../../../../utils/logger.js');
const { Query, Mutation } = require('./patient-resolver.js');
const ctx = (user = { id: 6 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
let consoleSpies;
beforeAll(() => { consoleSpies = ['log', 'warn', 'error'].map(level => jest.spyOn(console, level).mockImplementation(() => {})); });
afterAll(() => consoleSpies.forEach(spy => spy.mockRestore()));
beforeEach(() => { jest.clearAllMocks(); helper.hasActiveRequest.mockResolvedValue(false); helper.validateBatchesWithQuantity.mockResolvedValue(); db.getUserBranch.mockResolvedValue('Manila'); });

test('patient queries delegate permitted reads and reject cross-patient or staff-only access', async () => {
  const context = ctx();
  Wrapper.Query._getAvailableMedicine.mockResolvedValueOnce([{ id: 1 }]);
  expect(await Query.getAvailableMedicine(null, { location: 'Manila' }, context)).toEqual([{ id: 1 }]);
  Wrapper.Query._getMedicineStatus.mockResolvedValueOnce('Pending');
  expect(await Query.getMedicineStatus(null, {}, context)).toBe('Pending');
  expect(Wrapper.Query._getMedicineStatus.mock.calls[0][1]).toEqual({ patientId: 6 });
  Wrapper.Query._getMedicineRequestById.mockResolvedValueOnce({ id: 4 });
  expect(await Query.getMedicineRequestById(null, { requestId: 4 }, context)).toEqual({ id: 4 });
  Wrapper.Query._getMedicineRequests.mockResolvedValueOnce([{ id: 4 }]);
  expect(await Query.getMedicineRequests(null, { patientId: '6', offset: 1, limit: 2 }, context)).toEqual([{ id: 4 }]);
  await expect(Query.getMedicineRequests(null, { patientId: '8' }, context)).rejects.toThrow('Unauthorized');
  await expect(Query.getAllMedicineRequests(null, {}, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getAvailableMedicine.mockRejectedValueOnce(Error('database'));
  await expect(Query.getAvailableMedicine(null, {}, context)).rejects.toThrow('database');
  expect(logger.error).toHaveBeenCalledWith('Error in getAvailableMedicine:', expect.any(Error));
  Wrapper.Query._getAvailableMedicine.mockResolvedValueOnce(null);
  expect(await Query.getAvailableMedicine(null, {}, context)).toBeNull();
});

test('every patient-only operation rejects unauthenticated callers', async () => {
  const context = ctx(null);
  await expect(Query.getAvailableMedicine(null, {}, context)).rejects.toThrow('Unauthorized');
  await expect(Query.getMedicineStatus(null, {}, context)).rejects.toThrow('Unauthorized');
  await expect(Query.getMedicineRequestById(null, { requestId: 1 }, context)).rejects.toThrow('Unauthorized');
  await expect(Query.getMedicineRequests(null, { patientId: 1 }, context)).rejects.toThrow('Unauthorized');
  await expect(Mutation.createMedicineRequest(null, { input: {} }, context)).rejects.toThrow('Unauthorized');
  await expect(Mutation.cancelMedicineRequest(null, {}, context)).rejects.toThrow('Unauthorized');
  await expect(Mutation.setStatusMedicineRequest(null, {}, context)).rejects.toThrow('Unauthorized');
});

test('creation rejects active requests and invalid or absent item quantities', async () => {
  const context = ctx();
  helper.hasActiveRequest.mockResolvedValueOnce(true);
  await expect(Mutation.createMedicineRequest(null, { input: { items: [] } }, context)).rejects.toThrow('already have a pending medicine request');
  for (const items of [undefined, [], [null], [{ batchId: 'x', quantity: 1 }], [{ batchId: 2, quantity: 0 }], [{ batchId: 2, quantity: 1.5 }]]) {
    await expect(Mutation.createMedicineRequest(null, { input: { items, location: 'Manila' } }, context)).rejects.toThrow(items?.length ? 'valid batchId and positive quantity' : 'At least one medicine item');
  }
  expect(Wrapper.Mutation._createMedicineRequest).not.toHaveBeenCalled();
});

test('creation merges duplicate batches, validates quantities and broadcasts to assigned branch locations', async () => {
  const context = ctx();
  Wrapper.Mutation._createMedicineRequest.mockResolvedValue({ id: 21 });
  const input = { location: 'Manila', items: [{ batchId: 2, quantity: 1 }, { batchId: 2, quantity: 3 }, { medicineId: 4, quantity: 2 }] };
  expect(await Mutation.createMedicineRequest(null, { input }, context)).toEqual({ id: 21 });
  expect(helper.validateBatchesWithQuantity).toHaveBeenCalledWith([{ batchId: 2, quantity: 4 }, { batchId: 4, quantity: 2 }], 'Manila', context.res);
  expect(Wrapper.Mutation._createMedicineRequest.mock.calls[0][1]).toEqual({ patientId: 6, input });
  expect(sockets.emitToRoom).toHaveBeenCalledWith('branch:Arlegui:inventory', 'medicine:request:new', { requestId: 21, patientId: 6, location: 'Arlegui' });
  expect(sockets.emitToRoom).toHaveBeenCalledWith('branch:Casal:inventory', 'medicine:request:new', { requestId: 21, patientId: 6, location: 'Casal' });
  db.getUserBranch.mockResolvedValueOnce('QuezonCity');
  await Mutation.createMedicineRequest(null, { input }, context);
  expect(sockets.emitToRoom).toHaveBeenCalledWith('branch:QuezonCity:inventory', 'medicine:request:new', expect.any(Object));
  db.getUserBranch.mockResolvedValueOnce('Both');
  await Mutation.createMedicineRequest(null, { input }, context);
  expect(sockets.emitToRoom).toHaveBeenCalledTimes(6);
  db.getUserBranch.mockResolvedValueOnce('Remote');
  await Mutation.createMedicineRequest(null, { input }, context);
  expect(sockets.emitToRoom).toHaveBeenCalledWith('branch:Remote:inventory', 'medicine:request:new', expect.any(Object));
});

test('notification absence or failure does not undo a created request', async () => {
  const context = ctx(); const input = { items: [{ batchId: 1, quantity: 1 }] };
  Wrapper.Mutation._createMedicineRequest.mockResolvedValue({ id: 22 });
  db.getUserBranch.mockResolvedValueOnce(null);
  expect(await Mutation.createMedicineRequest(null, { input }, context)).toEqual({ id: 22 });
  expect(sockets.emitToRoom).not.toHaveBeenCalled();
  db.getUserBranch.mockRejectedValueOnce(Error('offline'));
  expect(await Mutation.createMedicineRequest(null, { input }, context)).toEqual({ id: 22 });
  expect(console.error).toHaveBeenCalled();
});

test('cancel selects only the latest pending request and reports absence', async () => {
  const context = ctx();
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Mutation.cancelMedicineRequest(null, {}, context)).rejects.toThrow('Request not found');
  db.query.mockResolvedValueOnce({ rows: [{ id: 33, status: 'Pending' }] });
  Wrapper.Mutation._setStatusMedicineRequest.mockResolvedValueOnce({ success: true });
  expect(await Mutation.cancelMedicineRequest(null, {}, context)).toEqual({ success: true });
  expect(db.query.mock.calls[1][1]).toEqual([6]);
  expect(Wrapper.Mutation._setStatusMedicineRequest.mock.calls[0][1]).toEqual({ requestId: 33, status: 'Cancelled', approvedBy: null, notes: null });
});

test('module startup rejects absent or incomplete medicine wrappers', () => {
  for (const invalidWrapper of [null, {}, { Query: {} }]) {
    jest.resetModules();
    jest.doMock('../wrapper/wrapper.js', () => invalidWrapper);
    expect(() => jest.isolateModules(() => require('./patient-resolver.js'))).toThrow('Wrapper module not loaded correctly');
  }
});
