jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
const { withEnvironment } = require('../test-support/fixtures.cjs');
let restore, verify, client, OAuth2Client;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ GOOGLE_OAUTH_CLIENT_ID: 'test-client' });
  ({ OAuth2Client } = require('google-auth-library'));
  client = { verifyIdToken: jest.fn() };
  OAuth2Client.mockReturnValue(client);
  verify = require('./google-oauth').verifyGoogleToken;
});
afterEach(() => restore());
test.each([null, '', 12])('rejects invalid token %j', async token => {
  await expect(verify(token)).resolves.toBeNull();
  expect(OAuth2Client).not.toHaveBeenCalled();
});
test('rejects missing OAuth configuration', async () => {
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  jest.resetModules();
  await expect(require('./google-oauth').verifyGoogleToken('token')).resolves.toBeNull();
});
test.each([
  { email_verified: false },
  { email_verified: true, hd: 'other.invalid' },
  { email_verified: true, hd: 'tip.edu.ph', email: 'user@other.invalid' },
])('rejects invalid identity claims %j', async payload => {
  client.verifyIdToken.mockResolvedValue({ getPayload: () => payload });
  await expect(verify('token')).resolves.toBeNull();
});
test.each([false, true])('returns verified institutional identity (profile fields=%s)', async full => {
  const payload = { email_verified: true, hd: 'tip.edu.ph', email: 'USER@tip.edu.ph', sub: 'google-id', ...(full ? { name: 'User', picture: 'https://test.invalid/photo' } : {}) };
  client.verifyIdToken.mockResolvedValue({ getPayload: () => payload });
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  await expect(verify('token')).resolves.toEqual({ email: 'user@tip.edu.ph', googleId: 'google-id', name: payload.name || '', picture: payload.picture || '' });
  await verify('another-token');
  expect(OAuth2Client).toHaveBeenCalledTimes(1);
  expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: 'token', audience: 'test-client' });
});
test('handles provider rejection', async () => {
  client.verifyIdToken.mockRejectedValue(new Error('invalid signature'));
  await expect(verify('token')).resolves.toBeNull();
});
