jest.mock('bullmq', () => ({ Queue: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../utils/security', () => ({ generateOTP: jest.fn(() => '123456') }));
jest.mock('../config/redis', () => ({ redisConfig: { host: 'redis.test' } }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const { withEnvironment } = require('../test-support/fixtures.cjs');
let restore, service, queue;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ RESET_PASSWORD_DOMAIN_ROUTE: 'test.invalid/reset', EMAIL_VERIF_EXPIRATION: undefined, EMAIL_2FA_EXPIRATION: undefined, EMAIL_PASSWD_RESET_EXPIRATION: undefined, EMAIL_DELAY: undefined });
  queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getWaitingCount: jest.fn().mockResolvedValue(2) };
  require('bullmq').Queue.mockReturnValue(queue);
  service = require('./emailservice');
});
afterEach(() => restore());
test.each([undefined, '', 'null', 'undefined'])('rejects invalid reset domain %j at load time', domain => {
  if (domain === undefined) delete process.env.RESET_PASSWORD_DOMAIN_ROUTE;
  else process.env.RESET_PASSWORD_DOMAIN_ROUTE = domain;
  jest.resetModules();
  expect(() => require('./emailservice')).toThrow('Invalid or missing RESET_PASSWORD_DOMAIN_ROUTE');
});
test('queues generic mail with retry policy and queue position', async () => {
  await expect(service.enqueueEmail('user@test.invalid', 'Title', '<p>body</p>')).resolves.toEqual({ jobId: 'job-1', position: 2 });
  expect(queue.add).toHaveBeenCalledWith('sendEmail', { to: 'user@test.invalid', subject: 'Title', htmlContent: '<p>body</p>' }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: false });
});
test.each([
  ['enqueueEmail2FA', 'sendEmail2FA', 'EMAIL_2FA_EXPIRATION', 300],
  ['enqueueEmailVerification', 'sendEmailVerification', 'EMAIL_VERIF_EXPIRATION', 300],
  ['enqueueSettingsOTP', 'sendSettingsOTP', 'EMAIL_2FA_EXPIRATION', 300],
  ['enqueueResetPassword', 'sendPasswordResetLink', 'EMAIL_PASSWD_RESET_EXPIRATION', 900],
])('queues %s with portal and expiration settings', async (name, job, expiry, defaultExpiry) => {
  await expect(service[name]('user@test.invalid')).resolves.toEqual({ jobId: 'job-1', position: 2, expectedArrivalSeconds: 2, validitySeconds: defaultExpiry });
  expect(queue.add).toHaveBeenLastCalledWith(job, { userEmail: 'user@test.invalid', data: job === 'sendPasswordResetLink' ? {} : { otp: '123456' }, portal: 'patient' }, expect.objectContaining({ attempts: 5 }));
  process.env[expiry] = '120'; process.env.EMAIL_DELAY = '4';
  await expect(service[name]('staff@test.invalid', 'medical')).resolves.toEqual({ jobId: 'job-1', position: 2, expectedArrivalSeconds: 8, validitySeconds: 120 });
  expect(queue.add.mock.calls.at(-1)[1].portal).toBe('medical');
});
test('queues transfer and notification emails', async () => {
  await expect(service.enqueueAdminTransferEmail('old@test.invalid', 'token', 'new@test.invalid')).resolves.toMatchObject({ validitySeconds: 600, expectedArrivalSeconds: 2 });
  process.env.EMAIL_DELAY = '4';
  await expect(service.enqueueAdminTransferEmail('old@test.invalid', 'token', 'new@test.invalid')).resolves.toMatchObject({ expectedArrivalSeconds: 8 });
  expect(queue.add.mock.calls[0][1]).toEqual({ userEmail: 'old@test.invalid', data: { verificationToken: 'token', newAdminEmail: 'new@test.invalid' } });
  await service.enqueueNotificationEmail('user@test.invalid', 'Title', 'Body');
  expect(queue.add.mock.calls.at(-1)[1].data).toEqual({ title: 'Title', message: 'Body', notes: null, ctaText: null, ctaLink: null });
  await service.enqueueNotificationEmail('user@test.invalid', 'Title', 'Body', 'Notes', 'Open', 'https://test.invalid');
  expect(queue.add.mock.calls.at(-1)[1].data).toMatchObject({ notes: 'Notes', ctaText: 'Open', ctaLink: 'https://test.invalid' });
});
test.each([
  ['sendEmail2FA', 'Your MDSystem 2FA Code'], ['sendSettingsOTP', 'Your MDSystem 2FA Code'],
  ['sendEmailVerification', 'Verify Your MDSystem Email Address'], ['unknown', 'Your MDSystem OTP Verification'],
])('renders %s with its OTP', (job, subject) => {
  expect(service.buildEmailTemplate(job, 'user@test.invalid', { otp: '123456' })).toMatchObject({ to: 'user@test.invalid', subject, htmlContent: expect.stringContaining('123456') });
});
test('renders reset and admin-transfer actions', () => {
  const reset = service.buildEmailTemplate('sendPasswordResetLink', 'user@test.invalid', { resetpwlink: 'token', portal: 'www' });
  expect(reset.subject).toBe('Reset Your MDSystem Password');
  expect(reset.htmlContent).toContain('https://www.test.invalid/reset/token');
  const transfer = service.buildEmailTemplate('sendAdminTransferEmail', 'user@test.invalid', { verificationToken: 'token', newAdminEmail: 'new@test.invalid' });
  expect(transfer.subject).toBe('Admin Privilege Transfer Request');
  expect(transfer.htmlContent).toContain('new@test.invalid');
  expect(transfer.htmlContent).toContain('token');
});
test.each([undefined, '   ', ' Title\r\nInjected '])('normalizes notification subject %j', title => {
  const result = service.buildEmailTemplate('sendNotificationEmail', 'user@test.invalid', { title, message: 'hello' });
  expect(result.subject).toBe(title?.trim() ? 'Title Injected' : 'MDSystem Notification');
  expect(result.htmlContent).toContain('hello');
});
test('sanitizes notification HTML, renders paragraphs, and restricts action protocols', () => {
  const html = service.notificationTemplate({ title: '<script>alert(1)</script>', message: 'first\n\n second', notes: 'note', ctaText: 'Open', ctaLink: 'https://test.invalid' });
  expect(html).not.toContain('<script>');
  expect(html).toContain('first</p>');
  expect(html).toContain('second</p>');
  expect(html).toContain('href="https://test.invalid"');
  expect(html).toContain('note');
  expect(service.notificationTemplate({ ctaText: 'Open', ctaLink: 'javascript:alert(1)' })).not.toContain('<a href=');
  const empty = service.notificationTemplate({});
  expect(empty).toContain('You have a new notification.');
  expect(empty).toContain('MDSystem Notification');
});
test('uses configured template expiration minutes', () => {
  Object.assign(process.env, { EMAIL_VERIF_EXPIRATION: '120', EMAIL_2FA_EXPIRATION: '180', EMAIL_PASSWD_RESET_EXPIRATION: '240' });
  jest.resetModules(); require('bullmq').Queue.mockReturnValue(queue);
  const configured = require('./emailservice');
  expect(configured.buildEmailTemplate('sendEmailVerification', 'user', { otp: '1' }).htmlContent).toContain('2 minutes');
  expect(configured.buildEmailTemplate('sendEmail2FA', 'user', { otp: '1' }).htmlContent).toContain('3 minutes');
  expect(configured.buildEmailTemplate('sendPasswordResetLink', 'user', { resetpwlink: 'token', portal: 'www' }).htmlContent).toContain('4 minutes');
});
test('propagates queue failures', async () => {
  queue.add.mockRejectedValue(new Error('queue unavailable'));
  await expect(service.enqueueNotificationEmail('user', 'Title', 'Body')).rejects.toThrow('queue unavailable');
});
