jest.mock('../wrapper/wrapper.js', () => ({
  Query: { _getUserCredentialStatus: jest.fn(), _getUserPersonalRecord: jest.fn(), _getUserPersonalRecordLog: jest.fn(), _getUserPersonalRecordLogStatus: jest.fn() },
  Mutation: { _UpdatePersonalRecordLog: jest.fn(), _PersonalRecordLog: jest.fn(), _UserBranchIdentifier: jest.fn(), _cancelPersonalRecordLog: jest.fn(), _reloadCredentialStatus: jest.fn() }
}));
jest.mock('../../../../utils/validator.js', () => ({ getStudentBranchFromEmail: jest.fn(), isStudentEmail: jest.fn(), isEmployeeEmail: jest.fn(), isMedicalEmail: jest.fn() }));
jest.mock('../../../../config/query.js', () => ({ findEmailByUserId: jest.fn(), connect: jest.fn() }));
jest.mock('../../../../utils/logger.js', () => ({ error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const db = require('../../../../config/query.js');
const validator = require('../../../../utils/validator.js');
const logger = require('../../../../utils/logger.js');
const { Query, Mutation } = require('./patient-resolver.js');
const ctx = (user = { id: 7 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
const client = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); db.findEmailByUserId.mockResolvedValue('student@example.com'); validator.isStudentEmail.mockReturnValue(false); validator.getStudentBranchFromEmail.mockReturnValue('Manila'); });

test('all patient profile operations require authentication', async () => {
  const context = ctx(null);
  for (const operation of Object.values(Query)) await expect(operation(null, {}, context)).rejects.toThrow('Unauthorized');
  for (const operation of Object.values(Mutation)) await expect(operation(null, { input: {} }, context)).rejects.toThrow('Unauthorized');
  expect(db.findEmailByUserId).not.toHaveBeenCalled();
});

test('self-service queries use the caller ID and normalize missing data', async () => {
  const context = ctx();
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Active');
  expect(await Query.getCredentialStatus(null, {}, context)).toBe('Active');
  Wrapper.Query._getUserPersonalRecord.mockResolvedValueOnce({ id: 7 });
  expect(await Query.getPersonalRecord(null, {}, context)).toEqual({ id: 7 });
  Wrapper.Query._getUserPersonalRecordLog.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValueOnce([]).mockResolvedValueOnce(null);
  expect(await Query.getPersonalRecordLog(null, {}, context)).toEqual({ id: 4 });
  expect(Wrapper.Query._getUserPersonalRecordLog.mock.calls[0][1]).toEqual({ userId: 7, offset: 0, limit: 1 });
  expect(await Query.getPersonalRecordLog(null, {}, context)).toBeNull();
  expect(await Query.getPersonalRecordLog(null, {}, context)).toBeNull();
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status: 'Pending' }).mockResolvedValueOnce(null);
  expect(await Query.getPersonalRecordLogStatus(null, {}, context)).toBe('Pending');
  expect(await Query.getPersonalRecordLogStatus(null, {}, context)).toBeUndefined();
  expect(await Query.getLoginEmail(null, {}, context)).toBe('student@example.com');
  db.findEmailByUserId.mockResolvedValueOnce(null);
  expect(await Query.getLoginEmail(null, {}, context)).toBeNull();
});

test('initial profile creation rejects ineligible credentials, concurrent updates and missing email', async () => {
  const context = ctx(); const args = { input: {} };
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Active');
  await expect(Mutation.createInitialPersonalRecord(null, args, context)).rejects.toThrow('Initial profile can only be created');
  for (const status of ['Pending', 'InProgress', 'RevisionSubmitted']) {
    Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified');
    Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status });
    await expect(Mutation.createInitialPersonalRecord(null, args, context)).rejects.toThrow(status === 'RevisionSubmitted' ? 'Revision still pending' : 'An update is already in progress');
  }
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified');
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  db.findEmailByUserId.mockResolvedValueOnce(null);
  await expect(Mutation.createInitialPersonalRecord(null, args, context)).rejects.toThrow('Email not found');
  validator.isStudentEmail.mockReturnValueOnce(true); validator.getStudentBranchFromEmail.mockReturnValueOnce(null);
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  await expect(Mutation.createInitialPersonalRecord(null, { input: {} }, context)).rejects.toThrow('Unable to determine branch');
  expect(db.connect).not.toHaveBeenCalled();
});

