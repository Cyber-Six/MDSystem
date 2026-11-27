jest.mock('../../../../config/query.js', () => ({
  query: jest.fn(), queryClient: jest.fn(), connect: jest.fn(), findEmailByUserId: jest.fn(),
}));
jest.mock('../../../emr/wrapper/query.js', () => ({ _getUserUpdateTicket: jest.fn() }));
jest.mock('../../../../utils/validator.js', () => ({
  isStudentEmail: () => true, getStudentBranchFromEmail: () => 'Manila',
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
const schema = makeExecutableSchema({
  typeDefs: fs.readFileSync(path.join(__dirname, '../../schema.graphql'), 'utf8'), resolvers,
});
const input = {
  first_name: 'Synthetic', middle_name: '', last_name: 'Fixture', date_of_birth: '2000-01-01',
  sex: 'Male', civil_status: 'Single', nationality: 'Fixture', religion: '',
  contactNumber: '09000000000', present_address: 'Synthetic', province_address: 'Synthetic',
  identifier: '700001', branch: 'Manila',
};

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
