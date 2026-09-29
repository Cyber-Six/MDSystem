const mockRoutes = { post: jest.fn(), get: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRoutes }));
jest.mock('../../../config/middleware/jwtProtect', () => ({ jwtProtect: jest.fn(() => 'patient-guard') }));
jest.mock('../../../config/query', () => ({ findEmailByUserId: jest.fn(), findUserByEmail: jest.fn(), updateUserPasswordById: jest.fn(), query: jest.fn() }));
jest.mock('../../../utils/security', () => ({ verifyPassword: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const db = require('../../../config/query'); const security = require('../../../utils/security');
require('./user-password');
const change = mockRoutes.post.mock.calls[0][2]; const activity = mockRoutes.get.mock.calls[0][2];
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); });

test('validates required and sufficiently long passwords', async () => {
  let response = res(); await change({ body: {}, user: { id: 1 } }, response);
  expect(response.status).toHaveBeenCalledWith(400);
  response = res(); await change({ body: { currentPassword: 'x', newPassword: 'short' }, user: { id: 1 } }, response);
  expect(response.status).toHaveBeenCalledWith(400);
  expect(db.findEmailByUserId).not.toHaveBeenCalled();
});

test.each([
  [{ findEmailByUserId: null }, 404],
  [{ findEmailByUserId: 'person@tip.edu.ph', findUserByEmail: null }, 404],
])('returns not found when email or user record is missing', async (config, expected) => {
  db.findEmailByUserId.mockResolvedValue(config.findEmailByUserId);
  db.findUserByEmail.mockResolvedValue(config.findUserByEmail);
  const response = res(); await change({ body: { currentPassword: 'old', newPassword: 'newpassword' }, user: { id: 7 } }, response);
  expect(response.status).toHaveBeenCalledWith(expected);
});

test('rejects an incorrect current password and updates after successful verification', async () => {
  db.findEmailByUserId.mockResolvedValue('person@tip.edu.ph'); db.findUserByEmail.mockResolvedValue({ password_hash: 'hash' });
  security.verifyPassword.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  let response = res(); await change({ body: { currentPassword: 'bad', newPassword: 'newpassword' }, user: { id: 7 } }, response);
  expect(response.status).toHaveBeenCalledWith(401);
  response = res(); await change({ body: { currentPassword: 'good', newPassword: 'newpassword' }, user: { id: 7 } }, response);
  expect(db.updateUserPasswordById).toHaveBeenCalledWith(7, 'newpassword');
  expect(response.json).toHaveBeenCalledWith({ ok: true, message: 'Password changed successfully.' });
});

test('returns an internal error when password update dependencies fail', async () => {
  db.findEmailByUserId.mockRejectedValue(new Error('db down'));
  const response = res(); await change({ body: { currentPassword: 'old', newPassword: 'newpassword' }, user: { id: 7 } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
});

test('maps login activity columns and serializes session metadata', async () => {
  db.query.mockResolvedValueOnce({ rows: ['attempted_at', 'ip_address', 'user_agent', 'type'].map(column_name => ({ column_name })) }).mockResolvedValueOnce({ rows: [{ id: 3, was_successful: 1, login_at: 'today', ip_address: '127.0.0.1', user_agent: 'agent' }] });
  const response = res(); await activity({ user: { id: 8 } }, response);
  expect(db.query.mock.calls[1][0]).toContain("AND type = 'Patient'");
  expect(response.json).toHaveBeenCalledWith({ ok: true, sessions: [{ id: '3', wasSuccessful: true, timestamp: 'today', ipAddress: '127.0.0.1', userAgent: 'agent' }] });
});

test('supports legacy timestamp columns, missing optional metadata, and absent schema fields', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ column_name: 'created_at' }] }).mockResolvedValueOnce({ rows: [{ id: 4, was_successful: false, login_at: 'yesterday' }] });
  let response = res(); await activity({ user: { id: 2 } }, response);
  expect(db.query.mock.calls[1][0]).toContain('created_at AS login_at');
  expect(response.json).toHaveBeenCalledWith({ ok: true, sessions: [{ id: '4', wasSuccessful: false, timestamp: 'yesterday', ipAddress: null, userAgent: null }] });
  db.query.mockResolvedValueOnce({ rows: [{ column_name: 'irrelevant' }] });
  response = res(); await activity({ user: { id: 2 } }, response);
  expect(response.json).toHaveBeenCalledWith({ ok: true, sessions: [] });
});

test.each(['42P01', '42703'])('treats known schema mismatch %s as empty activity', async code => {
  db.query.mockRejectedValueOnce(Object.assign(new Error('schema'), { code }));
  const response = res(); await activity({ user: { id: 1 } }, response);
  expect(response.json).toHaveBeenCalledWith({ ok: true, sessions: [] });
});

test('returns an internal error for unexpected activity query failures', async () => {
  db.query.mockRejectedValue(new Error('offline')); const response = res();
  await activity({ user: { id: 1 } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
});
