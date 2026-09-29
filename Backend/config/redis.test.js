jest.mock('redis', () => ({ createClient: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../utils/security', () => ({ hashOTP: jest.fn(value => `hash:${value}`), generateRandomKey: jest.fn(() => 'verification-token'), delayRandom: jest.fn() }));
jest.mock('./query', () => ({ getUserConsentStateByEmail: jest.fn(), updateUserConsent: jest.fn() }));
jest.mock('./config', () => ({ redis: { host: 'redis.test', port: 6379, username: 'test', password: 'fixture', database: 0 } }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const { withEnvironment } = require('../test-support/fixtures.cjs');
let store, client, pipeline, restore;
const settings = ['EMAIL_2FA_EXPIRATION', 'EMAIL_VERIF_EXPIRATION', 'OTP_GLOBAL_ATTEMPT_LIMIT', 'OTP_GLOBAL_LOCKOUT_SECONDS', 'JWT_REFRESH_EXPIRATION', 'ADMIN_TRANSFER_COOLDOWN', 'ADMIN_TRANSFER_PASSWORD_FAIL_TTL', 'ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD', 'ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT', 'PATIENT_LOGIN_FAIL_TTL', 'PATIENT_LOGIN_FAIL_LOCKDOWN_SECONDS', 'PATIENT_FAILED_LOGIN_THRESHOLD', 'STAFF_LOGIN_FAIL_TTL', 'STAFF_LOGIN_FAIL_LOCKDOWN_SECONDS', 'STAFF_FAILED_LOGIN_THRESHOLD', 'RECAPTCHA_FAIL_ATTEMPT_THRESHOLD', 'VERIFICATION_SESSION_EXPIRATION', 'RESET_PW_FAIL_TTL', 'RESET_PW_LOCK_THRESHOLD', 'RESET_PW_LOCK_TTL', 'RT_FAIL_TTL', 'RT_LOCK_THRESHOLD', 'RT_LOCK_TTL'];
function scan(items) {
  client.scanIterator.mockImplementation(async function* () { yield* items; });
}
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ ...Object.fromEntries(settings.map(key => [key, undefined])), DEBUG_BYPASS_OTP: undefined, MEDIA_MAX_FILES_STAGING: '3', MEDIA_MAX_FILES_STAGING_EXP: '60', DATA_CONSENT_VERSION: 'v2' });
  client = Object.fromEntries(['connect', 'on', 'set', 'get', 'del', 'sAdd', 'sMembers', 'sRem', 'sCard', 'rPush', 'lRange', 'lTrim', 'lLen', 'incr', 'expire', 'ttl', 'exists', 'hSet', 'hGet', 'hGetAll', 'decr', 'keys', 'scanIterator', 'mGet'].map(name => [name, jest.fn()]));
  pipeline = { exec: jest.fn() };
  for (const name of ['sAdd', 'expire', 'lRange', 'del', 'ttl']) pipeline[name] = jest.fn(() => pipeline);
  client.multi = jest.fn(() => pipeline);
  require('redis').createClient.mockReturnValue(client);
  store = require('./redis');
  scan([]);
});
afterEach(() => { jest.useRealTimers(); restore(); });
test('initializes one configured client and handles connect/error events', async () => {
  expect(() => store.getClient()).toThrow('not initialized');
  await expect(store.initRedis({ database: 2 })).resolves.toBe(client);
  expect(require('redis').createClient).toHaveBeenCalledWith({ socket: { host: 'redis.test', port: 6379 }, username: 'test', password: 'fixture', database: 2 });
  expect(store.getClient()).toBe(client);
  await store.initRedis();
  expect(client.connect).toHaveBeenCalledTimes(1);
  for (const [event, callback] of client.on.mock.calls) callback(event === 'error' ? new Error('connection failed') : undefined);
});
test.each(['setKey', 'getKey', 'delKey', 'sAddKey', 'sMembersKey', 'sRemKey', 'sCardKey', 'rPushKey', 'lRangeKey', 'lTrimKey', 'lLenKey', 'lRangeDelKey', 'rateLimitIP', 'rateLimitIPCount', 'getIPRateLimitTTL', 'rateLimitEmailCooldown', 'rateLimitEmailCooldownTTL', 'deleteEmailCooldown', 'rateLimitEmailAttempts', 'deleteEmailAttempts', 'setOTP', 'verifyOTP', 'deleteOTP', 'createVerificationSession', 'getVerificationSession', 'updateConsentInSession', 'update2FAInSession', 'updateTotp2FAInSession', 'deleteVerificationSession', 'getUserIdFromVerificationSession', 'listUserSessions', 'listUserSessionsWithMeta', 'deleteAllUserSessions', 'deleteStaffAnchor', 'scanAllRefreshSessionsWithMeta', 'incrementMediaStagingCount', 'decrementMediaStagingCount', 'createAdminTransferSession', 'getAdminTransferSession', 'deleteAdminTransferSession', 'recordAdminTransferAttempt', 'getAdminActivePendingTransfer', 'recordAdminTransferPasswordFailure', 'isAdminTransferPasswordLocked', 'clearAdminTransferPasswordFailures', 'incrementLoginFailure', 'isLoginLocked', 'getLoginFailureCount', 'resetLoginFailures', 'recordTotpFailureForKey', 'isTotpLockedForKey'])('%s rejects use before initialization', async method => {
  await expect(store[method]('test', 'test', 'test')).rejects.toThrow('Redis client not initialized');
});
test('serializes expiring keys and delegates set/list operations', async () => {
  await store.initRedis();
  await store.setKey('key', 12); await store.setKey('key', 12, 60);
  expect(client.set.mock.calls).toEqual([['key', '12'], ['key', '12', { EX: 60 }]]);
  const cases = [['getKey', 'get', ['key'], 'value'], ['delKey', 'del', ['key'], undefined], ['sMembersKey', 'sMembers', ['key'], ['member']], ['sRemKey', 'sRem', ['key', 'member'], undefined], ['sCardKey', 'sCard', ['key'], 2], ['rPushKey', 'rPush', ['key', 'value'], 2], ['lRangeKey', 'lRange', ['key', 0, -1], ['value']], ['lTrimKey', 'lTrim', ['key', 0, -1], undefined], ['lLenKey', 'lLen', ['key'], 2]];
  for (const [method, command, args, result] of cases) {
    client[command].mockResolvedValue(result);
    await expect(store[method](...args)).resolves.toEqual(result);
    expect(client[command]).toHaveBeenCalledWith(...args);
  }
  await store.sAddKey('key', 'member');
  expect(client.sAdd).toHaveBeenCalledWith('key', 'member');
  await store.sAddKey('key', 'member', 60);
  expect(pipeline.sAdd).toHaveBeenCalledWith('key', 'member');
  expect(pipeline.expire).toHaveBeenCalledWith('key', 60);
  pipeline.exec.mockResolvedValueOnce([['value'], 1]).mockResolvedValueOnce([null, 0]);
  await expect(store.lRangeDelKey('key')).resolves.toEqual(['value']);
  await expect(store.lRangeDelKey('key')).resolves.toEqual([]);
  expect(pipeline.lRange).toHaveBeenCalledWith('key', 0, -1);
  expect(pipeline.del).toHaveBeenCalledWith('key');
});
test('enforces IP/email rate limits, cooldowns and remaining TTL', async () => {
  await store.initRedis();
  client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(11).mockResolvedValueOnce(1).mockResolvedValueOnce(6);
  await expect(store.rateLimitIP('ip')).resolves.toBe(false);
  await expect(store.rateLimitIP('ip', 'login', 10, 60)).resolves.toBe(true);
  await expect(store.rateLimitEmailAttempts('email')).resolves.toBe(false);
  await expect(store.rateLimitEmailAttempts('email', 'patient', 'login', 5, 300)).resolves.toBe(true);
  expect(client.expire).toHaveBeenCalledWith('rl::ip:ip', 60);
  expect(client.expire).toHaveBeenCalledWith('rl:::ea:email', 300);
  client.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await expect(store.rateLimitEmailCooldown('email')).resolves.toBe(true);
  await expect(store.rateLimitEmailCooldown('email', 'patient', 'login', 20)).resolves.toBe(false);
  expect(client.set).toHaveBeenCalledWith('rl:patient:login:ec:email', '1', { EX: 20 });
  for (const method of ['getIPRateLimitTTL', 'rateLimitEmailCooldownTTL', 'getOTPLockoutTTL']) {
    client.ttl.mockResolvedValueOnce(10).mockResolvedValueOnce(-1);
    await expect(store[method]('key')).resolves.toBe(10);
    await expect(store[method]('key', 'route')).resolves.toBe(0);
  }
  for (const method of ['deleteEmailCooldown', 'deleteEmailAttempts']) {
    client.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(store[method]('email')).resolves.toBe(true);
    await expect(store[method]('email', 'patient', 'login')).resolves.toBe(false);
  }
  client.get.mockResolvedValueOnce('4').mockResolvedValueOnce(null);
  await expect(store.rateLimitIPCount('ip')).resolves.toBe(4);
  await expect(store.rateLimitIPCount('ip', 'login')).resolves.toBe(0);
});
test('stores hashed OTPs by portal/purpose and rejects unknown purposes', async () => {
  await store.initRedis();
  for (const [purpose, ttl] of [['email2FA', 300], ['emailVerification', 600], ['settingsAction', 300]]) {
    await store.setOTP('email', '123', purpose, 'patient');
    expect(client.set).toHaveBeenLastCalledWith(`otp:patient:${purpose}:email`, 'hash:123', { EX: ttl });
    await store.deleteOTP('email', purpose, 'patient');
    expect(client.del).toHaveBeenLastCalledWith(`otp:patient:${purpose}:email`);
  }
  for (const method of ['setOTP', 'verifyOTP', 'deleteOTP']) {
    const args = method === 'setOTP' ? ['email', '123', 'unknown', 'patient'] : ['email', 'unknown', '123', 'patient'];
    await expect(store[method](...args)).rejects.toThrow('Unknown OTP code type');
  }
});
test('accepts matching OTPs once and rejects locked accounts', async () => {
  await store.initRedis();
  client.exists.mockResolvedValueOnce(1).mockResolvedValue(0);
  await expect(store.verifyOTP('email', 'email2FA', '123', 'patient')).resolves.toBe('LOCKED_OUT');
  client.get.mockResolvedValue('hash:123');
  await expect(store.verifyOTP('email', 'email2FA', '123', 'patient')).resolves.toBe(true);
  expect(client.del.mock.calls).toEqual([['otp:patient:email2FA:email'], ['otp:fail:email2FA:email']]);
});
test.each([false, true])('increments failures and locks missing/wrong OTPs (stored=%s)', async stored => {
  jest.useFakeTimers(); await store.initRedis();
  client.exists.mockResolvedValue(0); client.get.mockResolvedValue(stored ? 'wrong' : null);
  for (const count of [1, 4, 6]) {
    client.incr.mockResolvedValue(count);
    const pending = store.verifyOTP('email', 'email2FA', '123', 'patient');
    await jest.runAllTimersAsync();
    await expect(pending).resolves.toBe(count > 5 ? 'LOCKED_OUT' : false);
  }
  expect(client.expire).toHaveBeenCalledWith('otp:fail:email2FA:email', 3600);
  expect(client.set).toHaveBeenCalledWith('otp:lock:email2FA:email', '1', { EX: 3600 });
  client.get.mockResolvedValueOnce('2').mockResolvedValueOnce(null);
  await expect(store.getOTPFailureCount('email', 'email2FA')).resolves.toBe(2);
  await expect(store.getOTPFailureCount('email', 'email2FA')).resolves.toBe(0);
});
test('supports explicit debug OTP bypass and configured expirations', async () => {
  for (const key of settings) process.env[key] = '120';
  process.env.DEBUG_BYPASS_OTP = 'true';
  jest.resetModules(); require('redis').createClient.mockReturnValue(client); store = require('./redis');
  await store.initRedis();
  await expect(store.verifyOTP('email', 'email2FA', '123', 'patient')).resolves.toBe(true);
  await store.setOTP('email', '123', 'email2FA', 'patient');
  expect(client.set).toHaveBeenLastCalledWith('otp:patient:email2FA:email', 'hash:123', { EX: 120 });
});
test.each([null, { id: 12 }, { id: 12, allow_email_2fa: true, totp_enabled: true, data_consent: true, data_consent_version: 'v1', data_consent_agreed: '2026-01-01' }])('creates verification sessions for account state %j', async user => {
  await store.initRedis(); require('./query').getUserConsentStateByEmail.mockResolvedValue(user);
  await expect(store.createVerificationSession('email', 'login')).resolves.toBe('verification-token');
  expect(client.hSet).toHaveBeenCalledWith('verify:login:verification-token', expect.objectContaining({ user_exists: user ? 'true' : 'false', user_id: user ? '12' : '', account_type: 'patient', email: 'email' }));
  expect(client.expire).toHaveBeenCalledWith('verify:login:verification-token', 900);
});
test('loads and deletes verification sessions', async () => {
  await store.initRedis();
  client.hGetAll.mockResolvedValueOnce(null).mockResolvedValueOnce({}).mockResolvedValueOnce({ email: 'email' });
  await expect(store.getVerificationSession('token', 'login')).resolves.toBeNull();
  await expect(store.getVerificationSession('token', 'login')).resolves.toBeNull();
  await expect(store.getVerificationSession('token', 'login')).resolves.toEqual({ email: 'email' });
  await expect(store.deleteVerificationSession('token', 'login')).resolves.toBe(true);
  expect(client.del).toHaveBeenCalledWith('verify:login:token');
});
test('updates consent for existing sessions and synchronizes existing users', async () => {
  await store.initRedis();
  client.exists.mockResolvedValueOnce(0).mockResolvedValue(1);
  await expect(store.updateConsentInSession('token', 'login')).resolves.toBe(false);
  client.hGet.mockResolvedValueOnce('').mockResolvedValueOnce('12');
  await expect(store.updateConsentInSession('token', 'login')).resolves.toBe(true);
  expect(require('./query').updateUserConsent).not.toHaveBeenCalled();
  await store.updateConsentInSession('token', 'login');
  expect(require('./query').updateUserConsent).toHaveBeenCalledWith('12', { data_consent: true, data_consent_version: 'v2', data_consent_agreed: expect.any(String) });
  client.exists.mockResolvedValue(0);
  await expect(store.getUserIdFromVerificationSession('token', 'login')).resolves.toBeNull();
});
test.each([['update2FAInSession', 'email_2fa_verified'], ['updateTotp2FAInSession', 'totp_2fa_verified']])('%s verifies matching emails case-insensitively', async (method, field) => {
  await store.initRedis();
  client.exists.mockResolvedValueOnce(0).mockResolvedValue(1);
  await expect(store[method]('token', 'EMAIL', 'login')).resolves.toBe(false);
  client.hGet.mockResolvedValueOnce(null).mockResolvedValueOnce('other').mockResolvedValueOnce('email');
  await expect(store[method]('token', 'EMAIL', 'login')).resolves.toBe(false);
  await expect(store[method]('token', 'EMAIL', 'login')).resolves.toBe(false);
  await expect(store[method]('token', 'EMAIL', 'login')).resolves.toBe(true);
  expect(client.hSet).toHaveBeenCalledWith('verify:login:token', { [field]: 'true' });
});
test('validates refresh session and staff anchor identifiers', async () => {
  await store.initRedis();
  for (const method of ['saveRefreshSession', 'getRefreshSession', 'saveStaffAnchor']) {
    await expect(store[method](null, 'id')).rejects.toThrow('required');
    await expect(store[method](12, null)).rejects.toThrow('required');
  }
  for (const method of ['getStaffAnchor', 'listUserSessions', 'listUserSessionsWithMeta', 'deleteAllUserSessions', 'deleteStaffAnchor']) await expect(store[method](null)).rejects.toThrow('required');
  await expect(store.saveRefreshSession(12, 'device', { token: 'value' }, 60)).resolves.toBe('rt:12:device');
  expect(client.set).toHaveBeenCalledWith('rt:12:device', '{"token":"value"}', { EX: 60 });
  await expect(store.saveStaffAnchor(12, 'anchor')).resolves.toBe('staff:anchor:12');
  expect(client.set).toHaveBeenCalledWith('staff:anchor:12', 'anchor', { EX: 604800 });
  client.get.mockResolvedValueOnce('anchor').mockResolvedValueOnce(null).mockResolvedValueOnce('{"token":"value"}');
  await expect(store.getStaffAnchor(12)).resolves.toBe('anchor');
  await expect(store.getRefreshSession(12, 'device')).resolves.toBeNull();
  await expect(store.getRefreshSession(12, 'device')).resolves.toEqual({ token: 'value' });
  await store.deleteStaffAnchor(12);
  expect(client.del).toHaveBeenCalledWith('staff:anchor:12');
});
test('lists valid user sessions and bulk-deletes their keys', async () => {
  await store.initRedis();
  scan(['rt:12:a', 'rt:12:b', 'rt:12:c']);
  client.get.mockResolvedValueOnce('{"deviceId":"a"}').mockResolvedValueOnce('invalid').mockResolvedValueOnce(null);
  await expect(store.listUserSessions(12)).resolves.toEqual([{ deviceId: 'a' }]);
  await expect(store.deleteAllUserSessions(12)).resolves.toBe(3);
  expect(client.del).toHaveBeenCalledWith(['rt:12:a', 'rt:12:b', 'rt:12:c']);
  scan([]);
  await expect(store.deleteAllUserSessions(12)).resolves.toBe(0);
});
test.each(['listUserSessionsWithMeta', 'scanAllRefreshSessionsWithMeta'])('%s normalizes scan batches, TTL replies, and malformed sessions', async method => {
  await store.initRedis();
  await expect(store[method](12)).resolves.toEqual([]);
  const key = index => `rt:12:d${index}`;
  const payload = index => JSON.stringify({ userId: 12, deviceId: `d${index}`, refreshToken: 'token' });
  scan([null, undefined, [' ', Buffer.from(''), Buffer.from(key(0)), [key(1)]], { toString: () => '' }, key(2), key(3), key(4), key(5), key(6), key(7), key(8), key(9), key(10), key(11), key(12), key(13), key(14)]);
  client.mGet.mockResolvedValue([payload(0), payload(1), payload(2), null, payload(4), payload(5), '{invalid', 'null', '12', payload(9), payload(10), payload(11), payload(12), payload(13), payload(14)]);
  pipeline.exec.mockResolvedValue([[null, 10], [20], 30, 40, 0, 'NaN', 60, 70, 80, [], [1, 2, 3], -1, 10, 10, 10]);
  const result = await store[method](12);
  expect(result.map(entry => entry.key)).toEqual([key(0), key(1), key(2), key(12), key(13), key(14)]);
  expect(result[0].ttlSeconds).toBe(10);
  scan([key(0)]); client.mGet.mockResolvedValue(null);
  await expect(store[method](12)).resolves.toEqual([]);
  client.mGet.mockResolvedValue([payload(0)]); pipeline.exec.mockResolvedValue(null);
  await expect(store[method](12)).resolves.toEqual([]);
});
test('filters invalid global sessions, limiter keys, and inconsistent identity metadata', async () => {
  await store.initRedis();
  scan(['rt:fail:12', 'rt:lock:12', 'other', 123, 'rt:bad', 'rt::device', 'rt:12:', ...Array.from({ length: 9 }, (_, i) => `rt:12:d${i}`)]);
  client.mGet.mockResolvedValue(['{}', '{}', '{}', '{}', '{"userId":null}', '{"userId":13}', '{"userId":12}', '{"userId":12,"deviceId":null}', '{"userId":12,"deviceId":"wrong"}', '{"userId":12,"deviceId":"d6","refreshToken":12}', '{"userId":12,"deviceId":"d7","refreshToken":" "}', '{"userId":12,"deviceId":"d8","refreshToken":"token"}']);
  pipeline.exec.mockResolvedValue(Array(12).fill(10));
  const result = await store.scanAllRefreshSessions();
  expect(result).toEqual([{ userId: 12, deviceId: 'd8', refreshToken: 'token' }]);
});
test('skips malformed refresh-session keys and failure/lock keys while parsing scan metadata', async () => {
  await store.initRedis();
  scan(['other', 'rt:fail:12', 'rt:lock:12', 'rt:bad', 'rt::device', 'rt:12:']);
  client.mGet.mockResolvedValue(Array(6).fill('{}'));
  pipeline.exec.mockResolvedValue(Array(6).fill(60));
  await expect(store.scanAllRefreshSessionsWithMeta()).resolves.toEqual([]);
});
test('flushes complete scan batches and maps remaining sessions', async () => {
  await store.initRedis();
  const keys = Array.from({ length: 100 }, (_, index) => `rt:12:d${index}`);
  scan([keys]);
  client.mGet.mockImplementation(async batch => batch.map(key => JSON.stringify({ userId: 12, deviceId: key.split(':')[2], refreshToken: 'token' })));
  pipeline.exec.mockResolvedValue(Array(100).fill(60));
  expect(await store.scanAllRefreshSessions()).toHaveLength(100);
  expect(client.mGet).toHaveBeenCalledTimes(1);
});
test.each([
  ['resetpw', 'recordResetPwFailure', 'getResetPwFailures', 'isResetPwLocked', 'clearResetPwFailures', 'RESET_PW'],
  ['rt', 'recordRefreshTokenFailure', 'getRefreshTokenFailures', 'isRefreshTokenLocked', 'clearRefreshTokenFailures', 'RT'],
])('enforces %s failure limits and resets counters', async (prefix, record, get, locked, clear, envPrefix) => {
  await store.initRedis();
  client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(10);
  await expect(store[record]('ip')).resolves.toBe(1);
  await expect(store[record]('ip')).resolves.toBe(10);
  expect(client.expire).toHaveBeenCalledWith(`${prefix}:fail:ip`, 300);
  expect(client.set).toHaveBeenCalledWith(`${prefix}:lock:ip`, '1', { EX: 1800 });
  client.get.mockResolvedValueOnce('2').mockResolvedValueOnce(null);
  await expect(store[get]('ip')).resolves.toBe(2);
  await expect(store[get]('ip')).resolves.toBe(0);
  client.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await expect(store[locked]('ip')).resolves.toBe(true);
  await expect(store[locked]('ip')).resolves.toBe(false);
  await expect(store[clear]('ip')).resolves.toBe(true);
  expect(client.del).toHaveBeenCalledWith(`${prefix}:fail:ip`);
  expect(client.del).toHaveBeenCalledWith(`${prefix}:lock:ip`);
  Object.assign(process.env, { [`${envPrefix}_FAIL_TTL`]: '10', [`${envPrefix}_LOCK_THRESHOLD`]: '2', [`${envPrefix}_LOCK_TTL`]: '30' });
  client.incr.mockResolvedValue(2);
  await store[record]('ip');
  expect(client.set).toHaveBeenLastCalledWith(`${prefix}:lock:ip`, '1', { EX: 30 });
});
test('enforces media staging quotas and clears exhausted counts', async () => {
  await store.initRedis();
  client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(4);
  await expect(store.incrementMediaStagingCount(12)).resolves.toBe(true);
  await expect(store.incrementMediaStagingCount(12)).resolves.toBe(false);
  expect(client.expire).toHaveBeenCalledWith('media:staging:12', 60);
  client.get.mockResolvedValueOnce(null).mockResolvedValueOnce('1').mockResolvedValueOnce('3');
  client.decr.mockResolvedValue(2);
  await expect(store.decrementMediaStagingCount(12)).resolves.toBe(0);
  await expect(store.decrementMediaStagingCount(12)).resolves.toBe(0);
  await expect(store.decrementMediaStagingCount(12)).resolves.toBe(2);
});
test('creates, loads, and deletes short-lived admin transfers', async () => {
  await store.initRedis();
  await expect(store.createAdminTransferSession(12, 13, 'token')).resolves.toBe('token');
  expect(client.hSet).toHaveBeenCalledWith('admin:transfer:token', { old_admin_id: '12', new_admin_id: '13', created_at: expect.any(String) });
  expect(client.expire).toHaveBeenCalledWith('admin:transfer:token', 600);
  client.hGetAll.mockResolvedValueOnce(null).mockResolvedValueOnce({}).mockResolvedValueOnce({ old_admin_id: '12', new_admin_id: '13', created_at: '1000' });
  await expect(store.getAdminTransferSession('token')).resolves.toBeNull();
  await expect(store.getAdminTransferSession('token')).resolves.toBeNull();
  await expect(store.getAdminTransferSession('token')).resolves.toEqual({ oldAdminId: '12', newAdminId: '13', createdAt: 1000 });
  await expect(store.deleteAdminTransferSession('token')).resolves.toBe(true);
  expect(client.del).toHaveBeenCalledWith('admin:transfer:token');
});
test('reports admin-transfer cooldowns and owned pending transfers', async () => {
  await store.initRedis();
  client.get.mockResolvedValueOnce(null).mockResolvedValue('1000');
  await expect(store.recordAdminTransferAttempt(12)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  client.ttl.mockResolvedValueOnce(20).mockResolvedValueOnce(-1);
  await expect(store.recordAdminTransferAttempt(12)).resolves.toEqual({ allowed: false, retryAfterSeconds: 20 });
  await expect(store.recordAdminTransferAttempt(12)).resolves.toEqual({ allowed: false, retryAfterSeconds: 300 });
  client.keys.mockResolvedValueOnce([]).mockResolvedValue(['admin:transfer:attempt:12', 'admin:transfer:pw:fail:12', 'admin:transfer:empty', 'admin:transfer:other', 'admin:transfer:token12345']);
  await expect(store.getAdminActivePendingTransfer(12)).resolves.toEqual({ hasPending: false, tokenPrefix: null });
  client.hGetAll.mockResolvedValueOnce(null).mockResolvedValueOnce({ old_admin_id: '13' }).mockResolvedValueOnce({ old_admin_id: '12' });
  await expect(store.getAdminActivePendingTransfer(12)).resolves.toEqual({ hasPending: true, tokenPrefix: 'token123...' });
  client.hGetAll.mockResolvedValue(null);
  await expect(store.getAdminActivePendingTransfer(12)).resolves.toEqual({ hasPending: false, tokenPrefix: null });
});
test('tracks and clears admin-transfer password lockouts', async () => {
  await store.initRedis();
  client.exists.mockResolvedValue(0); client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
  await expect(store.recordAdminTransferPasswordFailure(12)).resolves.toEqual({ failures: 1, locked: false, lockoutTTL: 0 });
  await expect(store.recordAdminTransferPasswordFailure(12)).resolves.toEqual({ failures: 3, locked: true, lockoutTTL: 1800 });
  await expect(store.isAdminTransferPasswordLocked(12)).resolves.toEqual({ locked: false, ttl: 0 });
  client.exists.mockResolvedValue(1);
  for (const ttl of [15, -1]) {
    client.ttl.mockResolvedValue(ttl);
    await expect(store.recordAdminTransferPasswordFailure(12)).resolves.toEqual({ failures: 3, locked: true, lockoutTTL: ttl > 0 ? ttl : 1800 });
    await expect(store.isAdminTransferPasswordLocked(12)).resolves.toEqual({ locked: true, ttl: ttl > 0 ? ttl : 1800 });
  }
  await store.clearAdminTransferPasswordFailures(12);
  expect(client.del).toHaveBeenCalledWith('admin:transfer:pw:fail:12');
  expect(client.del).toHaveBeenCalledWith('admin:transfer:pw:lock:12');
});
test.each([['patient', 'patient'], ['medical', 'staff']])('tracks login failures and CAPTCHA thresholds for %s', async (portal, prefix) => {
  await store.initRedis();
  client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(5);
  await expect(store.incrementLoginFailure('email', portal)).resolves.toBe(1);
  await expect(store.incrementLoginFailure('email', portal)).resolves.toBe(5);
  expect(client.expire).toHaveBeenCalledWith(`login:${prefix}:fail:email`, 300);
  expect(client.set).toHaveBeenCalledWith(`login:${prefix}:lock:email`, '1', { EX: 300 });
  client.exists.mockResolvedValueOnce(0).mockResolvedValue(1);
  client.ttl.mockResolvedValueOnce(20).mockResolvedValueOnce(-1);
  await expect(store.isLoginLocked('email', portal)).resolves.toBe(0);
  await expect(store.isLoginLocked('email', portal)).resolves.toBe(20);
  await expect(store.isLoginLocked('email', portal)).resolves.toBe(0);
  client.get.mockResolvedValueOnce('3').mockResolvedValueOnce(null);
  await expect(store.shouldRequireRecaptcha('email', portal)).resolves.toBe(true);
  await expect(store.getLoginFailureCount('email', portal)).resolves.toBe(0);
  await store.resetLoginFailures('email', portal);
  expect(client.del).toHaveBeenCalledWith(`login:${prefix}:fail:email`);
  for (const method of ['incrementLoginFailure', 'isLoginLocked', 'getLoginFailureCount']) await expect(store[method]('email', 'invalid')).rejects.toThrow('Unknown portal');
  await expect(store.resetLoginFailures('email', 'invalid')).resolves.toBeUndefined();
});
test('locks TOTP keys at the threshold and expires the first failure', async () => {
  await store.initRedis();
  client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(5);
  await expect(store.recordTotpFailureForKey('token', '2fa')).resolves.toBe(false);
  await expect(store.recordTotpFailureForKey('token', '2fa', 5)).resolves.toBe(true);
  expect(client.expire).toHaveBeenCalledWith('totp_fail:2fa:token', 900);
  client.get.mockResolvedValueOnce(null).mockResolvedValueOnce('5');
  await expect(store.isTotpLockedForKey('token', '2fa')).resolves.toBe(false);
  await expect(store.isTotpLockedForKey('token', '2fa', 5)).resolves.toBe(true);
  process.env.VERIFICATION_SESSION_EXPIRATION = '30'; client.incr.mockResolvedValue(1);
  await store.recordTotpFailureForKey('token', '2fa');
  expect(client.expire).toHaveBeenLastCalledWith('totp_fail:2fa:token', 30);
});
