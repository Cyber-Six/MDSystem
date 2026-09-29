const mockRouter = { post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../../utils/validator.js', () => ({ isValidEmail: jest.fn(), validatePassword: jest.fn(), PatientRoleFromEmail: jest.fn() }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ portalBasedIpRateLimiter: jest.fn(), ipRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../../config/redis.js', () => ({ getVerificationSession: jest.fn(), deleteVerificationSession: jest.fn() }));
jest.mock('../../../config/query.js', () => ({ recordLoginAttempt: jest.fn(), countUserByEmail: jest.fn(), findUserByEmail: jest.fn(), createUser: jest.fn(), createPatient: jest.fn() }));
jest.mock('../../../utils/authSession.js', () => ({ create: jest.fn() }));
jest.mock('../../../utils/consent.js', () => ({ DATA_CONSENT_REQUIRED: 'DATA_CONSENT_REQUIRED', OUTDATED_CONSENT: 'OUTDATED_CONSENT', getConsentGateError: jest.fn() }));
jest.mock('../../../utils/logger.js', () => ({ warn: jest.fn() }));

const validator = require('../../../utils/validator.js'); const redis = require('../../../config/redis.js'); const db = require('../../../config/query.js');
const AuthSession = require('../../../utils/authSession.js'); const consent = require('../../../utils/consent.js'); const logger = require('../../../utils/logger.js');
require('./register.js');
const precheck = mockRouter.post.mock.calls.find(args => args[0] === '/').at(-1);
const complete = mockRouter.post.mock.calls.find(args => args[0] === '/complete').at(-1);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const req = (body = {}, overrides = {}) => ({ body, ip: '127.0.0.1', headers: {}, socket: {}, ...overrides });
const base = { email: 'patient@tip.edu.ph', password: 'goodpassword', verificationKey: 'key' };
const originalConsentVersion = process.env.DATA_CONSENT_VERSION;
beforeEach(() => {
  jest.clearAllMocks(); process.env.DATA_CONSENT_VERSION = 'v2'; validator.isValidEmail.mockReturnValue(true); validator.validatePassword.mockReturnValue(true);
  validator.PatientRoleFromEmail.mockReturnValue('Patient'); db.countUserByEmail.mockResolvedValue(0); db.findUserByEmail.mockResolvedValue(null);
  db.createUser.mockResolvedValue({ id: 9 }); db.createPatient.mockResolvedValue({ id: 9 });
  redis.getVerificationSession.mockResolvedValue({ email: base.email, consent: true }); consent.getConsentGateError.mockReturnValue(null);
  AuthSession.create.mockResolvedValue({ accessToken: 'token' });
});
afterAll(() => { if (originalConsentVersion === undefined) delete process.env.DATA_CONSENT_VERSION; else process.env.DATA_CONSENT_VERSION = originalConsentVersion; });

test('precheck audits missing fields and invalid email or password', async () => {
  for (const body of [{}, { email: base.email }, { password: base.password }]) {
    const res = response(); await precheck(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  validator.isValidEmail.mockReturnValueOnce(false); let res = response(); await precheck(req(base), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_INSTITUTION_EMAIL' }));
  validator.validatePassword.mockReturnValueOnce(false); res = response(); await precheck(req(base), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PASSWORD' }));
  expect(db.recordLoginAttempt).toHaveBeenCalledTimes(5);
});

test('precheck preserves account non-enumeration and records the existing user ID', async () => {
  db.countUserByEmail.mockResolvedValueOnce(1); db.findUserByEmail.mockResolvedValueOnce({ id: 4 });
  let res = response(); await precheck(req(base, { headers: { 'x-forwarded-for': [' 10.0.0.1 ', '10.0.0.2'], 'user-agent': ' Browser ' } }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, userExists: true }));
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ email: base.email, userId: 4, wasSuccessful: false, ipAddress: '10.0.0.1', userAgent: 'Browser' }));
  db.countUserByEmail.mockResolvedValueOnce(1); db.findUserByEmail.mockResolvedValueOnce(null);
  res = response(); await precheck(req(base), res); expect(res.status).toHaveBeenCalledWith(200);
  res = response(); await precheck(req(base, { ip: null, socket: { remoteAddress: ' 10.0.0.3 ' }, headers: { 'x-forwarded-for': '' } }), res);
  expect(res.json).toHaveBeenCalledWith({ ok: true });
  expect(db.recordLoginAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ ipAddress: '10.0.0.3' }));
});

