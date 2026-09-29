jest.mock('../wrapper/wrapper.js', () => ({ Query: { _getAvailableMedicine: jest.fn(), _getMedicineRequestById: jest.fn(), _getMedicineRequests: jest.fn(), _getAllMedicineRequests: jest.fn() }, Mutation: { _setStatusMedicineRequest: jest.fn() } }));
jest.mock('../../../../../services/permit.js', () => ({ permissions: { inventory_allow_manage_requests: 'MANAGE_REQUESTS' }, getStaffBranch: jest.fn(), isMedicalPermittedBranchBased: jest.fn(), isMedicalPermittedPatientBased: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../../config/sockets', () => ({ isConnectedAnywhere: jest.fn(), emitToUserWithAck: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../../../../services/emailservice.js', () => ({ enqueueNotificationEmail: jest.fn() }));
jest.mock('../../../../../config/query.js', () => ({ findEmailByUserId: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ getPatientIdByRequestId: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../../services/permit.js');
const logger = require('../../../../../utils/logger.js');
const sockets = require('../../../../../config/sockets');
const helper = require('../wrapper/helper.js');
const { Query, Mutation } = require('./medical-resolver.js');
const ctx = (user = { id: 5 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
let consoleSpies;
beforeAll(() => { consoleSpies = ['log', 'error'].map(level => jest.spyOn(console, level).mockImplementation(() => {})); });
afterAll(() => consoleSpies.forEach(spy => spy.mockRestore()));
beforeEach(() => { jest.clearAllMocks(); permit.getStaffBranch.mockResolvedValue('Manila'); permit.isMedicalPermittedBranchBased.mockResolvedValue(true); permit.isMedicalPermittedPatientBased.mockResolvedValue(true); helper.getPatientIdByRequestId.mockResolvedValue(8); });

test('all staff queries require an authenticated user', async () => {
  const context = ctx(null);
  for (const [name, args] of [['getAvailableMedicine', {}], ['getMedicineRequestById', { requestId: 1 }], ['getMedicineRequests', { patientId: 8 }], ['getAllMedicineRequests', {}]]) {
    await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
  }
  await expect(Mutation.setStatusMedicineRequest(null, { requestId: 1, status: 'Approved' }, context)).rejects.toThrow('Unauthorized');
});

test('available medicine enforces staff branch and permission before delegating', async () => {
  const context = ctx();
  await expect(Query.getAvailableMedicine(null, { location: 'QuezonCity' }, context)).rejects.toThrow('Unauthorized');
  expect(Wrapper.Query._getAvailableMedicine).not.toHaveBeenCalled();
  permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
  await expect(Query.getAvailableMedicine(null, {}, context)).rejects.toThrow('Unauthorized');
  expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'MANAGE_REQUESTS', 'Arlegui');
  Wrapper.Query._getAvailableMedicine.mockResolvedValueOnce([{ id: 1 }]);
  expect(await Query.getAvailableMedicine(null, { location: 'Casal' }, context)).toEqual([{ id: 1 }]);
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity'); Wrapper.Query._getAvailableMedicine.mockResolvedValueOnce([]);
  expect(await Query.getAvailableMedicine(null, { location: 'QuezonCity' }, context)).toEqual([]);
  permit.getStaffBranch.mockResolvedValueOnce('Both'); Wrapper.Query._getAvailableMedicine.mockResolvedValueOnce([]);
  expect(await Query.getAvailableMedicine(null, { location: 'QuezonCity' }, context)).toEqual([]);
});

test('request reads check patient scope and branch permissions', async () => {
  const context = ctx();
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query.getMedicineRequestById(null, { requestId: 4 }, context)).rejects.toThrow('Unauthorized');
  expect(helper.getPatientIdByRequestId).toHaveBeenCalledWith(4);
  Wrapper.Query._getMedicineRequestById.mockResolvedValueOnce({ id: 4 });
  expect(await Query.getMedicineRequestById(null, { requestId: 4 }, context)).toEqual({ id: 4 });
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'MANAGE_REQUESTS', 8, false);
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query.getMedicineRequests(null, { patientId: 9 }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getMedicineRequests.mockResolvedValueOnce([{ id: 6 }]);
  expect(await Query.getMedicineRequests(null, { patientId: 8 }, context)).toEqual([{ id: 6 }]);
  await expect(Query.getAllMedicineRequests(null, { location: 'QuezonCity' }, context)).rejects.toThrow('Unauthorized');
  permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
  await expect(Query.getAllMedicineRequests(null, {}, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getAllMedicineRequests.mockResolvedValueOnce([{ id: 7 }]);
  expect(await Query.getAllMedicineRequests(null, { location: 'Arlegui' }, context)).toEqual([{ id: 7 }]);
  expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'MANAGE_REQUESTS', 'Arlegui');
});

test('status changes validate patient permission and supported transitions', async () => {
  const context = ctx(); const args = { requestId: 11, status: 'Approved', notes: 'ready' };
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.setStatusMedicineRequest(null, args, context)).rejects.toThrow('Unauthorized');
  await expect(Mutation.setStatusMedicineRequest(null, { ...args, status: 'Pending' }, context)).rejects.toThrow('Invalid status');
  expect(Wrapper.Mutation._setStatusMedicineRequest).not.toHaveBeenCalled();
});

test.each([
  ['Approved', 'Medicine Request Approved', 'approved'],
  ['Rejected', 'Medicine Request Rejected', 'rejected'],
  ['Cancelled', 'Medicine Request Cancelled', 'cancelled']
])('%s status delegates and sends a preference-aware patient notification', async (status, title, description) => {
  const context = ctx(); const result = { id: 11, patientId: 8, status };
  Wrapper.Mutation._setStatusMedicineRequest.mockResolvedValueOnce(result);
  sockets.notifyUser.mockResolvedValueOnce('socket');
  expect(await Mutation.setStatusMedicineRequest(null, { requestId: 11, status, notes: 'staff note' }, context)).toBe(result);
  expect(Wrapper.Mutation._setStatusMedicineRequest.mock.calls[0][1]).toEqual({ requestId: 11, status, approvedBy: 5, notes: 'staff note' });
  expect(sockets.notifyUser).toHaveBeenCalledWith(8, `medicine:request:${status.toLowerCase()}`, { requestId: 11, status, notes: 'staff note' }, expect.objectContaining({ title, notes: 'staff note', message: expect.stringContaining(description) }));
});

test('notification failures do not roll back a completed status change', async () => {
  const context = ctx(); const result = { id: 11, patientId: 8 };
  Wrapper.Mutation._setStatusMedicineRequest.mockResolvedValueOnce(result);
  sockets.notifyUser.mockRejectedValueOnce(Error('socket unavailable'));
  expect(await Mutation.setStatusMedicineRequest(null, { requestId: 11, status: 'Approved' }, context)).toBe(result);
  expect(sockets.notifyUser.mock.calls[0][3].notes).toBeNull();
  expect(logger.error).toHaveBeenCalledWith('Failed to send medicine request notification:', expect.any(Error));
});
