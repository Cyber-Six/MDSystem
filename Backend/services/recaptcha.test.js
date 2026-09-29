jest.mock('../utils/logger.js', () => ({ error: jest.fn(), warn: jest.fn() }));
jest.mock('node-fetch', () => jest.fn());
const logger = require('../utils/logger.js');
const fetch = require('node-fetch');

async function load(values = {}) {
  jest.resetModules();
  for (const key of ['RECAPTCHA_MOBILE_SECRET', 'RECAPTCHA_SECRET_KEY', 'RECAPTCHA_TEST_MODE']) delete process.env[key];
  Object.assign(process.env, values);
  return { module: require('./recaptcha'), logger: require('../utils/logger.js') };
}

afterEach(() => { for (const key of ['RECAPTCHA_MOBILE_SECRET', 'RECAPTCHA_SECRET_KEY', 'RECAPTCHA_TEST_MODE']) delete process.env[key]; });

test('accepts the configured mobile shared secret and rejects wrong or non-string tokens', async () => {
  const { module: { verifyRecaptcha } } = await load({ RECAPTCHA_MOBILE_SECRET: 'mobile-secret' });
  await expect(verifyRecaptcha('mobile-secret')).resolves.toBe(true);
  await expect(verifyRecaptcha('wrong')).resolves.toBe(false);
  await expect(verifyRecaptcha(null)).resolves.toBe(false);
});

test('returns false and logs when the server key is absent', async () => {
  const { module: { verifyRecaptcha }, logger: currentLogger } = await load();
  await expect(verifyRecaptcha('token')).resolves.toBe(false);
  expect(currentLogger.error).toHaveBeenCalledWith('Missing RECAPTCHA_SECRET_KEY in environment');
});

test('posts to Google and returns its success flag', async () => {
  const { module: { verifyRecaptcha } } = await load({ RECAPTCHA_SECRET_KEY: 'secret' });
  const currentFetch = require('node-fetch');
  currentFetch.mockResolvedValue({ json: async () => ({ success: true }) });
  await expect(verifyRecaptcha('token')).resolves.toBe(true);
  expect(currentFetch).toHaveBeenCalledWith('https://www.google.com/recaptcha/api/siteverify', expect.objectContaining({ method: 'POST' }));
});

test('test mode always succeeds without contacting Google', async () => {
  const { module: { verifyRecaptcha }, logger: currentLogger } = await load({ RECAPTCHA_TEST_MODE: 'true' });
  await expect(verifyRecaptcha('anything')).resolves.toBe(true);
  expect(currentLogger.warn).toHaveBeenCalled();
});

test('returns false when the verification request fails', async () => {
  const { module: { verifyRecaptcha } } = await load({ RECAPTCHA_SECRET_KEY: 'secret' });
  const currentFetch = require('node-fetch');
  currentFetch.mockRejectedValue(new Error('network unavailable'));
  await expect(verifyRecaptcha('token')).resolves.toBe(false);
  expect(require('../utils/logger.js').error).toHaveBeenCalledWith('reCAPTCHA verification error:', expect.any(Error));
});
