const mockRouter = { post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../../utils/validator.js', () => ({ isValidEmail: jest.fn() }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ portalBasedIpRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../../config/redis.js', () => ({ createVerificationSession: jest.fn(), getVerificationSession: jest.fn(), deleteVerificationSession: jest.fn(), incrementLoginFailure: jest.fn(), isLoginLocked: jest.fn(), shouldRequireRecaptcha: jest.fn(), resetLoginFailures: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ findUserByEmail: jest.fn(), recordLoginAttempt: jest.fn(), isActiveMedicalPersonnel: jest.fn(), getMedicalPersonnelStatus: jest.fn(), getCredentialLockStateByUserId: jest.fn() }));
jest.mock('../../../utils/security.js', () => ({ verifyPassword: jest.fn(), generateRandomKey: jest.fn() }));
jest.mock('../../../services/auth/recaptcha.js', () => ({ verifyRecaptcha: jest.fn() }));
jest.mock('../../../utils/portal.js', () => ({ detectPortalFromSubdomain: jest.fn() }));
jest.mock('../../../utils/authSession.js', () => ({ create: jest.fn() }));
jest.mock('../../../utils/consent.js', () => ({ DATA_CONSENT_REQUIRED: 'DATA_CONSENT_REQUIRED', OUTDATED_CONSENT: 'OUTDATED_CONSENT', getConsentGateError: jest.fn() }));
jest.mock('../../../utils/logger.js', () => ({ warn: jest.fn(), error: jest.fn() }));

const validator = require('../../../utils/validator.js'); const redis = require('../../../config/redis.js'); const db = require('../../../config/query.js');
const security = require('../../../utils/security.js'); const captcha = require('../../../services/auth/recaptcha.js'); const portal = require('../../../utils/portal.js');
const AuthSession = require('../../../utils/authSession.js'); const consent = require('../../../utils/consent.js'); const logger = require('../../../utils/logger.js');
require('./login.js');
const start = mockRouter.post.mock.calls.find(args => args[0] === '/').at(-1);
const complete = mockRouter.post.mock.calls.find(args => args[0] === '/complete').at(-1);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const req = (body = {}, overrides = {}) => ({ body, headers: {}, ip: '127.0.0.1', socket: {}, ...overrides });
const login = { email: 'a@tip.edu.ph', password: 'goodpassword' };
const user = { id: 9, password_hash: 'hash', credentials_status: 'Active', totp_enabled: false };
const session = { email: login.email, user_exists: 'true', user_id: 9, email_2fa_verified: 'true' };
const originalConsentVersion = process.env.DATA_CONSENT_VERSION;
beforeEach(() => {
  jest.clearAllMocks(); process.env.DATA_CONSENT_VERSION = 'v2'; portal.detectPortalFromSubdomain.mockReturnValue('Patient'); validator.isValidEmail.mockReturnValue(true);
  redis.isLoginLocked.mockResolvedValue(0); redis.shouldRequireRecaptcha.mockResolvedValue(false); redis.incrementLoginFailure.mockResolvedValue(2);
  redis.createVerificationSession.mockResolvedValue('login-key'); redis.getVerificationSession.mockResolvedValue(session); db.findUserByEmail.mockResolvedValue(user);
  db.isActiveMedicalPersonnel.mockResolvedValue(true); db.getMedicalPersonnelStatus.mockResolvedValue(true); db.getCredentialLockStateByUserId.mockResolvedValue(null);
  security.verifyPassword.mockResolvedValue(true); captcha.verifyRecaptcha.mockResolvedValue(true); consent.getConsentGateError.mockReturnValue(null);
  AuthSession.create.mockResolvedValue({ accessToken: 'token' });
});
afterAll(() => { if (originalConsentVersion === undefined) delete process.env.DATA_CONSENT_VERSION; else process.env.DATA_CONSENT_VERSION = originalConsentVersion; });

