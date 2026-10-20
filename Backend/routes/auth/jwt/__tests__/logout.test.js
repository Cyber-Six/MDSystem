const express = require('express');
const request = require('supertest');
const mockRevokeRefreshSession = jest.fn();
jest.mock('../../../../config/middleware/ratelimiter', () => ({ portalBasedIpRateLimiter: () => (_req, _res, next) => next() }));
jest.mock('../../../../config/middleware/jwtProtect', () => ({ jwtProtect: () => (req, _res, next) => { req.user = { id: Number(req.headers['x-test-user-id'] || 101), role: 'patient' }; next(); } }));
jest.mock('../../../../config/redis', () => ({ revokeRefreshSession: (...args) => mockRevokeRefreshSession(...args) }));
jest.mock('../../../../utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));
const router = require('../logout');
let app;
beforeEach(() => {
  mockRevokeRefreshSession.mockReset().mockResolvedValue([]);
  app = express(); app.use(express.json()); app.use('/auth/logout', router);
});

test.each([undefined, null, {}, [], 'invalid-format', '101::token', '101:device:', '101:   :token', '101:device:   ', 'abc:device:token', '9007199254740992:device:token', '0:device:token'])('rejects malformed refresh credential %j without touching sessions', async refreshToken => {
  const response = await request(app).post('/auth/logout').send({ refreshToken });
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('MISSING_OR_INVALID_REFRESH_TOKEN');
  expect(mockRevokeRefreshSession).not.toHaveBeenCalled();
});

test.each(['token-current', 'token-previous'])('delegates credential matching and JWT revocation atomically for %s', async token => {
  const response = await request(app).post('/auth/logout').send({ refreshToken: `101:device-1:${token}` });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
  expect(mockRevokeRefreshSession).toHaveBeenCalledWith(101, 'device-1', token);
});

test('does not reveal whether the session is missing, already revoked, or the credential mismatches', async () => {
  const response = await request(app).post('/auth/logout').send({ refreshToken: '101:device:wrong-token' });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
});

test('cannot revoke another user by replacing the refresh token user ID', async () => {
  const response = await request(app).post('/auth/logout').set('x-test-user-id', '202').send({ refreshToken: '101:device:token' });
  expect(response.status).toBe(200);
  expect(mockRevokeRefreshSession).not.toHaveBeenCalled();
});

test('reports revocation failure without leaking internal Redis details', async () => {
  mockRevokeRefreshSession.mockRejectedValueOnce(new Error('private Redis details'));
  const response = await request(app).post('/auth/logout').send({ refreshToken: '101:device:token' });
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: 'LOGOUT_FAILED', message: 'Could not complete logout.' });
});
