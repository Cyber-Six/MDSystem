jest.mock('../../../../config/query.js', () => ({
  query: jest.fn(), queryClient: jest.fn(), connect: jest.fn(), isUserValidated: jest.fn(),
  setExpiredPersonalTickets: jest.fn(), db: jest.fn(() => ({ query: jest.fn() })),
}));
jest.mock('../../../../utils/graphql-helper.js', () => ({
  throwGraphQLError: jest.fn(() => {
    const chain = { message: jest.fn(), status: jest.fn(), throw: jest.fn() };
    chain.message.mockReturnValue(chain); chain.status.mockReturnValue(chain);
    chain.throw.mockImplementation(() => { throw new Error(`GraphQL ${chain.status.mock.lastCall[0]}: ${chain.message.mock.lastCall[0]}`); });
    return chain;
  }),
}));
jest.mock('../../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../../config/query.js');
const logger = require('../../../../utils/logger.js');
const { Query, Mutation } = require('./wrapper.js');

const context = { user: { id: 7 }, res: {} };
const result = (...rows) => ({ rows });
const recordInput = (values = {}) => ({ first_name: 'Ada', middle_name: null, last_name: 'Lovelace', suffix: null, date_of_birth: '1815-12-10', sex: 'F', civil_status: 'Single', nationality: 'British', religion: 'None', contactNumber: '123', present_address: 'A', province_address: 'B', ...values });

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test.each([
  ['_getUserCredentialStatus', { status: 'Active' }, 'Active'],
  ['_getUserPersonalRecord', { id: 7 }, { id: 7 }],
  ['_getBranchIdentifier', { identifier: 'P1', branch: 'Manila' }, { identifier: 'P1', branch: 'Manila' }],
  ['_getUserLoginCredentials', { email: 'a@b.test' }, { email: 'a@b.test' }],
])('queries %s and returns its first row', async (method, row, expected) => {
  db.query.mockResolvedValue(result(row));
  await expect(Query[method](null, { userId: 7 }, context)).resolves.toEqual(expected);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [7]);
});

test.each(['_getUserCredentialStatus', '_getUserPersonalRecord', '_getUserPersonalRecordLogStatus', '_getUserPersonalRecordLog', '_getBranchIdentifier', '_getUserLoginCredentials'])('rejects missing user ID for %s', async method => {
  await expect(Query[method](null, { userId: 0 }, context)).rejects.toThrow('GraphQL 401: Unauthorized');
});

test('query methods return nulls and empty logs for absent rows', async () => {
  db.query.mockResolvedValue(result());
  for (const method of ['_getUserCredentialStatus', '_getUserPersonalRecord', '_getBranchIdentifier', '_getUserLoginCredentials']) {
    await expect(Query[method](null, { userId: 7 }, context)).resolves.toBeNull();
  }
  await expect(Query._getUserPersonalRecordLog(null, { userId: 7 }, context)).resolves.toEqual([]);
});

test('personal log status handles pending, expired, unvalidated, and final statuses', async () => {
  db.query.mockResolvedValueOnce(result({ id: 1, status: 'Pending', created_at: new Date(Date.now() - 1000) }));
  await expect(Query._getUserPersonalRecordLogStatus(null, { userId: 7 }, context)).resolves.toEqual({ id: 1, patientId: 7, status: 'Pending' });
  db.query.mockResolvedValueOnce(result({ id: 2, status: 'Pending', created_at: new Date('2000-01-01') }));
  db.isUserValidated.mockResolvedValueOnce(true);
  await expect(Query._getUserPersonalRecordLogStatus(null, { userId: 7 }, context)).resolves.toEqual({ id: 2, patientId: 7, status: 'Expired' });
  expect(db.setExpiredPersonalTickets).toHaveBeenCalledWith(2);
  db.query.mockResolvedValueOnce(result({ id: 3, status: 'Pending', created_at: new Date('2000-01-01') }));
  db.isUserValidated.mockResolvedValueOnce(false);
  await expect(Query._getUserPersonalRecordLogStatus(null, { userId: 7 }, context)).resolves.toMatchObject({ status: 'Pending' });
  db.query.mockResolvedValueOnce(result({ id: 4, status: 'Approved' }));
  await expect(Query._getUserPersonalRecordLogStatus(null, { userId: 7 }, context)).resolves.toEqual({ id: 4, patientId: 7, status: 'Approved' });
  expect(logger.debug).toHaveBeenCalled();
});

