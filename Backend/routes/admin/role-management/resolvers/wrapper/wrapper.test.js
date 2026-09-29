jest.mock('../../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../../services/authorization/permit.js', () => ({
  permissions: { is_admin: 'ADMIN' }, MODULE_PERMISSION_MAP: {}, MODULE_LABELS: {}, PERMISSION_GROUP_DEFINITIONS: {},
}));
jest.mock('../../../../../config/redis.js', () => ({}));
jest.mock('../../../../../services/email/emailservice.js', () => ({}));
jest.mock('../../../../../config/sockets', () => ({}));
jest.mock('../../../../../utils/security.js', () => ({}));
jest.mock('../../../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../../../utils/graphql-helper.js', () => ({
  throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`GraphQL ${c.status.mock.lastCall[0]}: ${c.message.mock.lastCall[0]}`); }); return c; }),
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../../../config/query.js');
const { Query } = require('./wrapper.js');

beforeEach(() => jest.clearAllMocks());

test('lists staff accounts and normalizes permission, name, branch, and status fields', async () => {
  db.query.mockResolvedValue({ rows: [
    { id: 3, email: 'staff@example.test', identity: 'Employee', credentials_status: 'Active', first_name: 'Ada', middle_name: 'Byron', last_name: 'Lovelace', branch: 'Manila', is_active: true, personnel_role: 'Nurse', label_branch_map: '{}' },
    { id: 4, email: 'staff2@example.test', identity: 'Student', credentials_status: 'Unverified', is_active: false, label_branch_map: null },
  ] });
  const response = await Query._listStaffAccounts(null, { status: 'Active', location: 'Manila' }, { user: { id: 1 }, res: {} });
  expect(response.count).toBe(2);
  expect(response.staff[0]).toMatchObject({ id: '3', name: 'Ada B. Lovelace', role: 'Nurse', branch: 'Manila', status: 'Active', permissions: { count: 1 } });
  expect(response.staff[1]).toMatchObject({ id: '4', name: 'staff2@example.test', branch: 'Both', status: 'Suspended', lastLogin: null });
  expect(db.query.mock.calls[0][1]).toEqual(['Active', 'Manila']);
});

test('accepts serialized permission maps and reports malformed stored maps', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@test', first_name: null, last_name: null, is_active: true, label_branch_map: '{"ADMIN":"Both"}' }] });
  const { staff } = await Query._listStaffAccounts(null, {}, { user: {}, res: {} });
  expect(staff[0].permissions.permissions[0]).toMatchObject({ key: 'is_admin', enabled: true, branch: 'Both' });
  db.query.mockResolvedValueOnce({ rows: [{ id: 2, email: 'b@test', is_active: true, label_branch_map: '{bad json' }] });
  await expect(Query._listStaffAccounts(null, {}, { user: {}, res: {} })).rejects.toThrow();
});