test('initial profile creates a record transactionally with student branch and default branch fallback', async () => {
  const context = ctx(); const firstClient = client(); db.connect.mockResolvedValueOnce(firstClient);
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  validator.isStudentEmail.mockReturnValueOnce(true);
  Wrapper.Mutation._PersonalRecordLog.mockResolvedValueOnce({ logId: 1 }); Wrapper.Mutation._UserBranchIdentifier.mockResolvedValueOnce({ identifier: 'A' });
  const studentInput = {};
  expect(await Mutation.createInitialPersonalRecord(null, { input: studentInput }, context)).toEqual({ identifier: 'A', logId: 1 });
  expect(studentInput.branch).toBe('Manila'); expect(firstClient.query).toHaveBeenCalledWith('COMMIT'); expect(firstClient.release).toHaveBeenCalled();
  const secondClient = client(); db.connect.mockResolvedValueOnce(secondClient);
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status: 'Revision' });
  Wrapper.Mutation._UpdatePersonalRecordLog.mockResolvedValueOnce({ logId: 2 }); Wrapper.Mutation._UserBranchIdentifier.mockResolvedValueOnce({ identifier: 'B' });
  const revisedInput = {};
  expect(await Mutation.createInitialPersonalRecord(null, { input: revisedInput }, context)).toEqual({ identifier: 'B', logId: 2 });
  expect(revisedInput.branch).toBe('Both'); expect(Wrapper.Mutation._UpdatePersonalRecordLog).toHaveBeenCalled();
  expect(secondClient.release).toHaveBeenCalled();
  const thirdClient = client(); db.connect.mockResolvedValueOnce(thirdClient);
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  Wrapper.Mutation._PersonalRecordLog.mockResolvedValueOnce({ logId: 3 }); Wrapper.Mutation._UserBranchIdentifier.mockResolvedValueOnce({ identifier: 'C' });
  const suppliedInput = { branch: 'QuezonCity' };
  expect(await Mutation.createInitialPersonalRecord(null, { input: suppliedInput }, context)).toEqual({ identifier: 'C', logId: 3 });
  expect(suppliedInput.branch).toBe('QuezonCity');
});

test('initial profile rolls back when an update, insert, or transaction fails', async () => {
  const context = ctx();
  for (const [status, operation] of [['Revision', '_UpdatePersonalRecordLog'], [null, '_PersonalRecordLog']]) {
    const connection = client(); db.connect.mockResolvedValueOnce(connection);
    Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(status ? { status } : null);
    Wrapper.Mutation[operation].mockResolvedValueOnce(null);
    await expect(Mutation.createInitialPersonalRecord(null, { input: {} }, context)).rejects.toThrow('Failed to create initial personal record');
    expect(connection.query).toHaveBeenCalledWith('ROLLBACK'); expect(connection.release).toHaveBeenCalled();
  }
  const connection = client(); connection.query.mockRejectedValueOnce(Error('db down')); db.connect.mockResolvedValueOnce(connection);
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  await expect(Mutation.createInitialPersonalRecord(null, { input: {} }, context)).rejects.toThrow('Failed to create initial personal record');
  expect(logger.error).toHaveBeenCalledWith('Error creating initial personal record:', expect.any(Error));
});

test('update ticket creation respects credential and current log state', async () => {
  const context = ctx(); const args = { input: { phone: '1' } };
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Unverified');
  await expect(Mutation.createPersonalRecordLog(null, args, context)).rejects.toThrow('Only active or inactive users');
  for (const status of ['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']) {
    Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Active'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status });
    await expect(Mutation.createPersonalRecordLog(null, args, context)).rejects.toThrow(['Revision', 'RevisionSubmitted'].includes(status) ? 'Revision still pending' : 'An update is already in progress');
  }
  Wrapper.Query._getUserCredentialStatus.mockResolvedValueOnce('Inactive'); Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  Wrapper.Mutation._PersonalRecordLog.mockResolvedValueOnce({ id: 1 });
  expect(await Mutation.createPersonalRecordLog(null, args, context)).toEqual({ id: 1 });
});

test('patient edits and cancellations enforce current ticket state', async () => {
  const context = ctx(); const args = { input: { phone: '2' } };
  for (const status of ['Pending', 'InProgress', 'Revision', 'RevisionSubmitted']) {
    Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status });
    await expect(Mutation.updatePatientPersonalRecordLog(null, args, context)).rejects.toThrow(['Revision', 'RevisionSubmitted'].includes(status) ? 'Revision still pending' : 'An update is already in progress');
  }
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null); Wrapper.Mutation._PersonalRecordLog.mockResolvedValueOnce({ id: 2 });
  expect(await Mutation.updatePatientPersonalRecordLog(null, args, context)).toEqual({ id: 2 });
  Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce(null);
  await expect(Mutation.cancelPersonalRecordLog(null, {}, context)).rejects.toThrow('No active update found');
  for (const status of ['Pending', 'InProgress', 'Revision']) {
    Wrapper.Query._getUserPersonalRecordLogStatus.mockResolvedValueOnce({ status }); Wrapper.Mutation._cancelPersonalRecordLog.mockResolvedValueOnce({ cancelled: true });
    expect(await Mutation.cancelPersonalRecordLog(null, {}, context)).toEqual({ cancelled: true });
  }
  Wrapper.Mutation._reloadCredentialStatus.mockResolvedValueOnce('Active');
  expect(await Mutation.reloadCredentialStatus(null, {}, context)).toBe('Active');
});
