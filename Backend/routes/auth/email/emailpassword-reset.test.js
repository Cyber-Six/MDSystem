const mockRouter = { post: jest.fn(), get: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ ipRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn(), error: jest.fn() }));
jest.mock('../../../utils/validator.js', () => ({ isValidEmail: jest.fn(), validatePassword: jest.fn() }));
jest.mock('../../../utils/portal.js', () => ({ detectPortalFromSubdomain: jest.fn() }));
jest.mock('../../../config/redis.js', () => ({ rateLimitEmailCooldown: jest.fn(), rateLimitEmailAttempts: jest.fn(), rateLimitEmailCooldownTTL: jest.fn(), deleteVerificationSession: jest.fn(), getVerificationSession: jest.fn(), recordResetPwFailure: jest.fn(), clearResetPwFailures: jest.fn(), isResetPwLocked: jest.fn() }));
jest.mock('../../../config/data/matrix.js', () => ({ rateLimitMatrix: { PatientAuthentication: { emailCooldown_resetpw: 30, emailAttemptMax_resetpw: 3, penaltyCooldown_resetpw: 600 }, staffAuthentication: { emailCooldown_resetpw: 40, emailAttemptMax_resetpw: 4, penaltyCooldown_resetpw: 700 } } }));
jest.mock('../../../config/query.js', () => ({ findUserByEmail: jest.fn(), updateUserPasswordById: jest.fn() }));
jest.mock('../../../services/email/emailservice.js', () => ({ enqueueResetPassword: jest.fn() }));
jest.mock('../../../services/auth/recaptcha.js', () => ({ verifyRecaptcha: jest.fn() }));
jest.mock('../../../utils/security.js', () => ({ delayRandom: jest.fn() }));

const redis = require('../../../config/redis.js'); const validator = require('../../../utils/validator.js'); const portal = require('../../../utils/portal.js');
const db = require('../../../config/query.js'); const captcha = require('../../../services/auth/recaptcha.js'); const emailService = require('../../../services/email/emailservice.js');
const logger = require('../../../utils/logger.js'); const security = require('../../../utils/security.js');
require('./emailpassword-reset.js');
const forget = mockRouter.post.mock.calls.find(args => args[0] === '/forget-password').at(-1);
const reset = mockRouter.post.mock.calls.find(args => args[0] === '/reset-password/:verificationKey').at(-1);
const check = mockRouter.get.mock.calls[0].at(-1);
const response = () => ({ status: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), json: jest.fn() });
const req = (body = {}, verificationKey = 'key') => ({ ip: '127.0.0.1', body, params: { verificationKey } });
beforeEach(() => {
  jest.clearAllMocks(); redis.isResetPwLocked.mockResolvedValue(false); redis.rateLimitEmailCooldown.mockResolvedValue(false); redis.rateLimitEmailAttempts.mockResolvedValue(false);
  redis.getVerificationSession.mockResolvedValue({ user_id: 7 }); validator.isValidEmail.mockReturnValue(true); validator.validatePassword.mockReturnValue(true);
  captcha.verifyRecaptcha.mockResolvedValue(true); portal.detectPortalFromSubdomain.mockReturnValue('Patient'); db.findUserByEmail.mockResolvedValue({ id: 7 });
});