test('registration audit failures do not suppress precheck responses', async () => {
  db.recordLoginAttempt.mockRejectedValueOnce(Error('audit offline'));
  const res = response(); await precheck(req({}, { ip: null, socket: {}, headers: {} }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(logger.warn).toHaveBeenCalledWith('[REGISTER] Failed to write registration audit record', expect.objectContaining({ email: null, userId: null, ipAddress: null, error: 'audit offline' }));
  db.recordLoginAttempt.mockRejectedValueOnce(undefined);
  await precheck(req({}), response());
  expect(logger.warn).toHaveBeenCalledWith('[REGISTER] Failed to write registration audit record', expect.objectContaining({ error: 'Unknown audit write error' }));
});

test('completion validates fields, email, password and ownership session', async () => {
  for (const body of [{}, { ...base, verificationKey: null }, { ...base, email: null }, { ...base, password: null }]) {
    const res = response(); await complete(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  validator.isValidEmail.mockReturnValueOnce(false); let res = response(); await complete(req(base), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_INSTITUTION_EMAIL' }));
  validator.validatePassword.mockReturnValueOnce(false); res = response(); await complete(req(base), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PASSWORD' }));
  for (const session of [null, { email: 'other@tip.edu.ph' }]) {
    redis.getVerificationSession.mockResolvedValueOnce(session); res = response(); await complete(req(base), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_VERIFICATION_SESSION' }));
  }
  expect(db.createUser).not.toHaveBeenCalled();
});

test('completion enforces both consent gates from the verified session', async () => {
  for (const error of ['DATA_CONSENT_REQUIRED', 'OUTDATED_CONSENT']) {
    consent.getConsentGateError.mockReturnValueOnce(error); const res = response(); await complete(req(base), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    expect(consent.getConsentGateError).toHaveBeenCalledWith(expect.objectContaining({ email: base.email }), 'v2');
  }
  expect(redis.deleteVerificationSession).not.toHaveBeenCalled();
});

test('verified existing accounts return a stable response and new accounts receive a session', async () => {
  db.findUserByEmail.mockResolvedValueOnce({ id: 12 }); let res = response(); await complete(req(base), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ userId: 12, wasSuccessful: false }));
  res = response(); const request = req(base, { headers: { 'x-forwarded-for': ' 10.0.0.1, 10.0.0.2 ' } }); await complete(request, res);
  expect(db.createUser).toHaveBeenCalledWith({ email: base.email, password: base.password, role: 'Patient', data_consent_version: 'v2' });
  expect(db.createPatient).toHaveBeenCalledWith({ id: 9, email: base.email });
  expect(AuthSession.create).toHaveBeenCalledWith(request, 9);
  expect(db.recordLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, wasSuccessful: true, ipAddress: '10.0.0.1' }));
  expect(res.json).toHaveBeenCalledWith({ ok: true, accessToken: 'token', message: 'Account created successfully.' });
  expect(redis.deleteVerificationSession).toHaveBeenCalledWith('key', 'verification');
});

test('completion audit failure does not prevent successful account creation', async () => {
  db.recordLoginAttempt.mockRejectedValueOnce({});
  const res = response(); await complete(req(base), res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(logger.warn).toHaveBeenCalledWith('[REGISTER_COMPLETE] Failed to write registration audit record', expect.objectContaining({ error: 'Unknown audit write error' }));
  db.recordLoginAttempt.mockRejectedValueOnce(Error('audit offline'));
  await complete(req({}), response());
  expect(logger.warn).toHaveBeenCalledWith('[REGISTER_COMPLETE] Failed to write registration audit record', expect.objectContaining({ email: null, userId: null }));
});
