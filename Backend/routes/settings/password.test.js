const mockRouter = { post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => 'auth') }));
jest.mock('../../config/middleware/ratelimiter.js', () => ({ ipRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../config/query.js', () => ({ query: jest.fn(), findUserByEmail: jest.fn(), findEmailByUserId: jest.fn(), updateUserPasswordById: jest.fn() }));
jest.mock('../../utils/security.js', () => ({ verifyPassword: jest.fn() }));
jest.mock('../../utils/totp.js', () => ({ totpVerify: jest.fn(), decryptTotpSecret: jest.fn() }));
jest.mock('../../config/redis.js', () => ({ verifyOTP: jest.fn(), getOTPFailureCount: jest.fn(), getOTPLockoutTTL: jest.fn(), rateLimitEmailCooldown: jest.fn(), rateLimitEmailAttempts: jest.fn(), deleteEmailCooldown: jest.fn(), deleteEmailAttempts: jest.fn() }));
jest.mock('../../utils/portal.js', () => ({ detectPortalFromSubdomain: jest.fn() }));
jest.mock('../../services/email/emailservice.js', () => ({ enqueueSettingsOTP: jest.fn() }));
jest.mock('../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../config/data/matrix.js', () => ({ rateLimitMatrix: { PatientAuthentication: { emailCooldown_2fa: 30, emailAttemptMax_2fa: 3, penaltyCooldown_resetpw: 600 }, staffAuthentication: {} } }));

const db = require('../../config/query.js'); const security = require('../../utils/security.js'); const totp = require('../../utils/totp.js');
const redis = require('../../config/redis.js'); const portal = require('../../utils/portal.js'); const email = require('../../services/email/emailservice.js');
require('./password.js');
const [sendOtp, changePatient, changeStaff] = mockRouter.post.mock.calls.map(args => args.at(-1));
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const req = body => ({ user: { id: 7 }, body });
const valid = { currentPassword: 'oldpassword', newPassword: 'newpassword' };
const credential = (enabled = false) => ({ rows: [{ password_hash: 'hash', totp_enabled: enabled, totp_secret: 'encrypted' }] });
beforeEach(() => {
  jest.clearAllMocks(); portal.detectPortalFromSubdomain.mockReturnValue('Patient'); db.findEmailByUserId.mockResolvedValue('a@example.com');
  db.query.mockResolvedValue(credential()); security.verifyPassword.mockResolvedValue(true);
  redis.rateLimitEmailCooldown.mockResolvedValue(false); redis.rateLimitEmailAttempts.mockResolvedValue(false); redis.verifyOTP.mockResolvedValue(true);
  totp.decryptTotpSecret.mockReturnValue('secret'); totp.totpVerify.mockReturnValue(true);
});

test('OTP delivery checks account, cooldown, attempt limits and patient profile', async () => {
  db.findEmailByUserId.mockResolvedValueOnce(null); let res = response(); await sendOtp(req({}), res); expect(res.status).toHaveBeenCalledWith(404);
  redis.rateLimitEmailCooldown.mockResolvedValueOnce(true); res = response(); await sendOtp(req({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_COOLDOWN_ACTIVE' }));
  redis.rateLimitEmailAttempts.mockResolvedValueOnce(true); res = response(); await sendOtp(req({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_ATTEMPT_LIMIT_REACHED' }));
  res = response(); await sendOtp(req({}), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(redis.rateLimitEmailCooldown).toHaveBeenCalledWith('a@example.com', 'patient', 'settingsAction', 30);
  expect(redis.rateLimitEmailAttempts).toHaveBeenCalledWith('a@example.com', 'patient', 'settingsAction', 3, 600);
  expect(email.enqueueSettingsOTP).toHaveBeenCalledWith('a@example.com', 'patient');
});

test('staff OTP settings use defaults and mail failures return a server error', async () => {
  portal.detectPortalFromSubdomain.mockReturnValue('Medical');
  let res = response(); await sendOtp(req({}), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(redis.rateLimitEmailCooldown).toHaveBeenCalledWith('a@example.com', 'medical', 'settingsAction', 60);
  expect(redis.rateLimitEmailAttempts).toHaveBeenCalledWith('a@example.com', 'medical', 'settingsAction', 5, 900);
  email.enqueueSettingsOTP.mockRejectedValueOnce(Error('queue down'));
  res = response(); await sendOtp(req({}), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OTP_SEND_FAILED' }));
});

test.each([['patient', changePatient], ['staff', changeStaff]])('%s password change validates required fields, length and difference', async (_name, handler) => {
  for (const [body, error] of [[{}, 'MISSING_FIELDS'], [{ currentPassword: 'old', newPassword: 'short' }, 'PASSWORD_TOO_SHORT'], [{ currentPassword: 'samepassword', newPassword: 'samepassword' }, 'SAME_PASSWORD']]) {
    const res = response(); await handler(req(body), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
  }
  expect(db.query).not.toHaveBeenCalled();
});

test.each([['patient', changePatient], ['staff', changeStaff]])('%s password change verifies account and current password', async (_name, handler) => {
  db.query.mockResolvedValueOnce({ rows: [] }); let res = response(); await handler(req(valid), res); expect(res.status).toHaveBeenCalledWith(404);
  security.verifyPassword.mockResolvedValueOnce(false); res = response(); await handler(req(valid), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CURRENT_PASSWORD' }));
  expect(db.updateUserPasswordById).not.toHaveBeenCalled();
});

test('patient TOTP path validates syntax, enrollment and code before password update', async () => {
  for (const [token, enabled, error] of [['abc', true, 'TOTP_REQUIRED'], ['123456', false, 'TOTP_NOT_ENABLED']]) {
    db.query.mockResolvedValueOnce(credential(enabled)); const res = response(); await changePatient(req({ ...valid, totpToken: token }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
  }
  db.query.mockResolvedValueOnce(credential(true)); totp.totpVerify.mockReturnValueOnce(false);
  let res = response(); await changePatient(req({ ...valid, totpToken: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOTP_CODE' }));
  db.query.mockResolvedValueOnce(credential(true)); res = response(); await changePatient(req({ ...valid, totpToken: '123456', emailOtp: 'ignored' }), res);
  expect(res.status).toHaveBeenCalledWith(200); expect(totp.decryptTotpSecret).toHaveBeenCalledWith('encrypted');
  expect(totp.totpVerify).toHaveBeenCalledWith('123456', 'secret'); expect(redis.verifyOTP).not.toHaveBeenCalled();
  expect(db.updateUserPasswordById).toHaveBeenCalledWith(7, 'newpassword');
});

test('patient email OTP handles missing email, lockout, bad code and successful cleanup', async () => {
  db.findEmailByUserId.mockResolvedValueOnce(null); let res = response(); await changePatient(req({ ...valid, emailOtp: '123456' }), res); expect(res.status).toHaveBeenCalledWith(404);
  redis.verifyOTP.mockResolvedValueOnce('LOCKED_OUT'); redis.getOTPLockoutTTL.mockResolvedValueOnce(29);
  res = response(); await changePatient(req({ ...valid, emailOtp: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OTP_LOCKED_OUT', retryAfterSeconds: 29 }));
  redis.verifyOTP.mockResolvedValueOnce(false); redis.getOTPFailureCount.mockResolvedValueOnce(2);
  res = response(); await changePatient(req({ ...valid, emailOtp: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_OTP', attempts: 2 }));
  res = response(); await changePatient(req({ ...valid, emailOtp: '123456' }), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(redis.verifyOTP).toHaveBeenCalledWith('a@example.com', 'settingsAction', '123456', 'patient');
  expect(redis.deleteEmailCooldown).toHaveBeenCalledWith('a@example.com', 'patient', 'settingsAction');
  expect(redis.deleteEmailAttempts).toHaveBeenCalledWith('a@example.com', 'patient', 'settingsAction');
});

test('patient password change requires a verification method even without TOTP', async () => {
  let res = response(); await changePatient(req(valid), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VERIFICATION_REQUIRED', message: 'An email OTP is required to change your password.' }));
  db.query.mockResolvedValueOnce(credential(true)); res = response(); await changePatient(req(valid), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An authenticator code or email OTP is required to change your password.' }));
});

test('staff TOTP path enforces code when enrolled, allows no TOTP when disabled', async () => {
  db.query.mockResolvedValueOnce(credential(true)); let res = response(); await changeStaff(req(valid), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOTP_REQUIRED' }));
  db.query.mockResolvedValueOnce(credential(true)); res = response(); await changeStaff(req({ ...valid, totpToken: 'bad' }), res); expect(res.status).toHaveBeenCalledWith(400);
  db.query.mockResolvedValueOnce(credential(true)); totp.totpVerify.mockReturnValueOnce(false);
  res = response(); await changeStaff(req({ ...valid, totpToken: '123456' }), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOTP_CODE' }));
  db.query.mockResolvedValueOnce(credential(true)); res = response(); await changeStaff(req({ ...valid, totpToken: '123456' }), res); expect(res.status).toHaveBeenCalledWith(200);
  res = response(); await changeStaff(req(valid), res); expect(res.status).toHaveBeenCalledWith(200);
  expect(db.updateUserPasswordById).toHaveBeenCalledTimes(2);
});

test.each([['patient', changePatient, { ...valid, emailOtp: '123456' }], ['staff', changeStaff, valid]])('%s password persistence failures return the common server error', async (_name, handler, body) => {
  db.updateUserPasswordById.mockRejectedValueOnce(Error('database unavailable'));
  const res = response(); await handler(req(body), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CHANGE_PASSWORD_FAILED' }));
});
