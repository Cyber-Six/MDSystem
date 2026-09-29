const routes = { get: [], put: [], patch: [], delete: [] };
jest.mock('express', () => ({ Router: () => Object.fromEntries(Object.keys(routes).map(method => [method, (...args) => routes[method].push(args)])) }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => 'auth') }));
jest.mock('../../config/query.js', () => ({ query: jest.fn(), getUserPreferences: jest.fn(), setUserPreferences: jest.fn() }));
jest.mock('../../config/redis.js', () => ({ getKey: jest.fn(), setKey: jest.fn(), delKey: jest.fn() }));
jest.mock('../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../config/sockets/notification-preferences.js', () => ({ invalidateNotifPrefCache: jest.fn() }));
const query = require('../../config/query.js'); const redis = require('../../config/redis.js');
const logger = require('../../utils/logger.js'); const socketPrefs = require('../../config/sockets/notification-preferences.js');
require('./settings.js');
const handler = method => routes[method][0].at(-1);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
beforeEach(() => jest.clearAllMocks());

test('GET delegates browser navigation and serves cached, default, and database preferences', async () => {
  const next = jest.fn(); routes.get[0][1]({ headers: { accept: 'text/html' } }, response(), next); expect(next).toHaveBeenCalledWith('router');
  const missingAcceptNext = jest.fn(); routes.get[0][1]({ headers: {} }, response(), missingAcceptNext); expect(missingAcceptNext).toHaveBeenCalledWith();
  const apiNext = jest.fn(); routes.get[0][1]({ headers: { accept: 'application/json' } }, response(), apiNext); expect(apiNext).toHaveBeenCalledWith();
  const authenticatedNext = jest.fn(); routes.get[0][1]({ headers: { authorization: 'Bearer token', accept: 'text/html' } }, response(), authenticatedNext); expect(authenticatedNext).toHaveBeenCalledWith();
  redis.getKey.mockResolvedValueOnce(JSON.stringify({ appearance: { theme: 'dark' } })); let res = response(); await handler('get')({ user: { id: 1 } }, res);
  expect(res.json).toHaveBeenCalledWith({ ok: true, preferences: { appearance: { theme: 'dark' } } });
  redis.getKey.mockResolvedValueOnce(null); query.getUserPreferences.mockResolvedValueOnce(null); query.setUserPreferences.mockRejectedValueOnce(Error('initialization denied')); redis.setKey.mockRejectedValueOnce(Error('cache down')); res = response();
  await handler('get')({ user: { id: 2 } }, res); expect(query.setUserPreferences).toHaveBeenCalledWith(2, { appearance: {}, notification: {} }); expect(res.status).toHaveBeenCalledWith(200);
  redis.getKey.mockResolvedValueOnce(null); query.getUserPreferences.mockResolvedValueOnce({ notification: { email: true } }); res = response(); await handler('get')({ user: { id: 3 } }, res);
  expect(redis.setKey).toHaveBeenCalledWith('prefs:3', JSON.stringify({ notification: { email: true } }), expect.any(Number));
  redis.getKey.mockRejectedValueOnce(Error('bad cache')); query.getUserPreferences.mockRejectedValueOnce(Error('db down')); res = response(); await handler('get')({ user: { id: 4 } }, res); expect(res.status).toHaveBeenCalledWith(500);
});

test('PUT validates empty and oversized patches, persists valid data, and maps failures', async () => {
  let res = response(); await handler('put')({ user: { id: 1 }, body: {} }, res); expect(res.status).toHaveBeenCalledWith(400);
  res = response(); await handler('put')({ user: { id: 1 }, body: { appearance: { blob: 'x'.repeat(110000) } } }, res); expect(res.status).toHaveBeenCalledWith(413);
  query.setUserPreferences.mockResolvedValueOnce({ appearance: { theme: 'light' } }); redis.delKey.mockResolvedValue(); socketPrefs.invalidateNotifPrefCache.mockResolvedValue(); res = response();
  await handler('put')({ user: { id: 2 }, body: { appearance: { theme: 'light' } } }, res);
  expect(query.setUserPreferences).toHaveBeenCalledWith(2, { appearance: { theme: 'light' } }); expect(redis.delKey).toHaveBeenCalledWith('prefs:2'); expect(res.status).toHaveBeenCalledWith(200);
  query.setUserPreferences.mockRejectedValueOnce(Error('offline')); res = response(); await handler('put')({ user: { id: 3 }, body: { notification: {} } }, res); expect(res.status).toHaveBeenCalledWith(500);
});