test('personal record log applies date, offset and limit defaults and explicit values', async () => {
  db.query.mockResolvedValueOnce(result({ id: 1 }));
  await expect(Query._getUserPersonalRecordLog(null, { userId: 7 }, context)).resolves.toEqual([{ id: 1 }]);
  expect(db.query.mock.calls[0][1]).toEqual([7, new Date('1970-01-01T00:00:00Z'), 0, 10]);
  db.query.mockResolvedValueOnce(result());
  await Query._getUserPersonalRecordLog(null, { userId: 7, from: '2024-02-01', offset: 3, limit: 5 }, context);
  expect(db.query.mock.calls[1][1]).toEqual([7, new Date('2024-02-01'), 3, 5]);
});

test('_PersonalRecordLog inserts pending input and translates database failures', async () => {
  db.queryClient.mockResolvedValueOnce(result({ id: 9, status: 'Pending' }));
  await expect(Mutation._PersonalRecordLog(null, { client: {}, userId: 7, input: recordInput() }, context)).resolves.toEqual({ id: 9, status: 'Pending' });
  expect(db.queryClient.mock.calls[0][2]).toEqual([7, 'Ada', null, 'Lovelace', null, '1815-12-10', 'F', 'Single', 'British', 'None', '123', 'A', 'B', 'Pending']);
  db.queryClient.mockRejectedValueOnce(new Error('db'));
  await expect(Mutation._PersonalRecordLog(null, { client: {}, userId: 7, input: recordInput() }, context)).rejects.toThrow('GraphQL 500: Database error');
  expect(logger.error).toHaveBeenCalled();
});

test('uses the configured database client when mutation client arguments are omitted', async () => {
  const implicitClient = { query: jest.fn().mockResolvedValue(result({ id: 5 })) };
  db.db.mockReturnValue(implicitClient);
  db.queryClient.mockResolvedValue(result({ id: 5 }));
  await expect(Mutation._PersonalRecordLog(null, { userId: 7, input: recordInput() }, context)).resolves.toEqual({ id: 5 });
  expect(db.queryClient).toHaveBeenCalledWith(implicitClient, expect.any(String), expect.any(Array));
  db.query.mockResolvedValueOnce(result({ exists: false }));
  await expect(Mutation._reloadCredentialStatus(null, { userId: 7 }, context)).resolves.toMatchObject({ success: false });
});

test('_UpdatePersonalRecordLog updates provided fields and rejects empty or missing updates', async () => {
  db.queryClient.mockResolvedValueOnce(result({ id: 4 }));
  await expect(Mutation._UpdatePersonalRecordLog(null, { client: {}, userId: 7, ticketId: 4, input: { first_name: 'Grace', optional: null } }, context)).resolves.toEqual({ id: 4 });
  expect(db.queryClient.mock.calls[0][2]).toEqual(['Grace', 'RevisionSubmitted', 7, 4]);
  await expect(Mutation._UpdatePersonalRecordLog(null, { client: {}, userId: 7, ticketId: 4, input: { a: null } }, context)).rejects.toThrow('GraphQL 400: No fields to update.');
  db.queryClient.mockResolvedValueOnce(result());
  await expect(Mutation._UpdatePersonalRecordLog(null, { client: {}, userId: 7, ticketId: 4, input: { a: 1 } }, context)).rejects.toThrow('GraphQL 500: Database error');
});

test('uses the configured client for revision and branch identifier writes when omitted', async () => {
  const implicitClient = { query: jest.fn().mockResolvedValue(result({ id: 8 })) };
  db.db.mockReturnValue(implicitClient);
  db.queryClient.mockResolvedValue(result({ id: 8 }));
  await expect(Mutation._UpdatePersonalRecordLog(null, { userId: 7, ticketId: 4, input: { first_name: 'Ada' } }, context)).resolves.toEqual({ id: 8 });
  const branchClient = { query: jest.fn().mockResolvedValue(result({ id: 7, identifier: 'P1', branch: 'Manila' })) };
  db.db.mockReturnValue(branchClient);
  await expect(Mutation._UserBranchIdentifier(null, { userId: 7, input: { identifier: 'P1', branch: 'Manila' } }, context)).resolves.toEqual({ id: 7, identifier: 'P1', branch: 'Manila' });
  expect(branchClient.query.mock.calls[0][1]).toEqual([7, 'P1', 'Manila']);
});

