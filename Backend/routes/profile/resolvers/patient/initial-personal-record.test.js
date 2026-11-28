jest.mock('../../../../config/query.js', () => ({
  query: jest.fn(), queryClient: jest.fn(), connect: jest.fn(), findEmailByUserId: jest.fn(),
}));
jest.mock('../../../emr/wrapper/query.js', () => ({ _getUserUpdateTicket: jest.fn() }));
jest.mock('../../../../utils/validator.js', () => ({
  isStudentEmail: jest.fn(() => true), getStudentBranchFromEmail: () => 'Manila',
}));
jest.mock('../../../../utils/logger.js', () => ({ error: jest.fn(), debug: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { graphql } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const resolvers = require('./patient-resolver');
const db = require('../../../../config/query');
const logger = require('../../../../utils/logger');
const { isStudentEmail } = require('../../../../utils/validator');
const schema = makeExecutableSchema({
  typeDefs: fs.readFileSync(path.join(__dirname, '../../schema.graphql'), 'utf8'), resolvers,
});
const input = {
  first_name: 'Synthetic', middle_name: '', last_name: 'Fixture', date_of_birth: '2000-01-01',
  sex: 'Male', civil_status: 'Single', nationality: 'Fixture', religion: '',
  contactNumber: '09000000000', present_address: 'Synthetic', province_address: 'Synthetic',
  identifier: '700001', branch: 'Manila',
};

beforeEach(() => {
  jest.clearAllMocks();
  isStudentEmail.mockReturnValue(true);
});

test('a personal-log SQL failure rolls back before branch setup and is masked only at the public boundary', async () => {
  const failure = Object.assign(new Error('synthetic foreign key violation'), {
    code: '23503', constraint: 'UsersPersonalLog_id_fkey', table: 'UsersPersonalLog',
  });
  const connection = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  db.connect.mockResolvedValue(connection);
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [] });
  db.findEmailByUserId.mockResolvedValue('mfixture@example.invalid');
  db.queryClient.mockRejectedValue(failure);
  const result = await graphql({ schema,
    source: 'mutation($input: userProfileInitialInput!) { createInitialPersonalRecord(input: $input) { first_name identifier } }',
    variableValues: { input }, contextValue: { user: { id: 700001 }, res: { status: jest.fn() } },
  });
  expect(result.errors[0].path).toEqual(['createInitialPersonalRecord']);
  expect(result.errors[0].message).toMatch(/Failed to create initial personal record/);
  expect(logger.error).toHaveBeenCalledWith('Error in _PersonalRecordLog:', failure);
  expect(db.queryClient).toHaveBeenCalledWith(connection, expect.stringContaining('INSERT INTO "UsersPersonalLog"'),
    expect.arrayContaining([700001, 'Synthetic']));
  expect(connection.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test.each(['000700001', '700001', '2147483647', '0'])('employee identifier %s reaches SQL and readback intact', async identifier => {
  isStudentEmail.mockReturnValue(false);
  const { identifier: unusedIdentifier, branch: unusedBranch, ...personalFields } = input;
  const personalLog = { id: 12, ...personalFields };
  const connection = {
    query: jest.fn(async sql => ({ rows: sql.includes('INSERT INTO "UsersPersonal"') ? [{ id: 700001, identifier, branch: 'QuezonCity' }] : [] })),
    release: jest.fn(),
  };
  db.connect.mockResolvedValue(connection);
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [] });
  db.findEmailByUserId.mockResolvedValue('fixture@example.invalid');
  db.queryClient.mockResolvedValue({ rows: [personalLog] });
  const result = await graphql({ schema,
    source: 'mutation($input: userProfileInitialInput!) { createInitialPersonalRecord(input: $input) { first_name identifier branch } }',
    variableValues: { input: { ...input, identifier, branch: 'QuezonCity' } },
    contextValue: { user: { id: 700001 }, res: { status: jest.fn() } },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data.createInitialPersonalRecord).toMatchObject({ identifier, branch: 'QuezonCity' });
  expect(connection.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "UsersPersonal"'), [700001, identifier, 'QuezonCity']);
  expect(connection.query.mock.calls.map(([sql]) => sql).filter(sql => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toEqual(['BEGIN', 'COMMIT']);
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test.each(['', '           ', 'EMP-1234567', '1.2', '1e3', '-1', '2147483648', '1; DROP TABLE x'])('rejects invalid identifier %p before opening a transaction', async identifier => {
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [] });
  db.findEmailByUserId.mockResolvedValue('fixture@example.invalid');
  const res = { status: jest.fn() };
  await expect(resolvers.Mutation.createInitialPersonalRecord(null, { input: { ...input, identifier } }, { user: { id: 700001 }, res }))
    .rejects.toThrow('Identifier must contain digits only and be between 0 and 2147483647');
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.connect).not.toHaveBeenCalled();
  expect(db.queryClient).not.toHaveBeenCalled();
});

test('an integer identifier column failure rolls back the personal log and records the underlying error', async () => {
  isStudentEmail.mockReturnValue(false);
  const failure = Object.assign(new Error('synthetic invalid integer input'), { code: '22P02' });
  const connection = {
    query: jest.fn(async sql => {
      if (sql.includes('INSERT INTO "UsersPersonal"')) throw failure;
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  db.connect.mockResolvedValue(connection);
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [] });
  db.findEmailByUserId.mockResolvedValue('fixture@example.invalid');
  db.queryClient.mockResolvedValue({ rows: [{ id: 12, ...input }] });
  const result = await graphql({ schema,
    source: 'mutation($input: userProfileInitialInput!) { createInitialPersonalRecord(input: $input) { identifier } }',
    variableValues: { input: { ...input, identifier: '700001' } },
    contextValue: { user: { id: 700001 }, res: { status: jest.fn() } },
  });
  expect(result.errors[0].message).toMatch(/Failed to create initial personal record/);
  expect(logger.error).toHaveBeenCalledWith('Error in _UserBranchIdentifier:', failure);
  expect(connection.query).toHaveBeenCalledWith('ROLLBACK');
  expect(connection.query).not.toHaveBeenCalledWith('COMMIT');
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test.each([
  { first_name: 'x'.repeat(51) },
  { date_of_birth: '2000-02-30' },
  { present_address: 'Unsafe\u0000input' },
])('initial personal input is rejected before writes (%#)', async invalid => {
  db.query.mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [] });
  db.findEmailByUserId.mockResolvedValue('fixture@example.invalid');
  const result = await graphql({ schema,
    source: 'mutation($input: userProfileInitialInput!) { createInitialPersonalRecord(input: $input) { identifier } }',
    variableValues: { input: { ...input, ...invalid } },
    contextValue: { user: { id: 700001 }, res: { status: jest.fn() } },
  });
  expect(result.errors[0].message).toMatch(/Invalid personal record field/);
  expect(db.connect).not.toHaveBeenCalled();
  expect(db.queryClient).not.toHaveBeenCalled();
});
