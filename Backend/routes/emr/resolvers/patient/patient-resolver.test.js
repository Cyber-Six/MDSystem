jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../../utils/logger', () => require('../../../../test-support/fixtures.cjs').loggerMock());
jest.mock('./mutation', () => ({ update: jest.fn() }));
const db = require('../../../../config/query');
const resolver = require('./patient-resolver');
test('exposes patient query/mutation handlers', () => {
  expect(resolver.Query).toBe(require('./query'));
  expect(resolver.Mutation).toBe(require('./mutation'));
});
test.each([[{ profile_type: 'Student' }, 'StudentProfile'], [{ profile_type: 'Employee' }, 'EmployeeProfile'], [{}, null]])('resolves profile type for %j', (profile, type) => {
  expect(resolver.UserProfile.__resolveType(profile)).toBe(type);
});

test.each([
  ['getMyProfile', 'Approved'],
  ['getProfile', 'Revision'],
])('%s resolves the saved Employee profile and position for a %s ticket', async (query, status) => {
  db.query.mockResolvedValueOnce({ rows: [{
    id: 8, profile_type: 'Employee', department: 'Facilities', role: 'Other',
    position: 'Consultant', employmentCategoryOther: 'Research officer', status,
  }] });

  const profile = await resolver.Query[query](null, {}, { user: { id: 7 }, res: {} });
  expect(resolver.UserProfile.__resolveType(profile)).toBe('EmployeeProfile');
  expect(profile).toMatchObject({ position: 'Consultant', employmentCategoryOther: 'Research officer', status });
});
