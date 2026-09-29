jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('./query', () => ({ lookup: jest.fn() }));
jest.mock('./mutation', () => ({ update: jest.fn() }));
const resolver = require('./medical-resolver');
test('exposes medical query/mutation handlers', () => {
  expect(resolver.Query).toBe(require('./query'));
  expect(resolver.Mutation).toBe(require('./mutation'));
});
test.each([[{ program: 'BSCS' }, 'StudentProfile'], [{ department: 'IT' }, 'EmployeeProfile'], [{}, null]])('resolves profile type for %j', (profile, type) => {
  expect(resolver.UserProfile.__resolveType(profile)).toBe(type);
});