test('stage-one login checks required fields, account lock and institutional email', async () => {
  for (const body of [{}, { email: login.email }, { password: login.password }]) {
    const res = response(); await start(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  redis.isLoginLocked.mockResolvedValueOnce(17); let res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_LOCKED' }));
  validator.isValidEmail.mockReturnValueOnce(false); res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_INSTITUTION_EMAIL' }));
  expect(db.findUserByEmail).not.toHaveBeenCalled();
});

test('stage-one adaptive captcha rejects missing or invalid token and permits a valid token', async () => {
  redis.shouldRequireRecaptcha.mockResolvedValueOnce(true); let res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'RECAPTCHA_REQUIRED' }));
  redis.shouldRequireRecaptcha.mockResolvedValueOnce(true); captcha.verifyRecaptcha.mockResolvedValueOnce(false);
  res = response(); await start(req({ ...login, recaptchaToken: 'captcha' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_RECAPTCHA' }));
  redis.shouldRequireRecaptcha.mockResolvedValueOnce(true);
  res = response(); await start(req({ ...login, recaptchaToken: 'captcha' }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(captcha.verifyRecaptcha).toHaveBeenCalledWith('captcha');
});

test('stage-one rejects unknown, locked and bad-password accounts without creating a session', async () => {
  db.findUserByEmail.mockResolvedValueOnce(null); let res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CREDENTIALS', requiresCaptcha: false }));
  db.findUserByEmail.mockResolvedValueOnce({ ...user, credentials_status: 'LOCKED' }); res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_LOCKED' }));
  db.findUserByEmail.mockResolvedValueOnce({ ...user, credentials_status: null }); security.verifyPassword.mockResolvedValueOnce(false);
  res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CREDENTIALS' }));
  expect(redis.incrementLoginFailure).toHaveBeenCalledTimes(2); expect(redis.createVerificationSession).not.toHaveBeenCalled();
});

test('medical portal rejects suspended and inactive staff, while valid staff and patients enter 2FA', async () => {
  portal.detectPortalFromSubdomain.mockReturnValue('Medical'); db.isActiveMedicalPersonnel.mockResolvedValueOnce(false); db.getMedicalPersonnelStatus.mockResolvedValueOnce(false);
  let res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'STAFF_ACCOUNT_SUSPENDED' }));
  db.isActiveMedicalPersonnel.mockResolvedValueOnce(false); res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CREDENTIALS' }));
  res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, requires2FA: true, requiresTotp: false, LoginKey: 'login-key' }));
  expect(redis.createVerificationSession).toHaveBeenCalledWith(login.email, '2fa', 'medical');
  portal.detectPortalFromSubdomain.mockReturnValueOnce('Patient'); db.findUserByEmail.mockResolvedValueOnce({ ...user, totp_enabled: true });
  res = response(); await start(req(login, { headers: { 'x-forwarded-for': [' 10.0.0.1 '], 'user-agent': ' Browser ' } }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresTotp: true }));
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '10.0.0.1', userAgent: 'Browser', userId: 9, wasSuccessful: false }));
});

