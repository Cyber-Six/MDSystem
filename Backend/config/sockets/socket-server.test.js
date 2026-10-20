jest.mock('socket.io', () => ({ Server: jest.fn() }));
jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: jest.fn(() => 'adapter') }));
jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./socket-auth', () => ({ createAuthMiddleware: jest.fn(() => 'auth'), authorizeSocket: jest.fn(), protectSocketSession: jest.fn() }));
jest.mock('./socket-store', () => ({ trackConnection: jest.fn(), untrackConnection: jest.fn() }));
jest.mock('./socket-events', () => ({ bindHandlersToSocket: jest.fn() }));
jest.mock('./notification-store', () => ({ flushPending: jest.fn() }));
jest.mock('../redis', () => ({ getClient: jest.fn(), setSessionRevocationHandler: jest.fn() }));
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
  expect(Server).toHaveBeenCalledWith('http-server', expect.objectContaining({ serveClient: !production, path: production ? '/ws' : '/socket.io', cors: expect.objectContaining({ origin: production ? 'https://test.invalid' : true }) }));
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

test('disconnects revoked JWT rooms across the Socket.IO adapter and guards the handshake race', async () => {
  const { Server } = require('socket.io');
  const redis = require('../redis');
  const io = socketMock(); io.use = jest.fn(); io.adapter = jest.fn();
  const disconnectSockets = jest.fn(); io.in = jest.fn(() => ({ disconnectSockets }));
  Server.mockReturnValue(io);
  redis.getClient.mockReturnValue({ duplicate: () => ({ connect: jest.fn() }) });
  require('./notification-store').flushPending.mockResolvedValue([]);
  await require('./socket-server').initSocket('server');
  const revoke = redis.setSessionRevocationHandler.mock.calls[0][0];
  revoke(['older-jwt', 'newer-jwt']);
  expect(io.in).toHaveBeenCalledWith(['auth:jwt:older-jwt', 'auth:jwt:newer-jwt']);
  expect(disconnectSockets).toHaveBeenCalledWith(true);
  io.in.mockClear(); revoke([]);
  expect(io.in).not.toHaveBeenCalled();
  const socket = socketMock({ authTokenId: 'older-jwt', disconnect: jest.fn() });
  require('./socket-auth').authorizeSocket.mockRejectedValueOnce(Error('revoked during handshake'));
  await io.handlers.connection(socket);
  expect(socket.join).toHaveBeenCalledWith('auth:jwt:older-jwt');
  expect(socket.disconnect).toHaveBeenCalledWith(true);
  expect(require('./socket-store').trackConnection).not.toHaveBeenCalled();
});

test('anchor rotation disconnects the whole user room, including legacy sockets', async () => {
  const { Server } = require('socket.io');
  const redis = require('../redis');
  const io = socketMock(); io.use = jest.fn(); io.adapter = jest.fn();
  const disconnectSockets = jest.fn(); io.in = jest.fn(() => ({ disconnectSockets }));
  Server.mockReturnValue(io);
  redis.getClient.mockReturnValue({ duplicate: () => ({ connect: jest.fn() }) });
  await require('./socket-server').initSocket('server');
  redis.setSessionRevocationHandler.mock.calls[0][0]([], '12');
  expect(io.in).toHaveBeenCalledWith(['user:12']);
  expect(disconnectSockets).toHaveBeenCalledWith(true);
});