test('PATCH merges existing preference state and rejects invalid shapes, empty updates, oversized data, and failures', async () => {
  let res = response(); await handler('patch')({ user: { id: 1 }, body: {} }, res); expect(res.status).toHaveBeenCalledWith(400);
  redis.getKey.mockResolvedValueOnce('invalid-json'); query.getUserPreferences.mockResolvedValueOnce({ appearance: {}, notification: {} }); query.setUserPreferences.mockResolvedValueOnce({ appearance: {}, notification: {} }); res = response(); await handler('patch')({ user: { id: 1 }, body: { appearance: {} } }, res); expect(res.status).toHaveBeenCalledWith(200);
  redis.getKey.mockResolvedValueOnce(JSON.stringify({ appearance: {}, notification: {} })); query.setUserPreferences.mockResolvedValueOnce({ appearance: { theme: 'dark' }, notification: {} }); res = response();
  await handler('patch')({ user: { id: 2 }, body: { appearance: { theme: 'dark' } } }, res); expect(res.status).toHaveBeenCalledWith(200);
  redis.getKey.mockResolvedValueOnce(null); query.getUserPreferences.mockResolvedValueOnce({ appearance: {}, notification: {} }); res = response(); await handler('patch')({ user: { id: 3 }, body: { appearance: { huge: 'x'.repeat(110000) } } }, res); expect(res.status).toHaveBeenCalledWith(413);
  redis.getKey.mockResolvedValueOnce(null); query.getUserPreferences.mockResolvedValueOnce({ appearance: {}, notification: {} }); query.setUserPreferences.mockRejectedValueOnce(Error('write')); res = response(); await handler('patch')({ user: { id: 4 }, body: { notification: { x: 1 } } }, res); expect(res.status).toHaveBeenCalledWith(500);
  redis.getKey.mockRejectedValueOnce(Error('cache down')); query.getUserPreferences.mockResolvedValueOnce(null); query.setUserPreferences.mockResolvedValueOnce({ appearance: { x: 1 }, notification: {} }); redis.delKey.mockRejectedValueOnce(Error('cache down')); socketPrefs.invalidateNotifPrefCache.mockResolvedValueOnce(); res = response();
  await handler('patch')({ user: { id: 5 }, body: { appearance: { x: 1 } } }, res); expect(res.status).toHaveBeenCalledWith(200);
});

test('DELETE resets preferences and reports persistence failure', async () => {
  query.setUserPreferences.mockResolvedValueOnce(); let res = response(); await handler('delete')({ user: { id: 1 } }, res);
  expect(query.setUserPreferences).toHaveBeenCalledWith(1, { appearance: {}, notification: {} }); expect(res.status).toHaveBeenCalledWith(200);
  query.setUserPreferences.mockRejectedValueOnce(Error('db')); res = response(); await handler('delete')({ user: { id: 2 } }, res); expect(res.status).toHaveBeenCalledWith(500); expect(logger.error).toHaveBeenCalled();
});

test('startup tolerates and logs preference-table initialization failure', async () => {
  const startupLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  jest.resetModules();
  jest.doMock('../../config/query.js', () => ({ query: jest.fn().mockRejectedValue(Error('schema unavailable')) }));
  jest.doMock('../../utils/logger.js', () => startupLogger);
  jest.isolateModules(() => require('./settings.js'));
  await new Promise(resolve => setImmediate(resolve));
  expect(startupLogger.error).toHaveBeenCalledWith('[PREFS] Failed to ensure UsersPreferences table:', 'schema unavailable');
});
