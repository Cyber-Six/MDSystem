const mockRouter = { get: jest.fn(), post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => 'auth') }));
jest.mock('../../config/middleware/ratelimiter.js', () => ({ ipRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../utils/totp.js', () => ({ totpGenerateSecret: jest.fn(), totpVerify: jest.fn(), totpKeyUri: jest.fn(), encryptTotpSecret: jest.fn(), decryptTotpSecret: jest.fn() }));
jest.mock('../../config/redis.js', () => ({ getVerificationSession: jest.fn(), updateTotp2FAInSession: jest.fn(), recordTotpFailureForKey: jest.fn(), isTotpLockedForKey: jest.fn(), deleteVerificationSession: jest.fn() }));

const qr = require('qrcode'); const db = require('../../config/query.js'); const totp = require('../../utils/totp.js');
const redis = require('../../config/redis.js'); const logger = require('../../utils/logger.js');
require('./totp.js');
const status = mockRouter.get.mock.calls[0].at(-1);
const handlers = Object.fromEntries(mockRouter.post.mock.calls.map(args => [args[0], args.at(-1)]));
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const request = body => ({ user: { id: 7 }, body });
beforeEach(() => {
  jest.clearAllMocks(); totp.totpGenerateSecret.mockReturnValue('plain'); totp.encryptTotpSecret.mockReturnValue('cipher');
  totp.decryptTotpSecret.mockReturnValue('plain'); totp.totpVerify.mockReturnValue(true); totp.totpKeyUri.mockReturnValue('otpauth://test'); qr.toDataURL.mockResolvedValue('data:image/png;base64,qr');
  redis.getVerificationSession.mockResolvedValue({ email: 'a@example.com' }); redis.isTotpLockedForKey.mockResolvedValue(false); redis.recordTotpFailureForKey.mockResolvedValue(false);
});

test('status returns enrollment flags, defaults missing flags, and maps missing account or database errors', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, allow_email_2fa: true }] }); let res = response(); await status(request({}), res);
  expect(res.json).toHaveBeenCalledWith({ ok: true, totpEnabled: true, emailTwoFactorEnabled: true });
  db.query.mockResolvedValueOnce({ rows: [{}] }); res = response(); await status(request({}), res);
  expect(res.json).toHaveBeenCalledWith({ ok: true, totpEnabled: false, emailTwoFactorEnabled: false });
  db.query.mockResolvedValueOnce({ rows: [] }); res = response(); await status(request({}), res); expect(res.status).toHaveBeenCalledWith(404);
  db.query.mockRejectedValueOnce(Error('offline')); res = response(); await status(request({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_STATUS_FAILED' }));
});

test('setup rejects missing or enrolled accounts, then encrypts secret and renders QR', async () => {
  db.query.mockResolvedValueOnce({ rows: [] }); let res = response(); await handlers['/setup'](request({}), res); expect(res.status).toHaveBeenCalledWith(404);
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, email: 'a@example.com' }] }); res = response(); await handlers['/setup'](request({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_ALREADY_ENABLED' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: false, email: 'a@example.com' }] }); db.query.mockResolvedValueOnce({ rows: [] });
  res = response(); await handlers['/setup'](request({}), res);
  expect(db.query.mock.calls.at(-1)[1]).toEqual(['cipher', 7]);
  expect(totp.totpKeyUri).toHaveBeenCalledWith('a@example.com', 'plain');
  expect(qr.toDataURL).toHaveBeenCalledWith('otpauth://test', expect.objectContaining({ width: 256, margin: 2 }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, secret: 'plain', qrCode: 'data:image/png;base64,qr' }));
  db.query.mockRejectedValueOnce(Error('offline')); res = response(); await handlers['/setup'](request({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_SETUP_FAILED' }));
});

test('setup reports QR rendering failures without enabling TOTP', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: false, email: 'a@example.com' }] }).mockResolvedValueOnce({ rows: [] });
  qr.toDataURL.mockRejectedValueOnce(Error('render'));
  const res = response(); await handlers['/setup'](request({}), res);
  expect(res.status).toHaveBeenCalledWith(500); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_SETUP_FAILED' }));
});