test('stage-one audit and unexpected dependency failures produce stable responses', async () => {
  db.recordLoginAttempt.mockRejectedValueOnce(Error('audit down'));
  let res = response(); await start(req({}, { ip: null, socket: { remoteAddress: ' 10.0.0.2 ' } }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(logger.warn).toHaveBeenCalledWith('[LOGIN] Failed to write login attempt audit record', expect.objectContaining({ error: 'audit down', ipAddress: '10.0.0.2' }));
  db.recordLoginAttempt.mockRejectedValueOnce(undefined);
  await start(req({}), response()); expect(logger.warn).toHaveBeenCalledWith('[LOGIN] Failed to write login attempt audit record', expect.objectContaining({ error: 'Unknown audit write error', email: null }));
  db.findUserByEmail.mockRejectedValueOnce(Error('database down'));
  res = response(); await start(req(login), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INTERNAL_ERROR' }));
});

test('completion requires a valid login key and full session metadata', async () => {
  let res = response(); await complete(req({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  for (const invalid of [null, {}, { email: login.email }, { email: login.email, user_exists: 'false' }, { email: login.email, user_exists: 'true', user_id: '' }]) {
    redis.getVerificationSession.mockResolvedValueOnce(invalid); res = response(); await complete(req({ LoginKey: 'key' }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_LOGIN_SESSION' }));
  }
  expect(AuthSession.create).not.toHaveBeenCalled();
});

test('completion accepts either factor and enforces both consent gates', async () => {
  redis.getVerificationSession.mockResolvedValueOnce({ ...session, email_2fa_verified: 'false', totp_2fa_verified: 'false' });
  let res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: '2FA_NOT_VERIFIED' }));
  consent.getConsentGateError.mockReturnValueOnce('DATA_CONSENT_REQUIRED');
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'DATA_CONSENT_REQUIRED' }));
  consent.getConsentGateError.mockReturnValueOnce('OUTDATED_CONSENT');
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OUTDATED_CONSENT' }));
  redis.getVerificationSession.mockResolvedValueOnce({ ...session, email_2fa_verified: 'false', totp_2fa_verified: 'true' });
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(consent.getConsentGateError).toHaveBeenCalledWith(expect.objectContaining({ email: login.email }), 'v2');
});

test('completion rejects locked accounts and suspended or inactive medical access', async () => {
  db.getCredentialLockStateByUserId.mockResolvedValueOnce({ status: 'locked', email: 'locked@tip.edu.ph' });
  let res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_LOCKED' }));
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ email: 'locked@tip.edu.ph' }));
  db.getCredentialLockStateByUserId.mockResolvedValueOnce({ status: 'locked', email: null });
  res = response(); await complete(req({ LoginKey: 'key' }), res);
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ email: login.email }));
  portal.detectPortalFromSubdomain.mockReturnValue('medical'); db.isActiveMedicalPersonnel.mockResolvedValueOnce(false); db.getMedicalPersonnelStatus.mockResolvedValueOnce(false);
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'STAFF_ACCOUNT_SUSPENDED' }));
  db.isActiveMedicalPersonnel.mockResolvedValueOnce(false);
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'STAFF_ACCOUNT_INACTIVE' }));
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
});

test('completion records success, clears failure state, and tolerates audit failures', async () => {
  const request = req({ LoginKey: 'key' }, { headers: { 'x-forwarded-for': ' 10.0.0.4, 10.0.0.5 ' } });
  let res = response(); await complete(request, res);
  expect(redis.deleteVerificationSession).toHaveBeenCalledWith('key', '2fa');
  expect(redis.resetLoginFailures).toHaveBeenCalledWith(login.email, 'Patient');
  expect(AuthSession.create).toHaveBeenCalledWith(request, 9);
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, wasSuccessful: true, ipAddress: '10.0.0.4' }));
  expect(res.json).toHaveBeenCalledWith({ ok: true, accessToken: 'token', message: 'Login successful.' });
  db.recordLoginAttempt.mockRejectedValueOnce({});
  res = response(); await complete(req({ LoginKey: 'key' }, { ip: null, socket: {} }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(logger.warn).toHaveBeenCalledWith('[LOGIN_COMPLETE] Failed to write login attempt audit record', expect.objectContaining({ error: 'Unknown audit write error', ipAddress: null }));
  db.recordLoginAttempt.mockRejectedValueOnce(Error('audit offline'));
  res = response(); await complete(req({}, { ip: null, socket: {} }), res); expect(res.status).toHaveBeenCalledWith(400);
  expect(logger.warn).toHaveBeenCalledWith('[LOGIN_COMPLETE] Failed to write login attempt audit record', expect.objectContaining({ email: null, userId: null }));
  redis.getVerificationSession.mockRejectedValueOnce(Error('redis down'));
  res = response(); await complete(req({ LoginKey: 'key' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INTERNAL_ERROR' }));
});
