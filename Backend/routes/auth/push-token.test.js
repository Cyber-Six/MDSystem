jest.mock('express', () => ({ Router: () => ({ post: jest.fn(), delete: jest.fn() }) }));
jest.mock('expo-server-sdk', () => ({ Expo: { isExpoPushToken: jest.fn() } }));
jest.mock('../../config/middleware/jwtProtect', () => ({ jwtProtect: jest.fn(() => 'jwt') }));
jest.mock('../../config/middleware/ratelimiter', () => ({ portalBasedIpRateLimiter: jest.fn(() => 'limit') }));
jest.mock('../../config/sockets/notification-store', () => ({ savePushToken: jest.fn(), deletePushToken: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn() }));
const router = require('./push-token');
const { Expo } = require('expo-server-sdk');
const store = require('../../config/sockets/notification-store');
const handlers = { post: router.post.mock.calls[0][3], delete: router.delete.mock.calls[0][3] };

beforeEach(() => { jest.clearAllMocks(); Expo.isExpoPushToken.mockReturnValue(true); });

test('both endpoints mount patient authentication before rate limiting', () => {
  jest.resetModules();
  const registered = require('./push-token');
  for (const method of ['post', 'delete']) {
    expect(registered[method]).toHaveBeenCalledWith('/', 'jwt', 'limit', expect.any(Function));
  }
  expect(require('../../config/middleware/jwtProtect').jwtProtect).toHaveBeenCalledWith('patient');
});

describe('registered handlers', () => {
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
  test.each([[undefined, 'MISSING_TOKEN'], ['invalid', 'INVALID_TOKEN']])('rejects token %s', async (token, error) => {
    Expo.isExpoPushToken.mockReturnValue(false);
    const res = response();
    await handlers.post({ body: { token } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    expect(store.savePushToken).not.toHaveBeenCalled();
  });
  test.each(['post', 'delete'])('%s persists authenticated identity and responds successfully', async method => {
    const res = response();
    await handlers[method]({ user: { id: 42 }, body: { token: 'ExponentPushToken[value]' } }, res);
    if (method === 'post') expect(store.savePushToken).toHaveBeenCalledWith('42', 'ExponentPushToken[value]');
    else expect(store.deletePushToken).toHaveBeenCalledWith('42');
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
  test.each(['post', 'delete'])('%s propagates storage errors without a success response', async method => {
    const error = new Error('storage unavailable');
    const operation = method === 'post' ? store.savePushToken : store.deletePushToken;
    operation.mockRejectedValueOnce(error);
    const res = response();
    await expect(handlers[method]({ body: { token: 'token' } }, res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
