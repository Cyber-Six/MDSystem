const mockRouter = { post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../../utils/validator.js', () => ({ isValidEmail: jest.fn(value => value === 'user@tip.edu.ph') }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ portalBasedIpRateLimiter: jest.fn(() => 'limiter') }));
jest.mock('../../../config/redis.js', () => ({ verifyOTP: jest.fn(), getOTPFailureCount: jest.fn(), getOTPLockoutTTL: jest.fn(), createVerificationSession: jest.fn(), rateLimitEmailCooldown: jest.fn(), rateLimitEmailAttempts: jest.fn(), deleteEmailCooldown: jest.fn(), deleteEmailAttempts: jest.fn(), update2FAInSession: jest.fn() }));
jest.mock('../../../config/data/matrix.js', () => ({ rateLimitMatrix: { PatientAuthentication: { emailCooldown_2fa: 1, emailCooldown_emailv: 2, emailAttemptMax_2fa: 3, emailAttemptMax_emailv: 4, penaltyCooldown_resetpw: 5 }, staffAuthentication: { emailCooldown_2fa: 6, emailCooldown_emailv: 7, emailAttemptMax_2fa: 8, emailAttemptMax_emailv: 9, penaltyCooldown_resetpw: 10 } } }));
jest.mock('../../../services/recaptcha.js', () => ({ verifyRecaptcha: jest.fn() }));
jest.mock('../../../services/emailservice.js', () => ({ enqueueEmailVerification: jest.fn(), enqueueEmail2FA: jest.fn() }));
jest.mock('../../../utils/portal.js', () => ({ detectPortalFromSubdomain: jest.fn(() => 'patient') }));
const initialRecaptchaTestMode = process.env.RECAPTCHA_TEST_MODE;
process.env.RECAPTCHA_TEST_MODE = 'true';
require('./emailauth');
if (initialRecaptchaTestMode === undefined) delete process.env.RECAPTCHA_TEST_MODE;
else process.env.RECAPTCHA_TEST_MODE = initialRecaptchaTestMode;
const redis = require('../../../config/redis.js'); const emails = require('../../../services/emailservice.js'); const captcha = require('../../../services/recaptcha.js'); const portal = require('../../../utils/portal.js');
const [send, verify] = mockRouter.post.mock.calls.map(call => call[2]);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); portal.detectPortalFromSubdomain.mockReturnValue('patient'); redis.rateLimitEmailCooldown.mockResolvedValue(false); redis.rateLimitEmailAttempts.mockResolvedValue(false); redis.verifyOTP.mockResolvedValue(true); });

