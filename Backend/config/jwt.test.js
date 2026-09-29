jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'access-token'), verify: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('./redis', () => ({ saveRefreshSession: jest.fn(), getRefreshSession: jest.fn(), saveStaffAnchor: jest.fn(), getStaffAnchor: jest.fn() }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const { withEnvironment } = require('../test-support/fixtures.cjs');
let restore, tokens, redis, jwt;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ JWT_SECRET: 'unit-test-secret', JWT_PATIENT_ACCESS_EXPIRATION: '60', JWT_STAFF_ACCESS_EXPIRATION: '30', JWT_REFRESH_EXPIRATION: undefined });
  tokens = require('./jwt'); redis = require('./redis'); jwt = require('jsonwebtoken');
  jest.spyOn(Date, 'now').mockReturnValue(1000000);
});
afterEach(() => { jest.restoreAllMocks(); restore(); });
const session = overrides => ({ role: 'patient', status: 'active', refreshToken: 'current', prevToken: null, sessionId: 'anchor', ...overrides });
test('requires a JWT secret at startup', () => {
  delete process.env.JWT_SECRET;
  jest.resetModules();
  expect(() => require('./jwt')).toThrow('JWT_SECRET must be set');
});
test.each([{ id: null, role: 'patient' }, { id: {}, role: 'patient' }, { id: 1, role: null }, { id: 1, role: 'other' }])('rejects invalid access identity %j', user => {
  expect(() => tokens.generateAccessToken(user)).toThrow(/Invalid user/);
  expect(jwt.sign).not.toHaveBeenCalled();
});
test.each([['PATIENT', 60], ['Medical', 30]])('signs normalized %s claims and expiration', (role, expiresIn) => {
  expect(tokens.generateAccessToken({ id: '12', role }, 'anchor')).toBe('access-token');
  const [payload, secret, options] = jwt.sign.mock.calls[0];
  expect(payload).toMatchObject({ id: '12', role: role.toLowerCase(), jti: expect.any(String) });
  if (role === 'Medical') expect(payload.sid).toBe('anchor');
  else expect(payload).not.toHaveProperty('sid');
  expect(secret).toBe('unit-test-secret');
  expect(options).toEqual({ expiresIn, audience: 'mdsystem-app', issuer: 'mdsystem-auth' });
});
test.each([['patient', null], ['medical', null], ['medical', 'existing-anchor']])('persists refresh session for %s with anchor %s', async (role, anchor) => {
  redis.getStaffAnchor.mockResolvedValue(anchor);
  const token = await tokens.generateRefreshToken({ id: 12, role });
  const [userId, deviceId, refreshToken] = token.split(':');
  expect(userId).toBe('12');
  expect(redis.saveRefreshSession).toHaveBeenCalledWith(12, deviceId, expect.objectContaining({ refreshToken, deviceId, userId: 12, role, status: 'active', prevToken: null, exp: 605800000 }), 604800);
  if (role === 'medical' && !anchor) expect(redis.saveStaffAnchor).toHaveBeenCalledWith(12, expect.any(String), 604800);
  else expect(redis.saveStaffAnchor).not.toHaveBeenCalled();
});
test('honors configured refresh expiry', async () => {
  process.env.JWT_REFRESH_EXPIRATION = '120';
  jest.resetModules();
  await require('./jwt').generateRefreshToken({ id: 12, role: 'patient' });
  expect(require('./redis').saveRefreshSession).toHaveBeenCalledWith(12, expect.any(String), expect.objectContaining({ exp: 1120000 }), 120);
});
test('verifies audience/issuer and enforces allowed roles', () => {
  jwt.verify.mockReturnValue({ id: 12, role: 'patient' });
  expect(tokens.verifyToken('signed')).toEqual({ id: 12, role: 'patient' });
  expect(jwt.verify).toHaveBeenCalledWith('signed', 'unit-test-secret', { audience: 'mdsystem-app', issuer: 'mdsystem-auth' });
  expect(tokens.requireRole('signed', ['patient'])).toEqual({ id: 12, role: 'patient' });
  expect(tokens.requireRole('signed', ['medical'])).toBeNull();
  jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
  expect(tokens.verifyToken('bad')).toBeNull();
  expect(tokens.requireRole('bad', ['patient'])).toBeNull();
});
test.each([
  [null, 'Invalid session'], [session({ status: 'revoked' }), 'Session revoked'],
  [session({ status: 'cooldown', cooldownUntil: null }), 'Session requires re-login'],
  [session({ status: 'cooldown', cooldownUntil: 999999 }), 'Session requires re-login'],
  [session({ status: 'cooldown', cooldownUntil: 1000001 }), 'Session in cooldown'],
  [session({ role: 'medical' }), 'Staff session invalidated'],
])('rejects invalid refresh state %j', async (state, message) => {
  redis.getRefreshSession.mockResolvedValue(state);
  await expect(tokens.handleRefresh({ userId: 12, deviceId: 'device', providedToken: 'current' })).rejects.toThrow(message);
});
test('rejects mismatched staff anchor', async () => {
  redis.getRefreshSession.mockResolvedValue(session({ role: 'medical' }));
  redis.getStaffAnchor.mockResolvedValue('different');
  await expect(tokens.handleRefresh({ userId: 12, deviceId: 'device', providedToken: 'current' })).rejects.toThrow('Staff session invalidated');
});
test.each(['unknown', 'previous'])('records suspicious %s refresh tokens', async providedToken => {
  const state = session({ prevToken: 'previous' });
  redis.getRefreshSession.mockResolvedValue(state);
  await expect(tokens.handleRefresh({ userId: 12, deviceId: 'device', providedToken })).rejects.toThrow(providedToken === 'previous' ? 'Expired refresh token' : 'Invalid refresh token');
  expect(state.suspiciousCount).toBe(1);
  expect(redis.saveRefreshSession).toHaveBeenCalled();
});
test.each([['patient', undefined], ['medical', 2]])('rotates valid %s tokens and reduces suspicion', async (role, suspiciousCount) => {
  const state = session({ role, suspiciousCount });
  redis.getRefreshSession.mockResolvedValue(state);
  redis.getStaffAnchor.mockResolvedValue('anchor');
  const result = await tokens.handleRefresh({ userId: 12, deviceId: 'device', providedToken: 'current' });
  expect(result).toEqual({ accessToken: 'access-token', refreshToken: expect.any(String) });
  expect(state).toMatchObject({ prevToken: 'current', refreshToken: result.refreshToken, status: 'active', cooldownUntil: null, suspiciousCount: role === 'medical' ? 1 : 0 });
});
test.each([0, 1])('escalates medical suspicion only at the second violation (%s previous)', async suspiciousCount => {
  const state = session({ role: 'medical', suspiciousCount });
  await tokens.handleSuspiciousRefresh({ userId: 12, deviceId: 'device', session: state, reason: 'replay', now: 1000000 });
  expect(state.suspiciousCount).toBe(suspiciousCount + 1);
  if (suspiciousCount) {
    expect(state).toMatchObject({ status: 'cooldown', cooldownUntil: 1030000, refreshToken: '', prevToken: null });
    expect(redis.saveStaffAnchor).toHaveBeenCalledWith(12, expect.any(String), 604800);
  } else expect(redis.saveStaffAnchor).not.toHaveBeenCalled();
});
test.each([
  ['patient', null, null], ['patient', session(), null],
  ['medical', session({ suspiciousCount: 2 }), 'existing'], ['medical', session({ suspiciousCount: 0 }), null],
])('creates login session for %s and clears suspicious sessions', async (role, previous, anchor) => {
  redis.getRefreshSession.mockResolvedValue(previous);
  redis.getStaffAnchor.mockResolvedValue(anchor);
  const result = await tokens.handleLogin({ userId: 12, deviceId: 'device', role });
  expect(result.accessToken).toBe('access-token');
  expect(redis.saveRefreshSession).toHaveBeenLastCalledWith(12, 'device', expect.objectContaining({ refreshToken: result.refreshToken, role, status: 'active', suspiciousCount: 0 }), 604800);
  if (previous?.status === 'revoked') expect(redis.saveRefreshSession).toHaveBeenCalledTimes(2);
  if (role === 'medical') expect(redis.saveStaffAnchor).toHaveBeenCalledWith(12, anchor || expect.any(String), 604800);
});