test('_UserBranchIdentifier validates input, persists values, and maps database errors', async () => {
  const client = { query: jest.fn().mockResolvedValue(result({ id: 7, identifier: 'P1', branch: 'Manila' })) };
  await expect(Mutation._UserBranchIdentifier(null, { client, userId: 7, input: { identifier: 'P1', branch: 'Manila' } }, context)).resolves.toEqual({ id: 7, identifier: 'P1', branch: 'Manila' });
  await expect(Mutation._UserBranchIdentifier(null, { client, userId: 7, input: {} }, context)).rejects.toThrow('GraphQL 400: Both identifier and branch are required.');
  client.query.mockRejectedValueOnce(new Error('db'));
  await expect(Mutation._UserBranchIdentifier(null, { client, userId: 7, input: { identifier: 'P1', branch: 'Manila' } }, context)).rejects.toThrow('GraphQL 500: Database error');
});

test('_setPersonalRecordLog checks branch identity, handles empty results, approves transactionally and rolls back failures', async () => {
  db.query.mockResolvedValueOnce(result({ identifier: null, branch: null }));
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).rejects.toThrow('GraphQL 400: Branch identifier not set. Please notify the patient to set their branch identifier.');
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const emptyClient = { query: jest.fn().mockResolvedValue(result()), release: jest.fn() };
  db.connect.mockResolvedValueOnce(emptyClient);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Rejected' }, context)).resolves.toBeNull();
  expect(emptyClient.query).toHaveBeenCalledWith('BEGIN'); expect(emptyClient.release).toHaveBeenCalled();
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const denied = { query: jest.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(result({ id: 9, status: 'Rejected' })), release: jest.fn() };
  db.connect.mockResolvedValueOnce(denied);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Rejected' }, context)).resolves.toBe('Rejected');
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const patientUpdate = { query: jest.fn()
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 10, status: 'Approved', first_name: 'Ada' }))
    .mockResolvedValueOnce(result({ exists: true }))
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 7, first_name: 'Ada' })), release: jest.fn() };
  db.connect.mockResolvedValueOnce(patientUpdate);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).resolves.toBe('Approved');
  expect(patientUpdate.query).toHaveBeenCalledWith('BEGIN');
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const insertOnMissing = { query: jest.fn()
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 11, status: 'Approved', first_name: 'Grace', unexpected: 'ignored' }))
    .mockResolvedValueOnce(result({ exists: false }))
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 7, first_name: 'Grace' })), release: jest.fn() };
  db.connect.mockResolvedValueOnce(insertOnMissing);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).resolves.toBe('Approved');
  expect(insertOnMissing.query.mock.calls[4][0]).toContain('INSERT INTO "UsersPersonal"');
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const invalidFields = { query: jest.fn()
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 12, status: 'Approved', unexpected: 'ignored' }))
    .mockResolvedValueOnce(result({ exists: false })), release: jest.fn() };
  db.connect.mockResolvedValueOnce(invalidFields);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).rejects.toThrow('GraphQL 500: Database error');
  expect(invalidFields.query).toHaveBeenCalledWith('ROLLBACK');
  const broken = { query: jest.fn(async sql => { if (sql === 'BEGIN') throw new Error('failure'); return result(); }), release: jest.fn() };
  db.query.mockRejectedValueOnce(new Error('branch lookup'));
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).rejects.toThrow('branch lookup');
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' })); db.connect.mockResolvedValueOnce(broken);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Rejected' }, context)).rejects.toThrow('GraphQL 500: Database error');
  expect(broken.query).toHaveBeenCalledWith('ROLLBACK'); expect(broken.release).toHaveBeenCalled();
  db.query.mockResolvedValueOnce(result({ identifier: 'P1', branch: 'Manila' }));
  const applyFailure = { query: jest.fn()
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ id: 13, status: 'Approved', first_name: 'Ada' }))
    .mockResolvedValueOnce(result({ exists: true }))
    .mockResolvedValueOnce(result())
    .mockRejectedValueOnce(new Error('apply update failed'))
    .mockResolvedValueOnce(result()), release: jest.fn() };
  db.connect.mockResolvedValueOnce(applyFailure);
  await expect(Mutation._setPersonalRecordLog(null, { userId: 7, status: 'Approved' }, context)).rejects.toThrow('GraphQL 500: Database error');
  expect(logger.error).toHaveBeenCalledWith('Error in applyUpdatePersonalRecord:', expect.any(Error));
  expect(applyFailure.query).toHaveBeenLastCalledWith('ROLLBACK');
});

