const mockQuery = jest.fn();
const mockGetStaffBranch = jest.fn();
const mockIsMedicalPermitted = jest.fn();
const mockGetStaffModulePermissions = jest.fn();
const mockGetStaffPermissions = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn() };

jest.mock('../../config/query', () => ({ query: (...args) => mockQuery(...args) }));
jest.mock('../../config/middleware/jwtProtect', () => ({ jwtProtect: () => (req, _res, next) => { req.user = { id: 12 }; next(); } }));
jest.mock('../../utils/logger', () => mockLogger);
jest.mock('../../services/permit', () => ({
  permissions: { profile_allow_view: 'PROFILE_VIEW', is_admin: 'IS_ADMIN' },
  getStaffBranch: (...args) => mockGetStaffBranch(...args),
  isMedicalPermitted: (...args) => mockIsMedicalPermitted(...args),
  getStaffModulePermissions: (...args) => mockGetStaffModulePermissions(...args),
  getStaffPermissions: (...args) => mockGetStaffPermissions(...args),
}));
jest.mock('./notifications', () => require('express').Router());

const router = require('./profile');

function handler(path) {
  const route = router.stack.find(layer => layer.route?.path === path).route;
  return route.stack.at(-1).handle;
}
function res() {
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}
const req = (query = {}, params = {}) => ({ user: { id: 12 }, query, params });

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
  mockIsMedicalPermitted.mockResolvedValue({ permitted: true, branch: 'Both' });
  mockGetStaffBranch.mockResolvedValue('Both');
  mockGetStaffModulePermissions.mockResolvedValue({ modules: [] });
  mockGetStaffPermissions.mockResolvedValue({ permissions: [] });
});

test('own profile handles absent record, maps nullable fields and reports query errors', async () => {
  const run = handler('/me/profile'); const response = res();
  await run(req(), response);
  expect(response.status).toHaveBeenLastCalledWith(500);
  mockQuery.mockResolvedValueOnce({ rows: [{ email: null, first_name: 'Ana', middle_name: 'Bea', last_name: 'Cruz', personnel_role: 'Nurse', branch: 'Manila', is_active: false }] });
  await run(req(), response);
  expect(response.json).toHaveBeenLastCalledWith({ email: null, name: 'Ana B. Cruz', firstName: 'Ana', lastName: 'Cruz', role: 'Nurse', branch: 'Manila', isActive: false });
  mockQuery.mockResolvedValueOnce({ rows: [{ email: 'nobody@example.test', first_name: null, middle_name: '', last_name: null, personnel_role: null, branch: null, is_active: null }] });
  await run(req(), response);
  expect(response.json).toHaveBeenLastCalledWith({ email: 'nobody@example.test', name: null, firstName: null, lastName: null, role: null, branch: null, isActive: true });
  mockQuery.mockRejectedValueOnce(new Error('db down'));
  await run(req(), response);
  expect(response.status).toHaveBeenLastCalledWith(500);
});

test('permissions endpoint builds granular booleans and handles missing permission list and failures', async () => {
  const run = handler('/me/permissions'); const response = res();
  mockGetStaffModulePermissions.mockResolvedValueOnce({ modules: ['m'] });
  mockGetStaffPermissions.mockResolvedValueOnce({ permissions: [{ key: 'profile_allow_view', enabled: 1 }, { key: null }, { key: 'emr_allow_view', enabled: false }] });
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true }); mockGetStaffBranch.mockResolvedValueOnce('Manila');
  await run(req(), response);
  expect(response.json).toHaveBeenLastCalledWith(expect.objectContaining({ modules: ['m'], isAdmin: true, branch: 'Manila', searchPatientPermissions: expect.objectContaining({ profile_allow_view: true, emr_allow_view: false }) }));
  mockGetStaffPermissions.mockResolvedValueOnce({}); mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false }); mockGetStaffBranch.mockResolvedValueOnce(null);
  await run(req(), response);
  expect(response.json).toHaveBeenLastCalledWith(expect.objectContaining({ branch: 'Both', isAdmin: false }));
  mockGetStaffModulePermissions.mockRejectedValueOnce(new Error('permission service unavailable'));
  await run(req(), response);
  expect(response.status).toHaveBeenLastCalledWith(500);
});

