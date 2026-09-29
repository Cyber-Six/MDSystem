const mockRouter = { post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../../utils/validator.js', () => ({ isValidEmail: jest.fn(value => value === 'user@tip.edu.ph') }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ portalBasedIpRateLimiter: jest.fn(() => 'limiter') }));
jest.mock('../../../services/auth/google-oauth.js', () => ({ verifyGoogleToken: jest.fn() }));
jest.mock('../../../config/redis.js', () => ({ createVerificationSession: jest.fn(), isLoginLocked: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ recordLoginAttempt: jest.fn(), findUserByEmail: jest.fn(), getCredentialLockStateByEmail: jest.fn(), isActiveMedicalPersonnel: jest.fn(), getMedicalPersonnelStatus: jest.fn() }));
jest.mock('../../../utils/portal.js', () => ({ detectPortalFromSubdomain: jest.fn(() => 'Patient') }));
jest.mock('../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn() }));
const query = require('../../../config/query.js'); const redis = require('../../../config/redis.js'); const oauth = require('../../../services/auth/google-oauth.js'); const portal = require('../../../utils/portal.js');
require('./google'); const handler = mockRouter.post.mock.calls[0][2];
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); portal.detectPortalFromSubdomain.mockReturnValue('Patient'); redis.isLoginLocked.mockResolvedValue(0); query.getCredentialLockStateByEmail.mockResolvedValue(null); });
const request = (credential='id-token', headers={}, ip='192.0.2.1') => ({ body: credential ? { credential } : {}, headers, ip, socket: { remoteAddress: '127.0.0.1' } });

test('requires the credential, verifies the provider token, and audits rejected attempts', async () => {
  let res = response(); await handler(request(null), res);
  expect(res.status).toHaveBeenCalledWith(400); expect(query.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ wasSuccessful: false, ipAddress: '192.0.2.1', userAgent: null }));
  oauth.verifyGoogleToken.mockResolvedValue(null); res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_GOOGLE_TOKEN' }));
});

test('rejects non-institutional email, locked accounts, and missing local users', async () => {
  oauth.verifyGoogleToken.mockResolvedValue({ email: 'other@example.com' }); let res = response(); await handler(request(), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_INSTITUTION_EMAIL' }));
  oauth.verifyGoogleToken.mockResolvedValue({ email: 'user@tip.edu.ph' }); redis.isLoginLocked.mockResolvedValueOnce(15); res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(403); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('15 seconds') }));
  redis.isLoginLocked.mockResolvedValue(0); query.findUserByEmail.mockResolvedValue(null); res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_NOT_FOUND' }));
});

test('honors credential lockout and staff account status checks', async () => {
  oauth.verifyGoogleToken.mockResolvedValue({ email: 'user@tip.edu.ph' }); query.findUserByEmail.mockResolvedValue({ id: 3 });
  query.getCredentialLockStateByEmail.mockResolvedValueOnce({ status: 'LOCKED' }); let res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(403); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'This account is locked.' }));
  portal.detectPortalFromSubdomain.mockReturnValue('Medical'); query.getCredentialLockStateByEmail.mockResolvedValue(null); query.isActiveMedicalPersonnel.mockResolvedValue(false); query.getMedicalPersonnelStatus.mockResolvedValueOnce(false);
  res = response(); await handler(request('id-token', { 'x-forwarded-for': ' 198.51.100.5, 10.0.0.1', 'user-agent': ' test agent ' }), res);
  expect(res.status).toHaveBeenCalledWith(403); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'STAFF_ACCOUNT_SUSPENDED' }));
  query.getMedicalPersonnelStatus.mockResolvedValueOnce(null); res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CREDENTIALS' }));
});

test('creates the 2FA verification session for existing patients and active staff', async () => {
  oauth.verifyGoogleToken.mockResolvedValue({ email: 'user@tip.edu.ph' }); query.findUserByEmail.mockResolvedValue({ id: 4, totp_enabled: true }); redis.createVerificationSession.mockResolvedValue('session-key');
  let res = response(); await handler(request('id-token', { 'x-forwarded-for': [' 203.0.113.2', 'other'], 'user-agent': 'browser' }), res);
  expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({ ok: true, email: 'user@tip.edu.ph', requires2FA: true, requiresTotp: true, LoginKey: 'session-key' });
  expect(redis.createVerificationSession).toHaveBeenCalledWith('user@tip.edu.ph', '2fa', 'patient');
  expect(query.recordLoginAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ ipAddress: '203.0.113.2', userAgent: 'browser', userId: 4 }));
  portal.detectPortalFromSubdomain.mockReturnValue('Medical'); query.isActiveMedicalPersonnel.mockResolvedValue(true); query.findUserByEmail.mockResolvedValue({ id: 4 });
  res = response(); await handler({ ...request(), headers: {}, ip: '' }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(query.recordLoginAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: null, userType: 'medical' }));
  query.getCredentialLockStateByEmail.mockResolvedValueOnce({ status: '' });
  res = response(); await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(200);
});

test('does not fail authentication when audit recording is unavailable', async () => {
  oauth.verifyGoogleToken.mockResolvedValue({ email: 'user@tip.edu.ph' }); query.findUserByEmail.mockResolvedValue({ id: 1 }); redis.createVerificationSession.mockResolvedValue('key'); query.recordLoginAttempt.mockRejectedValue(new Error('audit store down'));
  const res = response(); await handler(request('id-token', { 'user-agent': 'browser' }), res);
  expect(res.status).toHaveBeenCalledWith(200);
});

test('reports the feature-disabled response without performing authentication', async () => {
  const previous = process.env.GOOGLE_OAUTH_ENABLED;
  process.env.GOOGLE_OAUTH_ENABLED = 'false';
  jest.resetModules();
  require('./google');
  const disabledHandler = mockRouter.post.mock.calls.at(-1)[2];
  const res = response();
  await disabledHandler(request(), res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OAUTH_DISABLED' }));
  if (previous === undefined) delete process.env.GOOGLE_OAUTH_ENABLED;
  else process.env.GOOGLE_OAUTH_ENABLED = previous;
});

test('handles blank audit metadata and missing audit error messages', async () => {
  query.recordLoginAttempt.mockRejectedValueOnce({});
  const res = response();
  await handler({ body: {}, headers: { 'x-forwarded-for': ' , 10.0.0.1', 'user-agent': ' ' }, ip: '', socket: {} }, res);
  expect(query.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: null, userAgent: null }));
  expect(res.status).toHaveBeenCalledWith(400);
  const noAddress = response();
  await handler({ body: {}, headers: {}, ip: '', socket: {} }, noAddress);
  expect(query.recordLoginAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ ipAddress: null, userAgent: null }));
});
