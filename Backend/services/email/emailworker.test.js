jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('bullmq', () => ({ Worker: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('./emailservice', () => ({ buildEmailTemplate: jest.fn(() => ({ to: 'user@test.invalid', subject: 'Title', htmlContent: '<p>body</p>' })) }));
jest.mock('../../config/redis', () => ({ initRedis: jest.fn(), setOTP: jest.fn(), createVerificationSession: jest.fn(() => 'reset-token') }));
jest.mock('../../config/config', () => ({ redis: { host: 'redis.test' }, smtp: { host: 'smtp.test', port: 465, secure: true, auth: { user: 'test', pass: 'fixture' } } }));
jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('../../utils/portal', () => ({ detectPortalFromSubdomain: jest.fn() }));
const { withEnvironment } = require('../../test-support/fixtures.cjs');
let restore, transport, worker, processor, redis, hooks, smtpCallback;
beforeEach(async () => {
  jest.resetModules(); jest.useFakeTimers();
  restore = withEnvironment({ EMAIL_DELAY: undefined, SMTP_USER: 'test-sender' });
  transport = { verify: jest.fn(callback => { smtpCallback = callback; }), sendMail: jest.fn().mockResolvedValue({ messageId: 'mail-id' }) };
  worker = { on: jest.fn(), close: jest.fn() };
  require('nodemailer').createTransport.mockReturnValue(transport);
  require('bullmq').Worker.mockImplementation((_queue, callback) => { processor = callback; return worker; });
  redis = require('../../config/redis');
  hooks = {};
  jest.spyOn(process, 'on').mockImplementation((signal, callback) => { hooks[signal] = callback; return process; });
  jest.spyOn(process, 'exit').mockImplementation(() => {});
  require('./emailworker');
  await Promise.resolve();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); restore(); });
async function run(job) {
  const result = processor(job);
  await jest.runAllTimersAsync();
  return result;
}
test('initializes SMTP and Redis, monitors jobs, and closes on termination', async () => {
  expect(redis.initRedis).toHaveBeenCalled();
  expect(require('nodemailer').createTransport).toHaveBeenCalledWith({ host: 'smtp.test', port: 465, secure: true, auth: { user: 'test', pass: 'fixture' } });
  smtpCallback(); smtpCallback(new Error('smtp unavailable'));
  for (const [event, callback] of worker.on.mock.calls) {
    expect(['active', 'completed', 'failed', 'stalled']).toContain(event);
    callback({ id: 'job', name: 'sendEmail', data: {} }, event === 'failed' ? new Error('failed') : { sent: true });
  }
  await hooks.SIGINT(); await hooks.SIGTERM();
  expect(worker.close).toHaveBeenCalledTimes(2);
  expect(process.exit).toHaveBeenCalledWith(0);
});
test.each([['sendEmailVerification', 'emailVerification'], ['sendEmail2FA', 'email2FA'], ['sendSettingsOTP', 'settingsAction']])('sends %s before storing the OTP', async (name, purpose) => {
  await expect(run({ name, data: { userEmail: 'user@test.invalid', data: { otp: '123456' }, portal: 'patient' } })).resolves.toEqual({ status: 'sent', id: 'mail-id' });
  expect(redis.setOTP).toHaveBeenCalledWith('user@test.invalid', '123456', purpose, 'patient');
  expect(transport.sendMail.mock.invocationCallOrder[0]).toBeLessThan(redis.setOTP.mock.invocationCallOrder[0]);
  expect(global).not.toHaveProperty('codeMap');
});
test.each(['patient', 'medical'])('creates a reset link for portal %s just before sending', async portal => {
  process.env.EMAIL_DELAY = '5';
  await run({ name: 'sendPasswordResetLink', data: { userEmail: 'user@test.invalid', data: {}, portal } });
  expect(redis.createVerificationSession).toHaveBeenCalledWith('user@test.invalid', 'resetpassword', portal);
  expect(require('./emailservice').buildEmailTemplate).toHaveBeenCalledWith('sendPasswordResetLink', 'user@test.invalid', { resetpwlink: 'reset-token', portal: portal === 'patient' ? 'www' : 'staff' });
  expect(redis.setOTP).not.toHaveBeenCalled();
});
test.each(['sendNotificationEmail', 'sendAdminTransferEmail', 'sendEmail'])('sends %s without creating OTP state', async name => {
  await run({ name, data: { userEmail: 'user@test.invalid', data: {}, to: 'direct@test.invalid', subject: 'Direct', htmlContent: '<p>direct</p>' } });
  expect(transport.sendMail).toHaveBeenCalledWith({ from: { name: 'MDSystem', address: 'test-sender' }, to: name === 'sendEmail' ? 'direct@test.invalid' : 'user@test.invalid', subject: name === 'sendEmail' ? 'Direct' : 'Title', html: name === 'sendEmail' ? '<p>direct</p>' : '<p>body</p>' });
  expect(redis.setOTP).not.toHaveBeenCalled();
});
test('tolerates an OTP storage failure after mail was sent', async () => {
  redis.setOTP.mockRejectedValue(new Error('redis down'));
  await expect(run({ name: 'sendEmail2FA', data: { userEmail: 'user', data: { otp: '1' } } })).resolves.toEqual({ status: 'sent', id: 'mail-id' });
});
test('rejects failed sends without persisting an OTP', async () => {
  transport.sendMail.mockRejectedValue(new Error('SMTP down'));
  const result = processor({ name: 'sendEmail2FA', data: { userEmail: 'user', data: { otp: '1' } } });
  const assertion = expect(result).rejects.toThrow('SMTP down');
  await jest.runAllTimersAsync(); await assertion;
  expect(redis.setOTP).not.toHaveBeenCalled();
});
test('rejects unsupported jobs', async () => {
  const result = processor({ name: 'unknown', data: {} });
  const assertion = expect(result).rejects.toThrow();
  await jest.runAllTimersAsync(); await assertion;
  expect(transport.sendMail).not.toHaveBeenCalled();
});
