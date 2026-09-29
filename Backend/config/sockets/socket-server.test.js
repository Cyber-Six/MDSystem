jest.mock('socket.io', () => ({ Server: jest.fn() }));
jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: jest.fn(() => 'adapter') }));
jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./socket-auth', () => ({ createAuthMiddleware: jest.fn(() => 'auth') }));
jest.mock('./socket-store', () => ({ trackConnection: jest.fn(), untrackConnection: jest.fn() }));
jest.mock('./socket-events', () => ({ bindHandlersToSocket: jest.fn() }));
jest.mock('./notification-store', () => ({ flushPending: jest.fn() }));
jest.mock('../redis', () => ({ getClient: jest.fn() }));
const { socketMock, withEnvironment } = require('../../test-support/fixtures.cjs');
let restore;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({ SOCKET_CORS_ORIGIN: undefined, SOCKET_CORS_METHODS: undefined, SOCKET_PATH: undefined, NODE_ENV: 'test' });
});
afterEach(() => restore());
test.each([false, true])('initializes socket lifecycle and offline delivery (production=%s)', async production => {
  const { Server } = require('socket.io');
  const redis = require('../redis');
  const store = require('./socket-store');
  const { flushPending } = require('./notification-store');
  const server = require('./socket-server');
  const io = socketMock(); io.use = jest.fn(); io.adapter = jest.fn();
  Server.mockReturnValue(io);
  const pub = { connect: jest.fn() }, sub = { connect: jest.fn() };
  redis.getClient.mockReturnValue({ duplicate: jest.fn().mockReturnValueOnce(pub).mockReturnValueOnce(sub) });
  flushPending.mockResolvedValue(production ? [] : [{ event: 'queued', data: { id: 2 } }]);
  if (production) {
    Object.assign(process.env, { NODE_ENV: 'production', SOCKET_CORS_ORIGIN: 'https://test.invalid', SOCKET_CORS_METHODS: 'GET,POST', SOCKET_PATH: '/ws' });
    pub.connect.mockRejectedValue(new Error('adapter unavailable'));
  }
  expect(server.getIO()).toBeNull();
  await expect(server.initSocket('http-server')).resolves.toBe(io);
  expect(Server).toHaveBeenCalledWith('http-server', expect.objectContaining({ serveClient: !production, path: production ? '/ws' : '/socket.io', cors: expect.objectContaining({ origin: production ? 'https://test.invalid' : '*' }) }));
  expect(io.use).toHaveBeenCalledWith('auth');
  await expect(server.initSocket('another-server')).resolves.toBe(io);
  expect(Server).toHaveBeenCalledTimes(1);
  expect(server.getIO()).toBe(io);
  const socket = socketMock();
  await io.handlers.connection(socket);
  expect(store.trackConnection).toHaveBeenCalledWith('12', 'socket-test');
  expect(socket.join.mock.calls).toEqual([['user:12'], ['role:patient']]);
  expect(socket.emit).toHaveBeenCalledWith('socket:connected', { socketId: 'socket-test' });
  if (!production) expect(socket.emit).toHaveBeenCalledWith('queued', { id: 2 });
  await socket.handlers.disconnect('closed');
  expect(store.untrackConnection).toHaveBeenCalledWith('12', 'socket-test');
  socket.handlers.error(new Error('socket error'));
  expect(require('../../utils/logger').error).toHaveBeenCalled();
});
