jest.mock('../wrapper/wrapper.js', () => ({
  Query: { _getUserCredentialStatus: jest.fn(), _getUserPersonalRecord: jest.fn(), _getUserPersonalRecordLogStatus: jest.fn(), _getUserPersonalRecordLog: jest.fn(), _getUserLoginCredentials: jest.fn() },
  Mutation: { _PersonalRecordLog: jest.fn(), _StaffUpdatePersonalRecordLog: jest.fn(), _setPersonalRecordLog: jest.fn(), _reloadCredentialStatus: jest.fn(), _UserBranchIdentifier: jest.fn() }
}));
jest.mock('../../../../services/authorization/permit.js', () => ({ permissions: { profile_allow_view: 'VIEW', profile_allow_edit: 'EDIT', profile_allow_approval: 'APPROVE' }, isMedicalPermittedPatientBased: jest.fn() }));
jest.mock('../../../../utils/logger.js', () => ({ warn: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../services/authorization/permit.js');
const logger = require('../../../../utils/logger.js');
const { Query, Mutation } = require('./medical-resolver.js');
const ctx = (user = { id: 5 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermittedPatientBased.mockResolvedValue(true); });

test('all profile queries and mutations require a medical user', async () => {
  const context = ctx(null);
  for (const [name, args] of [
    ['getUserCredentialStatus', { userId: 8 }], ['getUserPersonalRecord', { userId: 8 }], ['getUserPersonalRecordLogStatus', { userId: 8 }],
    ['getUserPersonalRecordLog', { userId: 8 }], ['getUserLoginCredentials', { userId: 8 }]
  ]) await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
  for (const [name, args] of [
    ['createPersonalRecordLog', { input: {} }], ['updatePersonalRecordLog', { userId: 8, input: {} }],
    ['setPersonalRecordLog', { userId: 8, status: 'Approved' }], ['reloadUserCredentialStatus', { userId: 8 }],
    ['staffSetBranchIdentifier', { userId: 8, identifier: 'A', branch: 'Manila' }]
  ]) await expect(Mutation[name](null, args, context)).rejects.toThrow('Unauthorized');
});

test('credential and profile reads return wrapper data with patient view permission', async () => {
  const context = ctx();
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Active');
  expect(await Query.getUserCredentialStatus(null, { userId: 8 }, context)).toBe('Active');
  Wrapper.Query._getUserPersonalRecord.mockResolvedValueOnce({ id: 8 });
  expect(await Query.getUserPersonalRecord(null, { userId: 8 }, context)).toEqual({ id: 8 });
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status: 'Pending' }).mockResolvedValueOnce(null);
  expect(await Query.getUserPersonalRecordLogStatus(null, { userId: 8 }, context)).toBe('Pending');
  expect(await Query.getUserPersonalRecordLogStatus(null, { userId: 8 }, context)).toBeUndefined();
  Wrapper.Query._getUserPersonalRecordLog.mockResolvedValueOnce([{ id: 2 }]);
  expect(await Query.getUserPersonalRecordLog(null, { userId: 8, from: '2026-01-01', offset: 1, limit: 3 }, context)).toEqual([{ id: 2 }]);
  Wrapper.Query._getUserLoginCredentials.mockResolvedValueOnce({ email: 'a@example.com' }).mockResolvedValueOnce(null);
  expect(await Query.getUserLoginCredentials(null, { userId: 8 }, context)).toEqual({ email: 'a@example.com' });
  expect(await Query.getUserLoginCredentials(null, { userId: 8 }, context)).toBeNull();
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'VIEW', 8);
});

test('view permission denials fail cleanly and never invoke patient data wrappers', async () => {
  const context = ctx(); permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  for (const [name, args] of [
    ['getUserPersonalRecord', { userId: 8 }], ['getUserPersonalRecordLogStatus', { userId: 8 }],
    ['getUserPersonalRecordLog', { userId: 8 }], ['getUserLoginCredentials', { userId: 8 }]
  ]) await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
  expect(logger.warn).toHaveBeenCalledTimes(4);
  expect(Wrapper.Query._getUserPersonalRecord).not.toHaveBeenCalled();
});

test('staff self-update creates a log and approves it through the approval workflow', async () => {
  const context = ctx(); Wrapper.Mutation._PersonalRecordLog.mockResolvedValueOnce({ id: 1 });
  Wrapper.Mutation._setPersonalRecordLog.mockResolvedValueOnce({ status: 'Approved' });
  expect(await Mutation.createPersonalRecordLog(null, { input: { name: 'Updated' } }, context)).toEqual({ status: 'Approved' });
  expect(Wrapper.Mutation._PersonalRecordLog.mock.calls[0][1]).toEqual({ userId: 5, input: { name: 'Updated' } });
  expect(Wrapper.Mutation._setPersonalRecordLog).toHaveBeenCalled();
  expect(Wrapper.Mutation._reloadCredentialStatus).toHaveBeenCalled();
});

test('staff edit uses latest log ID and rejects missing edit permission', async () => {
  const context = ctx(); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.updatePersonalRecordLog(null, { userId: 8, input: {} }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ id: 4 });
  Wrapper.Mutation._StaffUpdatePersonalRecordLog.mockResolvedValueOnce({ id: 4 });
  expect(await Mutation.updatePersonalRecordLog(null, { userId: 8, input: { phone: '1' } }, context)).toEqual({ id: 4 });
  expect(Wrapper.Mutation._StaffUpdatePersonalRecordLog.mock.calls[0][1]).toEqual({ userId: 8, id: 4, input: { phone: '1' } });
});

test('approval checks permission and status, then reloads credentials', async () => {
  const context = ctx(); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.setPersonalRecordLog(null, { userId: 8, status: 'Approved' }, context)).rejects.toThrow('Unauthorized');
  await expect(Mutation.setPersonalRecordLog(null, { userId: 8, status: 'Pending' }, context)).rejects.toThrow('Invalid status');
  for (const status of ['Revision', 'Approved', 'Rejected']) {
    Wrapper.Mutation._setPersonalRecordLog.mockResolvedValueOnce({ status });
    expect(await Mutation.setPersonalRecordLog(null, { userId: 8, status }, context)).toEqual({ status });
  }
  expect(Wrapper.Mutation._reloadCredentialStatus).toHaveBeenCalledTimes(3);
});

test('credential reload and branch identifier update delegate only with permission', async () => {
  const context = ctx(); Wrapper.Mutation._reloadCredentialStatus.mockResolvedValueOnce('Active');
  expect(await Mutation.reloadUserCredentialStatus(null, { userId: 8 }, context)).toBe('Active');
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.staffSetBranchIdentifier(null, { userId: 8, identifier: 'X', branch: 'Manila' }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Mutation._UserBranchIdentifier.mockResolvedValueOnce({ id: 8 });
  expect(await Mutation.staffSetBranchIdentifier(null, { userId: 8, identifier: 'X', branch: 'Manila' }, context)).toBe(true);
  expect(Wrapper.Mutation._UserBranchIdentifier.mock.calls[0][1]).toEqual({ userId: 8, input: { identifier: 'X', branch: 'Manila' } });
});
