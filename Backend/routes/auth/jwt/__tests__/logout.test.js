const express = require('express');
const request = require('supertest');

const mockGetRefreshSession = jest.fn();
const mockSaveRefreshSession = jest.fn();

jest.mock('../../../../config/middleware/ratelimiter.js', () => ({
  portalBasedIpRateLimiter: () => (_req, _res, next) => next(),
}));

jest.mock('../../../../config/redis.js', () => ({
  getRefreshSession: (...args) => mockGetRefreshSession(...args),
  saveRefreshSession: (...args) => mockSaveRefreshSession(...args),
}));

jest.mock('../../../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

const router = require('../logout.js');

describe('POST /auth/logout', () => {
  let app;

  beforeEach(() => {
    mockGetRefreshSession.mockReset();
    mockSaveRefreshSession.mockReset();

    app = express();
    app.use(express.json());
    app.use('/auth/logout', router);
  });

  test('returns 400 when refresh token is missing', async () => {
    const response = await request(app)
      .post('/auth/logout')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('MISSING_OR_INVALID_REFRESH_TOKEN');
    expect(mockGetRefreshSession).not.toHaveBeenCalled();
    expect(mockSaveRefreshSession).not.toHaveBeenCalled();
  });

  test('returns 400 when refresh token format is invalid', async () => {
    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: 'invalid-format' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('MISSING_OR_INVALID_REFRESH_TOKEN');
    expect(mockGetRefreshSession).not.toHaveBeenCalled();
    expect(mockSaveRefreshSession).not.toHaveBeenCalled();
  });

  test('returns idempotent success when session is not found', async () => {
    mockGetRefreshSession.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-a' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, revoked: false });
    expect(mockGetRefreshSession).toHaveBeenCalledWith(101, 'device-1');
    expect(mockSaveRefreshSession).not.toHaveBeenCalled();
  });

  test('returns idempotent success when provided token does not match active/previous token', async () => {
    mockGetRefreshSession.mockResolvedValueOnce({
      status: 'active',
      refreshToken: 'token-current',
      prevToken: 'token-prev',
    });

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-other' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, revoked: false });
    expect(mockSaveRefreshSession).not.toHaveBeenCalled();
  });

  test('returns idempotent success when session is already revoked', async () => {
    mockGetRefreshSession.mockResolvedValueOnce({
      status: 'revoked',
      refreshToken: 'token-current',
      prevToken: null,
    });

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-current' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, revoked: true });
    expect(mockSaveRefreshSession).toHaveBeenCalledTimes(1);
  });

  test('revokes active session when provided token matches current refresh token', async () => {
    mockGetRefreshSession.mockResolvedValueOnce({
      userId: 101,
      deviceId: 'device-1',
      status: 'active',
      refreshToken: 'token-current',
      prevToken: 'token-prev',
      suspiciousCount: 2,
    });

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-current' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, revoked: true });
    expect(mockSaveRefreshSession).toHaveBeenCalledTimes(1);

    const [savedUserId, savedDeviceId, savedSession, ttl] = mockSaveRefreshSession.mock.calls[0];
    expect(savedUserId).toBe(101);
    expect(savedDeviceId).toBe('device-1');
    expect(savedSession.status).toBe('revoked');
    expect(savedSession.refreshToken).toBe('');
    expect(savedSession.prevToken).toBeNull();
    expect(savedSession.cooldownUntil).toBeNull();
    expect(savedSession.suspiciousCount).toBe(0);
    expect(savedSession.updatedAt).toEqual(expect.any(Number));
    expect(ttl).toEqual(expect.any(Number));
  });

  test('revokes active session when provided token matches previous token', async () => {
    mockGetRefreshSession.mockResolvedValueOnce({
      userId: 101,
      deviceId: 'device-1',
      status: 'active',
      refreshToken: 'token-current',
      prevToken: 'token-prev',
    });

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-prev' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, revoked: true });
    expect(mockSaveRefreshSession).toHaveBeenCalledTimes(1);
  });

  test('returns 500 when revocation throws unexpectedly', async () => {
    mockGetRefreshSession.mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: '101:device-1:token-current' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('LOGOUT_FAILED');
    expect(mockSaveRefreshSession).not.toHaveBeenCalled();
  });
});
