jest.mock('../../../config/query.js', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../query/upsert.js', () => ({ upsertEmergencyNumber: jest.fn() }));
jest.mock('../query/anchor.js', () => ({}));
jest.mock('../query/delete.js', () => ({}));
jest.mock('../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../utils/validator.js', () => ({ generateDomainCodes: jest.fn(), normalizeName: jest.fn() }));
jest.mock('../../profile/resolvers/wrapper/wrapper.js', () => ({ Mutation: { _reloadCredentialStatus: jest.fn() } }));
jest.mock('../resolvers/record-validator.js', () => ({ validateUpdateTicket: jest.fn() }));

const Mutation = require('./mutation.js');

test('rejects invalid staff ticket statuses before opening a database transaction', async () => {
  await expect(Mutation._StaffUpdateTicket(null, { args: { status: 'Pending' }, recordId: 1, scope: 'Both' }, { user: { id: 3 }, res: {} })).rejects.toThrow("400:Invalid status. Must be 'Approved', 'Revision', or 'Rejected'.");
});