test('_reloadCredentialStatus distinguishes verified users and the EMR caller', async () => {
  const client = { query: jest.fn()
    .mockResolvedValueOnce(result({ exists: false }))
    .mockResolvedValueOnce(result({ exists: true })).mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ exists: true })).mockResolvedValueOnce(result()) };
  await expect(Mutation._reloadCredentialStatus(null, { userId: 7, client }, context)).resolves.toMatchObject({ success: false });
  await expect(Mutation._reloadCredentialStatus(null, { userId: 7, client }, context)).resolves.toMatchObject({ success: true });
  await expect(Mutation._reloadCredentialStatus(null, { userId: 7, client, caller: 'emr' }, context)).resolves.toMatchObject({ success: true });
  expect(client.query.mock.calls[4][0]).not.toContain("credentials_status != 'Inactive'");
});

test('_cancelPersonalRecordLog returns status and translates missing records or query errors', async () => {
  db.query.mockResolvedValueOnce(result({ status: 'Cancelled' }));
  await expect(Mutation._cancelPersonalRecordLog(null, { userId: 7 }, context)).resolves.toBe('Cancelled');
  db.query.mockResolvedValueOnce(result());
  await expect(Mutation._cancelPersonalRecordLog(null, { userId: 7 }, context)).rejects.toThrow('GraphQL 500: Database error');
  db.query.mockRejectedValueOnce(new Error('db'));
  await expect(Mutation._cancelPersonalRecordLog(null, { userId: 7 }, context)).rejects.toThrow('GraphQL 500: Database error');
});

test('_StaffUpdatePersonalRecordLog handles empty, successful, missing and failing updates', async () => {
  await expect(Mutation._StaffUpdatePersonalRecordLog(null, { userId: 7, id: 2, input: { a: null } }, context)).resolves.toEqual({ success: false, message: 'No fields to update.' });
  db.query.mockResolvedValueOnce(result({ id: 2 }));
  await expect(Mutation._StaffUpdatePersonalRecordLog(null, { userId: 7, id: 2, input: { a: 1 } }, context)).resolves.toEqual({ id: 2 });
  db.query.mockResolvedValueOnce(result());
  await expect(Mutation._StaffUpdatePersonalRecordLog(null, { userId: 7, id: 2, input: { a: 1 } }, context)).rejects.toThrow('GraphQL 500: Database error');
  db.query.mockRejectedValueOnce(new Error('db'));
  await expect(Mutation._StaffUpdatePersonalRecordLog(null, { userId: 7, id: 2, input: { a: 1 } }, context)).rejects.toThrow('GraphQL 500: Database error');
});

test('_staffSetCredentialStatus accepts Locked and Active and handles validation, missing users, and errors', async () => {
  db.query.mockResolvedValueOnce(result({ credentials_status: 'Locked' })).mockResolvedValueOnce(result({ credentials_status: 'Active' }));
  await expect(Mutation._staffSetCredentialStatus(null, { userId: 7, status: 'Locked' }, context)).resolves.toEqual({ credentials_status: 'Locked' });
  await expect(Mutation._staffSetCredentialStatus(null, { userId: 7, status: 'Active' }, context)).resolves.toEqual({ credentials_status: 'Active' });
  await expect(Mutation._staffSetCredentialStatus(null, { userId: 7, status: 'Other' }, context)).rejects.toThrow('GraphQL 400: Invalid credential status');
  db.query.mockResolvedValueOnce(result());
  await expect(Mutation._staffSetCredentialStatus(null, { userId: 7, status: 'Active' }, context)).rejects.toThrow('GraphQL 500: Database error');
  db.query.mockRejectedValueOnce(new Error('db'));
  await expect(Mutation._staffSetCredentialStatus(null, { userId: 7, status: 'Locked' }, context)).rejects.toThrow('GraphQL 500: Database error');
});
