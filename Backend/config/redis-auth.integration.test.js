// Explicit opt-in; this always starts a private Unix-socket Redis instance and
// never connects to application/production Redis. Example:
// REDIS_TEST_SERVER=/path/to/redis-server npm run test:backend
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('./config', () => ({ redis: {} }));
jest.mock('./query', () => ({ getCredentialLockStateByUserId: jest.fn(), isActiveMedicalPersonnel: jest.fn() }));
jest.mock('../utils/security', () => ({}));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { withEnvironment } = require('../test-support/fixtures.cjs');
const store = require('./redis');
const db = require('./query');
const suite = process.env.REDIS_TEST_SERVER ? describe : describe.skip;

suite('real Redis session security', () => {
  let server, directory, client, tokens, restore;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mdsystem-auth-'));
    const socket = path.join(directory, 'redis.sock');
    server = spawn(process.env.REDIS_TEST_SERVER, ['--port', '0', '--unixsocket', socket, '--unixsocketperm', '700', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
    for (let i = 0; !fs.existsSync(socket) && i < 100; i++) await delay(20);
    if (!fs.existsSync(socket)) throw new Error('Disposable Redis failed to start');
    client = await store.initRedis({ socket: { path: socket, reconnectStrategy: false } });
    restore = withEnvironment({ JWT_SECRET: 'isolated-redis-auth-test-secret', JWT_PATIENT_ACCESS_EXPIRATION: '60', JWT_STAFF_ACCESS_EXPIRATION: '30', JWT_REFRESH_EXPIRATION: '120' });
    tokens = require('./jwt');
  });
  beforeEach(async () => {
    await client.flushDb();
    store.setSessionRevocationHandler(null);
    db.getCredentialLockStateByUserId.mockResolvedValue({ userId: 12, status: 'Active' });
    db.isActiveMedicalPersonnel.mockResolvedValue(true);
  });
  afterAll(async () => {
    if (client?.isOpen) await client.quit();
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM'); await stopped;
    }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
    restore?.();
  });
  const login = (deviceId = 'phone', role = 'patient') => tokens.handleLogin({ userId: 12, deviceId, role });

  test('concurrent logins cannot lose JWT IDs from the same device', async () => {
    const results = await Promise.all([login(), login()]);
    const ids = results.map(result => tokens.verifyToken(result.accessToken).jti);
    const entries = await store.revokeRefreshSession(12, 'phone');
    expect(new Set(entries.map(entry => entry.tokenId))).toEqual(new Set(ids));
    for (const id of ids) expect(await store.getSessionBlacklist(id)).toBe(true);
  });
  test('concurrent staff logins share the anchor actually persisted in Redis', async () => {
    const results = await Promise.all([login('phone', 'medical'), login('laptop', 'medical')]);
    const anchor = await store.getStaffAnchor(12);
    expect(results.map(result => tokens.verifyToken(result.accessToken).sid)).toEqual([anchor, anchor]);
  });
  test('logout revokes older and refreshed JWTs without extending the session TTL or growing history', async () => {
    const first = await login();
    const second = await tokens.handleRefresh({ userId: 12, deviceId: 'phone', providedToken: first.refreshToken });
    const before = await store.getRefreshSession(12, 'phone');
    const ttl = await client.pTTL('rt:12:phone');
    const observer = jest.fn(); store.setSessionRevocationHandler(observer);
    const entries = await store.revokeRefreshSession(12, 'phone', second.refreshToken);
    expect(entries).toHaveLength(2);
    expect(observer).toHaveBeenCalledWith(entries.map(entry => entry.tokenId));
    for (const token of [first.accessToken, second.accessToken]) {
      expect(await store.getSessionBlacklist(tokens.verifyToken(token).jti)).toBe(true);
    }
    await store.revokeRefreshSession(12, 'phone', first.refreshToken);
    const after = await store.getRefreshSession(12, 'phone');
    expect(after.status).toBe('revoked');
    expect(after.accessTokens).toHaveLength(before.accessTokens.length);
    expect(await client.pTTL('rt:12:phone')).toBeLessThanOrEqual(ttl);
    await expect(tokens.handleRefresh({ userId: 12, deviceId: 'phone', providedToken: second.refreshToken })).rejects.toThrow('Session revoked');
  });
  test('a stale logout cannot revoke a new login that replaced the device session', async () => {
    const previous = await login();
    const current = await login();
    expect(await store.revokeRefreshSession(12, 'phone', previous.refreshToken)).toEqual([]);
    expect((await store.getRefreshSession(12, 'phone')).refreshToken).toBe(current.refreshToken);
    expect((await store.getRefreshSession(12, 'phone')).status).toBe('active');
  });
  test('guessed refresh tokens cannot rotate a staff anchor or change suspicion counters', async () => {
    await login('phone', 'medical');
    const anchor = await store.getStaffAnchor(12);
    await expect(tokens.handleRefresh({ userId: 12, deviceId: 'phone', providedToken: 'guessed-token' })).rejects.toThrow('Invalid refresh token');
    expect(await store.getStaffAnchor(12)).toBe(anchor);
    expect((await store.getRefreshSession(12, 'phone')).suspiciousCount).toBe(0);
  });
  test('a stale suspicion update cannot invalidate a newer staff login', async () => {
    const old = await login('phone', 'medical');
    const stale = await store.getRefreshSession(12, 'phone');
    stale.status = 'cooldown';
    const current = await login('phone', 'medical');
    expect(await store.saveRotatedRefreshSession(12, 'phone', old.refreshToken, stale, 120, 'attacker-anchor')).toBe(false);
    expect(await store.getStaffAnchor(12)).toBe(tokens.verifyToken(current.accessToken).sid);
    expect((await store.getRefreshSession(12, 'phone')).refreshToken).toBe(current.refreshToken);
  });
  test('bulk deletion handles Redis scan batches and revokes JWTs before removing session keys', async () => {
    const results = await Promise.all([login('phone'), login('laptop')]);
    expect(await store.deleteAllUserSessions(12)).toBe(2);
    expect(await store.getRefreshSession(12, 'phone')).toBeNull();
    for (const result of results) expect(await store.getSessionBlacklist(tokens.verifyToken(result.accessToken).jti)).toBe(true);
  });
  test('locked accounts cannot refresh even with a current valid credential', async () => {
    const first = await login();
    db.getCredentialLockStateByUserId.mockResolvedValue({ status: 'Locked' });
    await expect(tokens.handleRefresh({ userId: 12, deviceId: 'phone', providedToken: first.refreshToken })).rejects.toThrow('Account locked');
    expect((await store.getRefreshSession(12, 'phone')).refreshToken).toBe(first.refreshToken);
  });
  test('blacklist entries expire with their JWTs and do not leave permanent membership sets', async () => {
    await client.set('rt:12:short', JSON.stringify({ status: 'active', refreshToken: 'raw', tokenId: 'short-jwt', accessTokenExp: Date.now() + 100 }), { EX: 120 });
    await store.revokeRefreshSession(12, 'short', 'raw');
    expect(await store.getSessionBlacklist('short-jwt')).toBe(true);
    await delay(150);
    expect(await store.getSessionBlacklist('short-jwt')).toBe(false);
    expect(await client.keys('blacklist:*')).toEqual([]);
  });
});
