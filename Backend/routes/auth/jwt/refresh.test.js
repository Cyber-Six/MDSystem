jest.mock('express', () => ({ Router: () => ({ post: jest.fn() }) }));
jest.mock('../../../config/jwt.js', () => ({ handleRefresh: jest.fn() }));
jest.mock('../../../config/middleware/ratelimiter.js', () => ({ portalBasedIpRateLimiter: jest.fn(() => 'limiter') }));
jest.mock('../../../config/redis.js', () => ({ recordRefreshTokenFailure: jest.fn(), clearRefreshTokenFailures: jest.fn(), isRefreshTokenLocked: jest.fn() }));
jest.mock('../../../utils/logger.js', () => ({ error: jest.fn() }));
const router = require('./refresh');
const handler = router.post.mock.calls[0][2];
const jwt = require('../../../config/jwt.js');
const redis = require('../../../config/redis.js');
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); redis.isRefreshTokenLocked.mockResolvedValue(false); });
test('mounts rate limiter and rejects locked or malformed requests', async () => {
  redis.isRefreshTokenLocked.mockResolvedValueOnce(true);
  let response = res(); await handler({ ip: '1.1.1.1', body: {} }, response);
  expect(response.status).toHaveBeenCalledWith(429);
  for (const body of [{}, { refreshToken: 'bad' }, { refreshToken: '0::x' }]) {
    response = res(); await handler({ ip: '2.2.2.2', body }, response);
    expect(response.status).toHaveBeenCalledWith(400);
  }
});
test('rotates a valid refresh token and clears failures', async () => {
  jwt.handleRefresh.mockResolvedValue({ accessToken: 'access', refreshToken: 'rotated' });
  const response = res(); await handler({ ip: 'ip', body: { refreshToken: '12:phone:raw' } }, response);
  expect(jwt.handleRefresh).toHaveBeenCalledWith({ userId: 12, deviceId: 'phone', providedToken: 'raw' });
  expect(redis.clearRefreshTokenFailures).toHaveBeenCalledWith('ip');
  expect(response.json).toHaveBeenCalledWith({ ok: true, accessToken: 'access', refreshToken: '12:phone:rotated' });
});
test.each([
  ['Invalid session', 401, 'INVALID_SESSION'], ['Session revoked', 403, 'SESSION_REVOKED'],
  ['Session requires re-login', 401, 'RELOGIN_REQUIRED'], ['Session in cooldown', 429, 'SESSION_COOLDOWN'],
  ['Staff session invalidated', 403, 'STAFF_SESSION_INVALID'], ['Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN'],
  ['Expired refresh token', 401, 'EXPIRED_REFRESH_TOKEN'], ['other', 500, 'SERVER_ERROR'],
])('maps refresh failure %s', async (message, status, error) => {
  jwt.handleRefresh.mockRejectedValue(new Error(message)); const response = res();
  await handler({ ip: 'ip', body: { refreshToken: '1:device:raw' } }, response);
  expect(redis.recordRefreshTokenFailure).toHaveBeenCalledWith('ip');
  expect(response.status).toHaveBeenCalledWith(status); expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
});

test('uses fallback error text when a thrown error has no message', async () => {
  jwt.handleRefresh.mockRejectedValue({});
  const response = res();
  await handler({ ip: 'ip', body: { refreshToken: '1:device:raw' } }, response);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(response.json).toHaveBeenCalledWith({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
});
