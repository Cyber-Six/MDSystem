const mockRouter = { get: jest.fn(), post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));
jest.mock('../../../config/redis.js', () => ({ getVerificationSession: jest.fn(), updateConsentInSession: jest.fn() }));
const fs = require('fs'); const redis = require('../../../config/redis.js');
require('./consent'); const get = mockRouter.get.mock.calls[0][1]; const post = mockRouter.post.mock.calls[0][1];
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); });

test('validates purpose and verification key for read and write', async () => {
  for (const handler of [get, post]) {
    const missing = response(); await handler({ query: {}, body: {}, params: { purpose: 'login' } }, missing);
    expect(missing.status).toHaveBeenCalledWith(400);
    const invalid = response(); await handler({ query: { verificationKey: 'key' }, body: { verificationKey: 'key' }, params: { purpose: 'other' } }, invalid);
    expect(invalid.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PERFORM_ACTION' }));
  }
});

test.each([['login', '2fa'], ['register', 'verification']])('returns consent session state for %s', async (purpose, lookup) => {
  redis.getVerificationSession.mockResolvedValue({ email: 'user@tip.edu.ph', data_consent: 'true', data_consent_version: 'v1' });
  const res = response(); await get({ query: { verificationKey: 'session' }, params: { purpose } }, res);
  expect(redis.getVerificationSession).toHaveBeenCalledWith('session', lookup);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, email: 'user@tip.edu.ph', data_consent: true, consent_text: 'Default consent text here.' }));
});

test('rejects expired sessions and updates consent for both purposes', async () => {
  redis.getVerificationSession.mockResolvedValue(null); let res = response();
  await get({ query: { verificationKey: 'expired' }, params: { purpose: 'register' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  redis.updateConsentInSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
  res = response(); await post({ body: { verificationKey: 'bad' }, params: { purpose: 'login' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  res = response(); await post({ body: { verificationKey: 'ok' }, params: { purpose: 'register' } }, res);
  expect(redis.updateConsentInSession).toHaveBeenLastCalledWith('ok', 'verification');
  expect(res.status).toHaveBeenCalledWith(200);
  res = response(); await post({ body: { verificationKey: 'ok' }, params: { purpose: 'login' } }, res);
  expect(redis.updateConsentInSession).toHaveBeenLastCalledWith('ok', '2fa');
});

test('loads a configured consent document from disk when present', () => {
  const prior = process.env.DATA_CONSENT_VERSION; process.env.DATA_CONSENT_VERSION = 'v2';
  jest.resetModules();
  const freshFs = require('fs'); const freshRedis = require('../../../config/redis.js');
  freshFs.existsSync.mockReturnValue(true); freshFs.readFileSync.mockReturnValue('<p>Consent v2</p>');
  freshRedis.getVerificationSession.mockResolvedValue({ email: 'e', data_consent: 'false' });
  require('./consent');
  const res = response();
  return mockRouter.get.mock.calls.at(-1)[1]({ query: { verificationKey: 'key' }, params: { purpose: 'login' } }, res).then(() => {
    expect(freshFs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('v2.html'), 'utf8');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ consent_text: '<p>Consent v2</p>', required_version: 'v2' }));
    if (prior === undefined) delete process.env.DATA_CONSENT_VERSION; else process.env.DATA_CONSENT_VERSION = prior;
  });
});