test('validates OTP sending purpose, email, captcha requirement, and institutional address', async () => {
  for (const [body, purpose, error] of [[{}, 'other', 'INVALID_PERFORM_ACTION'], [{}, 'verification', 'MISSING_FIELDS'], [{ email: 'bad@domain.com', recaptchaToken: 'x' }, 'verification', 'INVALID_INSTITUTION_EMAIL']]) {
    const res = response(); await send({ body, params: { purpose } }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
  }
});

test('sends verification and 2FA messages after cooldown and attempt checks', async () => {
  let res = response(); await send({ body: { email: 'user@tip.edu.ph', recaptchaToken: 'token' }, params: { purpose: 'verification' } }, res);
  expect(emails.enqueueEmailVerification).toHaveBeenCalledWith('user@tip.edu.ph'); expect(captcha.verifyRecaptcha).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(200);
  res = response(); await send({ body: { email: 'user@tip.edu.ph' }, params: { purpose: '2FA' } }, res);
  expect(emails.enqueueEmail2FA).toHaveBeenCalledWith('user@tip.edu.ph', 'patient'); expect(redis.rateLimitEmailCooldown).toHaveBeenLastCalledWith('user@tip.edu.ph', 'patient', '2fa', 1);
});

test('uses staff rate limits and sends staff 2FA through the staff portal', async () => {
  portal.detectPortalFromSubdomain.mockReturnValue('staff');
  const res = response();
  await send({ body: { email: 'user@tip.edu.ph' }, params: { purpose: '2fa' } }, res);
  expect(redis.rateLimitEmailCooldown).toHaveBeenCalledWith('user@tip.edu.ph', 'staff', '2fa', 6);
  expect(redis.rateLimitEmailAttempts).toHaveBeenCalledWith('user@tip.edu.ph', 'staff', '2fa', 8, 10);
  expect(emails.enqueueEmail2FA).toHaveBeenCalledWith('user@tip.edu.ph', 'staff');
});

test('enforces CAPTCHA in production mode and blocks cooldown or excessive attempts', async () => {
  const prev = process.env.RECAPTCHA_TEST_MODE; process.env.RECAPTCHA_TEST_MODE = 'false'; jest.resetModules();
  const freshRedis = require('../../../config/redis.js'); const freshCaptcha = require('../../../services/recaptcha.js');
  freshCaptcha.verifyRecaptcha.mockResolvedValue(false);
  require('./emailauth'); const sendHandler = mockRouter.post.mock.calls.at(-2)[2];
  let res = response(); await sendHandler({ body: { email: 'user@tip.edu.ph' }, params: { purpose: 'verification' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  res = response(); await sendHandler({ body: { email: 'user@tip.edu.ph', recaptchaToken: 'bad' }, params: { purpose: 'verification' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_RECAPTCHA' }));
  freshCaptcha.verifyRecaptcha.mockResolvedValue(true); freshRedis.rateLimitEmailCooldown.mockResolvedValueOnce(true);
  res = response(); await sendHandler({ body: { email: 'user@tip.edu.ph', recaptchaToken: 'ok' }, params: { purpose: 'verification' } }, res);
  expect(res.status).toHaveBeenCalledWith(429);
  freshRedis.rateLimitEmailCooldown.mockResolvedValue(false); freshRedis.rateLimitEmailAttempts.mockResolvedValueOnce(true);
  res = response(); await sendHandler({ body: { email: 'user@tip.edu.ph', recaptchaToken: 'ok' }, params: { purpose: 'verification' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_ATTEMPT_LIMIT_REACHED' }));
  if (prev === undefined) delete process.env.RECAPTCHA_TEST_MODE; else process.env.RECAPTCHA_TEST_MODE = prev;
});

test('validates OTP submission and requires verification key for two-factor confirmation', async () => {
  for (const [body, purpose, error] of [[{}, 'other', 'INVALID_PERFORM_ACTION'], [{}, 'verification', 'MISSING_FIELDS'], [{ email: 'user@tip.edu.ph', otp: '1' }, '2fa', 'MISSING_VERIFICATION_KEY'], [{ email: 'bad@x', otp: '1' }, 'verification', 'INVALID_INSTITUTION_EMAIL']]) {
    const res = response(); await verify({ body, params: { purpose } }, res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
  }
});

test('reports locked and invalid OTP attempts with lockout details', async () => {
  redis.verifyOTP.mockResolvedValueOnce('LOCKED_OUT').mockResolvedValueOnce(false); redis.getOTPFailureCount.mockResolvedValue(6); redis.getOTPLockoutTTL.mockResolvedValue(45);
  let res = response(); await verify({ body: { email: 'user@tip.edu.ph', otp: '0' }, params: { purpose: 'verification' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OTP_LOCKED_OUT', attempts: 6, retryAfterSeconds: 45 }));
  res = response(); await verify({ body: { email: 'user@tip.edu.ph', otp: '0' }, params: { purpose: 'verification' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_OTP', attempts: 6 }));
});

test('clears limits and creates portal scoped verification sessions after valid OTP', async () => {
  redis.createVerificationSession.mockResolvedValue('verification-key');
  let res = response(); await verify({ body: { email: 'user@tip.edu.ph', otp: '123' }, params: { purpose: 'verification' } }, res);
  expect(redis.deleteEmailCooldown).toHaveBeenCalledWith('user@tip.edu.ph', 'patient', 'verification');
  expect(redis.deleteEmailAttempts).toHaveBeenCalledWith('user@tip.edu.ph', 'patient', 'verification');
  expect(redis.createVerificationSession).toHaveBeenCalledWith('user@tip.edu.ph', 'verification', 'patient');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, verificationKey: 'verification-key' }));
  res = response(); await verify({ body: { email: 'user@tip.edu.ph', otp: '123', verificationKey: '2fa-key' }, params: { purpose: '2fa' } }, res);
  expect(redis.update2FAInSession).toHaveBeenCalledWith('2fa-key', 'user@tip.edu.ph', '2fa');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ verificationKey: '2fa-key' }));
});
