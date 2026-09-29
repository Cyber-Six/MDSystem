jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../../../config/query', () => ({}));
jest.mock('../../../../utils/logger', () => require('../../../../test-support/fixtures.cjs').loggerMock());
jest.mock('./query', () => ({ lookup: jest.fn() }));
jest.mock('./mutation', () => ({ update: jest.fn() }));
const resolver = require('./patient-resolver');
test('exposes patient query/mutation handlers', () => {
  expect(resolver.Query).toBe(require('./query'));
  expect(resolver.Mutation).toBe(require('./mutation'));
});
test.each([[{ profile_type: 'Student' }, 'StudentProfile'], [{ profile_type: 'Employee' }, 'EmployeeProfile'], [{}, null]])('resolves profile type for %j', (profile, type) => {
  expect(resolver.UserProfile.__resolveType(profile)).toBe(type);
});