test('patient search validates branch, permission and branch scopes before database access', async () => {
  const run = handler('/id/search'); const response = res();
  await run(req({ query: 'x', branch: 'Unknown' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await run(req({ query: 'x', branch: 'Manila' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  mockGetStaffBranch.mockResolvedValueOnce('Manila');
  await run(req({ query: 'x', branch: 'QuezonCity' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'QuezonCity' }); mockGetStaffBranch.mockResolvedValueOnce('Both');
  await run(req({ query: 'x', branch: 'Manila' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  expect(mockQuery).not.toHaveBeenCalled();
  mockGetStaffBranch.mockResolvedValueOnce('BadDesignation');
  await run(req({ query: ['x', 'y'], branch: 'Manila' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'Manila' });
  mockGetStaffBranch.mockResolvedValueOnce('Manila');
  await run(req({ query: 'x', branch: 'Manila' }), response); expect(response.json).toHaveBeenCalled();
  mockGetStaffBranch.mockResolvedValueOnce('   ');
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true });
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await run(req({ query: 'x', branch: 'Manila' }), response); expect(mockQuery).toHaveBeenCalled();
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 55 });
  mockGetStaffBranch.mockResolvedValueOnce('Both');
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await run(req({ query: 'x', branch: 'Manila' }), response); expect(mockQuery).toHaveBeenCalled();
});

test('unified search validates query and maps result fields with default nulls', async () => {
  const run = handler('/id/search'); const response = res();
  await run(req({ query: '  ', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  await run(req({ query: 'x'.repeat(121), branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  mockQuery.mockResolvedValueOnce({ rows: [{ userId: 3, first_name: 'Jo' }] });
  await run(req({ query: ' x ', branch: 'Both' }), response);
  expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining('LEFT JOIN LATERAL'), ['%x%', 'Both']);
  expect(response.json).toHaveBeenLastCalledWith({ users: [expect.objectContaining({ id: 3, firstName: 'Jo', profile_type: null, program: null, role: null })] });
  mockQuery.mockRejectedValueOnce(new Error('query failed'));
  await run(req({ query: 'x', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(500);
});

test('identifier search validates input, queries and maps rows, and catches failures', async () => {
  const run = handler('/id/identifier/:identifier/:branch'); const response = res();
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await run(req({}, { identifier: 'I', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  await run(req({}, { identifier: ' ', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  await run(req({}, { identifier: 'x'.repeat(121), branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  mockQuery.mockResolvedValueOnce({ rows: [{ userId: 4, first_name: 'A', identifier: 'I' }] });
  await run(req({}, { identifier: ' I ', branch: 'Both' }), response);
  expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining('identifier::text ILIKE'), ['I', 'Both']);
  expect(response.json).toHaveBeenLastCalledWith({ users: [{ id: 4, firstName: 'A', middleName: undefined, lastName: undefined, identifier: 'I' }] });
  mockQuery.mockRejectedValueOnce(new Error('query failed'));
  await run(req({}, { identifier: 'I', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(500);
});

test('name search validates, tokenizes every name part, and maps matches', async () => {
  const run = handler('/id/name/:name/:branch'); const response = res();
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await run(req({}, { name: 'Ana', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  await run(req({}, { name: '', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  await run(req({}, { name: 'x'.repeat(121), branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  mockQuery.mockResolvedValueOnce({ rows: [{ userId: 5, first_name: 'Ana', last_name: 'Cruz', identifier: 'I' }] });
  await run(req({}, { name: ' Ana   Cruz ', branch: 'Both' }), response);
  expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY score DESC'), ['%Ana%', '%Cruz%', 'Both']);
  expect(response.json).toHaveBeenLastCalledWith({ users: [{ id: 5, firstName: 'Ana', middleName: undefined, lastName: 'Cruz', identifier: 'I' }] });
  mockQuery.mockRejectedValueOnce(new Error('query failed'));
  await run(req({}, { name: 'Ana', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(500);
});

test('email search validates, maps results and catches query errors', async () => {
  const run = handler('/id/email'); const response = res();
  mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await run(req({ email: 'a@b.test', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(403);
  await run(req({ email: ' ', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  await run(req({ email: 'x'.repeat(121), branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(400);
  mockQuery.mockResolvedValueOnce({ rows: [{ userId: 6, email: 'a@b.test', first_name: 'A' }] });
  await run(req({ email: ' a@b.test ', branch: 'Both' }), response);
  expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining('LOWER(uc.email)'), ['a@b.test', 'Both']);
  expect(response.json).toHaveBeenLastCalledWith({ users: [{ id: 6, email: 'a@b.test', firstName: 'A', middleName: undefined, lastName: undefined, identifier: undefined }] });
  mockQuery.mockRejectedValueOnce(new Error('query failed'));
  await run(req({ email: 'a@b.test', branch: 'Both' }), response); expect(response.status).toHaveBeenLastCalledWith(500);
});