test('setup verification validates token, account, secret, enrollment and code', async () => {
  for (const token of [undefined, 'bad']) { const res = response(); await handlers['/verify'](request({ token }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' })); }
  db.query.mockResolvedValueOnce({ rows: [] }); let res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.status).toHaveBeenCalledWith(404);
  db.query.mockResolvedValueOnce({ rows: [{ totp_secret: null, totp_enabled: false }] }); res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_NOT_SETUP' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'cipher', totp_enabled: true }] }); res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_ALREADY_ENABLED' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'cipher', totp_enabled: false }] }); totp.totpVerify.mockReturnValueOnce(false);
  res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOTP_CODE' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'cipher', totp_enabled: false }] }).mockResolvedValueOnce({ rows: [] });
  res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(db.query.mock.calls.at(-1)[1]).toEqual([7]);
  db.query.mockRejectedValueOnce(Error('offline')); res = response(); await handlers['/verify'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_VERIFY_FAILED' }));
});

test('disabling TOTP validates the current code and clears the encrypted secret', async () => {
  for (const token of [undefined, 'bad']) { const res = response(); await handlers['/disable'](request({ token }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' })); }
  db.query.mockResolvedValueOnce({ rows: [] }); let res = response(); await handlers['/disable'](request({ token: '123456' }), res); expect(res.status).toHaveBeenCalledWith(404);
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: false }] }); res = response(); await handlers['/disable'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_NOT_ENABLED' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, totp_secret: 'cipher' }] }); totp.totpVerify.mockReturnValueOnce(false);
  res = response(); await handlers['/disable'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOTP_CODE' }));
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, totp_secret: 'cipher' }] }).mockResolvedValueOnce({ rows: [] });
  res = response(); await handlers['/disable'](request({ token: '123456' }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(db.query.mock.calls.at(-1)[0]).toContain('totp_secret = NULL');
  db.query.mockRejectedValueOnce(Error('offline')); res = response(); await handlers['/disable'](request({ token: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_DISABLE_FAILED' }));
});

test('login validation rejects missing fields, malformed code and invalid session', async () => {
  const base = { token: '123456', verificationKey: 'key', email: 'a@example.com' };
  for (const body of [{}, { verificationKey: 'key', email: base.email }, { token: base.token, email: base.email }, { token: base.token, verificationKey: 'key' }]) {
    const res = response(); await handlers['/validate']({ body }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  let res = response(); await handlers['/validate']({ body: { ...base, token: 'bad' } }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }));
  for (const session of [null, {}]) {
    redis.getVerificationSession.mockResolvedValueOnce(session); res = response(); await handlers['/validate']({ body: base }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_SESSION' }));
  }
  redis.isTotpLockedForKey.mockResolvedValueOnce(true); res = response(); await handlers['/validate']({ body: base }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_SESSION' })); expect(redis.deleteVerificationSession).toHaveBeenCalledWith('key', '2fa');
  res = response(); await handlers['/validate']({ body: { ...base, email: 'other@example.com' } }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_MISMATCH' }));
});

test('login validation checks enrollment, records failures, and marks a valid session', async () => {
  const base = { token: '123456', verificationKey: 'key', email: 'A@example.com' };
  db.query.mockResolvedValueOnce({ rows: [] }); let res = response(); await handlers['/validate']({ body: base }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'USER_NOT_FOUND' }));
  for (const row of [{ totp_enabled: false, totp_secret: 'cipher' }, { totp_enabled: true, totp_secret: null }]) {
    db.query.mockResolvedValueOnce({ rows: [row] }); res = response(); await handlers['/validate']({ body: base }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_NOT_ENABLED' }));
  }
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, totp_secret: 'cipher' }] }); totp.totpVerify.mockReturnValueOnce(false);
  res = response(); await handlers['/validate']({ body: base }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOTP_CODE' }));
  expect(redis.deleteVerificationSession).not.toHaveBeenCalled();
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, totp_secret: 'cipher' }] }); totp.totpVerify.mockReturnValueOnce(false); redis.recordTotpFailureForKey.mockResolvedValueOnce(true);
  res = response(); await handlers['/validate']({ body: base }, res); expect(redis.deleteVerificationSession).toHaveBeenCalledWith('key', '2fa');
  db.query.mockResolvedValueOnce({ rows: [{ totp_enabled: true, totp_secret: 'cipher' }] });
  res = response(); await handlers['/validate']({ body: base }, res); expect(res.status).toHaveBeenCalledWith(200);
  expect(redis.updateTotp2FAInSession).toHaveBeenCalledWith('key', 'A@example.com', '2fa');
  expect(db.query.mock.calls.at(-1)[1]).toEqual(['A@example.com']);
  redis.getVerificationSession.mockRejectedValueOnce(Error('redis down'));
  res = response(); await handlers['/validate']({ body: base }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_VALIDATE_FAILED' }));
  expect(logger.error).toHaveBeenCalled();
});