test('forgot password enforces IP lock, required fields, institutional email and captcha', async () => {
  redis.isResetPwLocked.mockResolvedValueOnce(true); let res = response(); await forget(req(), res);
  expect(res.status).toHaveBeenCalledWith(429); expect(res.set).toHaveBeenCalledWith('Retry-After', 3);
  for (const body of [{}, { email: 'a@example.com' }, { recaptchaToken: 'token' }]) {
    res = response(); await forget(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  validator.isValidEmail.mockReturnValueOnce(false); res = response(); await forget(req({ email: 'bad', recaptchaToken: 'token' }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_INSTITUTION_EMAIL' }));
  captcha.verifyRecaptcha.mockResolvedValueOnce(false); res = response(); await forget(req({ email: 'a@example.com', recaptchaToken: 'token' }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_RECAPTCHA' }));
  expect(redis.recordResetPwFailure).toHaveBeenCalledTimes(5); expect(security.delayRandom).toHaveBeenCalledWith(200, 500);
});

test('forgot password applies portal rate limits, preserves non-enumeration and queues known accounts', async () => {
  const body = { email: 'a@example.com', recaptchaToken: 'token' };
  redis.rateLimitEmailCooldown.mockResolvedValueOnce(true); redis.rateLimitEmailCooldownTTL.mockResolvedValueOnce(19);
  let res = response(); await forget(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_COOLDOWN_ACTIVE', retryAfterSeconds: 19 }));
  expect(redis.rateLimitEmailCooldown).toHaveBeenCalledWith(body.email, 'patient', 'resetpw', 30);
  redis.rateLimitEmailAttempts.mockResolvedValueOnce(true);
  res = response(); await forget(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_ATTEMPT_LIMIT_REACHED' }));
  db.findUserByEmail.mockResolvedValueOnce(null);
  res = response(); await forget(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  expect(emailService.enqueueResetPassword).not.toHaveBeenCalled();
  portal.detectPortalFromSubdomain.mockReturnValueOnce('Medical');
  res = response(); await forget(req(body), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(redis.rateLimitEmailAttempts).toHaveBeenCalledWith(body.email, 'medical', 'resetpw', 4, 700);
  expect(emailService.enqueueResetPassword).toHaveBeenCalledWith(body.email, 'medical');
  expect(redis.clearResetPwFailures).toHaveBeenCalledWith('127.0.0.1');
});

test('forgot password maps dependency failures without revealing account state', async () => {
  db.findUserByEmail.mockRejectedValueOnce(Error('database down'));
  const res = response(); await forget(req({ email: 'a@example.com', recaptchaToken: 'token' }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'SERVER_ERROR' }));
  expect(logger.error).toHaveBeenCalledWith('Password change request error:', expect.any(Error));
});

test('verification-key check handles empty, malformed and valid sessions plus Redis failure', async () => {
  for (const session of [null, {}]) {
    redis.getVerificationSession.mockResolvedValueOnce(session); const res = response(); await check(req(), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_OR_EXPIRED_KEY' }));
  }
  let res = response(); await check(req(), res); expect(res.json).toHaveBeenCalledWith({ ok: true });
  expect(redis.getVerificationSession).toHaveBeenCalledWith('key', 'resetpassword');
  redis.getVerificationSession.mockRejectedValueOnce(Error('redis down'));
  res = response(); await check(req(), res); expect(res.status).toHaveBeenCalledWith(500);
});

test('password reset validates fields, password policy, lockout and session', async () => {
  for (const [body, key] of [[{}, 'key'], [{ newPassword: 'newpassword' }, null], [{ newPassword: null }, 'key']]) {
    const res = response(); await reset(req(body, key), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_FIELDS' }));
  }
  validator.validatePassword.mockReturnValueOnce(false); let res = response(); await reset(req({ newPassword: 'weak' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PASSWORD' }));
  redis.isResetPwLocked.mockResolvedValueOnce(true); res = response(); await reset(req({ newPassword: 'newpassword' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'LOCKED_OUT' }));
  for (const session of [null, {}]) {
    redis.getVerificationSession.mockResolvedValueOnce(session); res = response(); await reset(req({ newPassword: 'newpassword' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_OR_EXPIRED_KEY' }));
  }
  expect(redis.recordResetPwFailure).toHaveBeenCalledTimes(2);
  expect(db.updateUserPasswordById).not.toHaveBeenCalled();
});

test('valid reset changes password and clears session and IP failures', async () => {
  const res = response(); await reset(req({ newPassword: 'newpassword' }), res);
  expect(db.updateUserPasswordById).toHaveBeenCalledWith(7, 'newpassword');
  expect(redis.deleteVerificationSession).toHaveBeenCalledWith('key', 'resetpassword');
  expect(redis.clearResetPwFailures).toHaveBeenCalledWith('127.0.0.1');
  expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Password has been reset successfully.' });
  db.updateUserPasswordById.mockRejectedValueOnce(Error('database down')); const failed = response();
  await reset(req({ newPassword: 'newpassword' }), failed); expect(failed.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'SERVER_ERROR' }));
});
