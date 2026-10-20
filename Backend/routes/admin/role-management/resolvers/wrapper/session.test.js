jest.mock('../../../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../../../services/authorization/permit', () => ({
  permissions: {}, MODULE_PERMISSION_MAP: {}, MODULE_LABELS: {}, PERMISSION_GROUP_DEFINITIONS: {},
}));
jest.mock('../../../../../config/redis', () => ({
  listUserSessionsWithMeta: jest.fn(), scanAllRefreshSessionsWithMeta: jest.fn(), revokeRefreshSession: jest.fn(),
}));
jest.mock('../../../../../services/email/emailservice', () => ({}));
jest.mock('../../../../../config/sockets', () => ({}));
jest.mock('../../../../../utils/security', () => ({}));
jest.mock('../../../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const fs = require('node:fs');
const path = require('node:path');
const { buildSchema, graphql } = require('graphql');
const redis = require('../../../../../config/redis');
const db = require('../../../../../config/query');
const { Query, Mutation } = require('./wrapper');
const schema = buildSchema(fs.readFileSync(path.resolve(__dirname, '../../schema.graphql'), 'utf8'));
const context = { user: { id: 1 }, res: { status: jest.fn().mockReturnThis() } };
const record = (deviceId = 'phone', overrides = {}) => ({
  key: `rt:12:${deviceId}`, ttlSeconds: 120,
  session: { userId: 12, deviceId, refreshToken: 'private-refresh-token', role: 'patient', status: 'active', ...overrides },
});

beforeEach(() => {
  jest.clearAllMocks();
  redis.listUserSessionsWithMeta.mockResolvedValue([record()]);
  redis.revokeRefreshSession.mockResolvedValue([{ tokenId: 'jwt-id', blacklisted: true }]);
});

test.each(['_setUserSessionRevoked', '_setAllUserSessionsRevoked'])('%s rejects unrevocation before touching sessions', async name => {
  const result = await Mutation[name](null, { userId: '12', deviceId: 'phone', revoked: false }, context);
  expect(result).toEqual({ ok: false, message: 'Unrevoking sessions is not allowed.', results: [] });
  expect(redis.listUserSessionsWithMeta).not.toHaveBeenCalled();
  expect(redis.revokeRefreshSession).not.toHaveBeenCalled();
});

test('single-device revocation delegates atomically and returns the new GraphQL result', async () => {
  const result = await Mutation._setUserSessionRevoked(null, { userId: '12', deviceId: 'phone', revoked: true }, context);
  expect(redis.revokeRefreshSession).toHaveBeenCalledWith('12', 'phone');
  const response = await graphql({ schema, source: 'mutation { setUserSessionRevoked(userId:"12", deviceId:"phone", revoked:true) { ok message results { tokenId blacklisted } } }', rootValue: { setUserSessionRevoked: () => result } });
  expect(response.errors).toBeUndefined();
  expect(response.data.setUserSessionRevoked.results).toEqual([{ tokenId: 'jwt-id', blacklisted: true }]);
});

test('bulk revocation includes already-revoked sessions and ignores expired or foreign sessions', async () => {
  redis.listUserSessionsWithMeta.mockResolvedValue([
    record(), record('laptop', { status: 'revoked' }),
    { ...record('expired'), ttlSeconds: 0 }, record('foreign', { userId: 99 }),
  ]);
  const result = await Mutation._setAllUserSessionsRevoked(null, { userId: '12', revoked: true }, context);
  expect(result.ok).toBe(true);
  expect(redis.revokeRefreshSession.mock.calls).toEqual([['12', 'phone'], ['12', 'laptop']]);
});

test('missing, expired and already-revoked sessions are safe to revoke repeatedly', async () => {
  redis.listUserSessionsWithMeta.mockResolvedValueOnce([]).mockResolvedValueOnce([record('phone', { status: 'revoked' })]);
  const missing = await Mutation._setUserSessionRevoked(null, { userId: '12', deviceId: 'phone', revoked: true }, context);
  expect(missing).toMatchObject({ ok: true, results: [] });
  const repeated = await Mutation._setUserSessionRevoked(null, { userId: '12', deviceId: 'phone', revoked: true }, context);
  expect(repeated.message).toBe('Session already revoked.');
});

test('session lists remove refresh secrets and supply non-null expiry flags for legacy and new sessions', async () => {
  redis.listUserSessionsWithMeta.mockResolvedValue([record(), record('expired-jwt', { accessTokenExp: Date.now() - 1 })]);
  const sessions = await Query._listUserSessions(null, { userId: '12' }, context);
  expect(sessions.map(session => session.accessTokenExpired)).toEqual([false, true]);
  expect(sessions.every(session => !('refreshToken' in session))).toBe(true);
  const response = await graphql({ schema, source: '{ listUserSessions(userId:"12") { deviceId accessTokenExpired } }', rootValue: { listUserSessions: () => sessions } });
  expect(response.errors).toBeUndefined();
  expect(schema.getType('LinkedUserSession').getFields()).not.toHaveProperty('refreshToken');
  expect(schema.getType('UserSession').getFields()).not.toHaveProperty('refreshToken');

  redis.scanAllRefreshSessionsWithMeta.mockResolvedValue([record()]);
  db.query.mockResolvedValue({ rows: [{ userId: '12', email: 'patient@example.test' }] });
  const all = await Query._listAllSessions(null, { offset: 0, limit: 10 }, context);
  expect(all.sessions[0]).toMatchObject({ accessTokenExpired: false });
  expect(all.sessions[0]).not.toHaveProperty('refreshToken');
});
