import { io } from 'socket.io-client';
import { createSocketService } from './socket-service';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

const setup = (onAuthError = jest.fn(async () => {})) => {
  const listeners = new Map();
  const socket = {
    connected: false,
    on: jest.fn((event, callback) => { listeners.set(event, callback); }),
    removeAllListeners: jest.fn(() => listeners.clear()),
    disconnect: jest.fn(), connect: jest.fn(),
    off: jest.fn(), emit: jest.fn(),
  };
  io.mockReturnValue(socket);
  const service = createSocketService({ getApiBaseUrl: () => '', getToken: () => 'jwt', onAuthError });
  return { service, socket, onAuthError, fire: (event, value) => listeners.get(event)?.(value) };
};

beforeEach(() => jest.clearAllMocks());

test('explicitly reconnects after middleware auth rejection and bounds failed recovery', async () => {
  const { service, socket, onAuthError, fire } = setup();
  const pending = service.connect();
  const assertion = expect(pending).rejects.toThrow('SOCKET_AUTH_FAILED');
  await fire('connect_error', new Error('SOCKET_AUTH_FAILED: expired'));
  expect(onAuthError).toHaveBeenCalledTimes(1);
  expect(socket.connect).toHaveBeenCalledTimes(2);
  await fire('connect_error', new Error('SOCKET_AUTH_FAILED: invalid'));
  await assertion;
  expect(onAuthError).toHaveBeenCalledTimes(1);
  expect(socket.disconnect).toHaveBeenCalled();
});

test('resolves shared connect callers after successful auth recovery', async () => {
  const { service, fire } = setup();
  const first = service.connect();
  expect(service.connect()).toBe(first);
  await fire('connect_error', new Error('SOCKET_AUTH_FAILED'));
  fire('connect');
  await expect(first).resolves.toBeUndefined();
});

test('disconnect settles pending callers and never reconnects after a late refresh', async () => {
  let finishRefresh;
  const { service, socket, fire } = setup(() => new Promise((resolve) => { finishRefresh = resolve; }));
  const pending = service.connect();
  const assertion = expect(pending).rejects.toThrow('cancelled');
  const recovery = fire('connect_error', new Error('SOCKET_AUTH_FAILED'));
  service.disconnect();
  finishRefresh();
  await recovery;
  await assertion;
  expect(socket.connect).toHaveBeenCalledTimes(1);
});

test('can connect again after synchronous setup failure', async () => {
  const { service, fire } = setup();
  io.mockImplementationOnce(() => { throw new Error('Invalid URL'); });
  await expect(service.connect()).rejects.toThrow('Invalid URL');
  const pending = service.connect();
  fire('connect');
  await expect(pending).resolves.toBeUndefined();
});

test('keeps automatic reconnection enabled after a transport error', async () => {
  const { service, socket, fire } = setup();
  const pending = service.connect();
  const assertion = expect(pending).rejects.toThrow('Transport unavailable');
  await fire('connect_error', new Error('Transport unavailable'));
  await assertion;
  expect(socket.disconnect).not.toHaveBeenCalled();
});

test.each([
  ['synchronous throw', () => { throw new Error('Storage locked'); }],
  ['async rejection', async () => { throw new Error('Storage locked'); }],
  ['missing token', async () => null],
])('socket auth settles with an empty token on %s', async (_label, getToken) => {
  const { fire } = setup();
  const service = createSocketService({ getApiBaseUrl: () => '', getToken });
  const pending = service.connect();
  const options = io.mock.calls[io.mock.calls.length - 1][1];
  const auth = new Promise((resolve) => options.auth(resolve));
  await expect(auth).resolves.toEqual({ token: '' });
  fire('connect');
  await pending;
  service.disconnect();
});

test('socket auth reads the current token for each handshake', async () => {
  const { fire } = setup();
  let token = 'old-token';
  const service = createSocketService({ getApiBaseUrl: () => '', getToken: async () => token });
  const pending = service.connect();
  const options = io.mock.calls[io.mock.calls.length - 1][1];
  await expect(new Promise((resolve) => options.auth(resolve))).resolves.toEqual({ token: 'old-token' });
  token = 'new-token';
  await expect(new Promise((resolve) => options.auth(resolve))).resolves.toEqual({ token: 'new-token' });
  fire('connect');
  await pending;
  service.disconnect();
});

test('duplicate auth errors during recovery cause only one refresh', async () => {
  let finish;
  const { service, socket, onAuthError, fire } = setup(jest.fn(() => new Promise((resolve) => { finish = resolve; })));
  const pending = service.connect();
  const recovery = fire('connect_error', new Error('SOCKET_AUTH_FAILED'));
  await fire('connect_error', new Error('SOCKET_AUTH_FAILED'));
  expect(onAuthError).toHaveBeenCalledTimes(1);
  finish();
  await recovery;
  fire('connect');
  await pending;
  expect(socket.connect).toHaveBeenCalledTimes(2);
  service.disconnect();
});

test('failed auth recovery rejects shared callers and stops the rejected transport', async () => {
  const { service, socket, fire } = setup(jest.fn(async () => { throw new Error('Session revoked'); }));
  const pending = service.connect();
  expect(service.connect()).toBe(pending);
  const assertion = expect(pending).rejects.toThrow('Session revoked');
  await fire('connect_error', new Error('SOCKET_AUTH_FAILED'));
  await assertion;
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  service.disconnect();
});

test('replacing a failed transport removes old subscriptions before creating another socket', async () => {
  const { service, socket, fire } = setup();
  const first = service.connect();
  const assertion = expect(first).rejects.toThrow('Offline');
  await fire('connect_error', new Error('Offline'));
  await assertion;
  const next = service.connect();
  expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  fire('connect');
  await next;
  socket.connected = true;
  await service.connect();
  expect(io).toHaveBeenCalledTimes(2);
  service.disconnect();
});

test('disconnected services reject emits and cleanly handle repeated teardown', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { service } = setup();
  expect(service.emit('join-room', { chatId: 'private-room' })).toBe(false);
  service.on('message', jest.fn());
  expect(() => service.off('message')).not.toThrow();
  service.disconnect();
  service.disconnect();
  expect(service.isConnected()).toBe(false);
  expect(service.getSocket()).toBeNull();
  warn.mockRestore();
});

test('forwards subscriptions and acknowledgements only on a connected transport', async () => {
  const { service, socket, fire } = setup();
  const pending = service.connect();
  socket.connected = true;
  fire('connect');
  await pending;
  const handler = jest.fn();
  const ack = jest.fn();
  service.on('message', handler);
  service.off('message', handler);
  service.off('message');
  expect(socket.off.mock.calls).toEqual([['message', handler], ['message']]);
  expect(service.emit('join-room', { chatId: 'room' }, ack)).toBe(true);
  expect(service.emit('leave-room', { chatId: 'room' })).toBe(true);
  expect(socket.emit.mock.calls).toEqual([
    ['join-room', { chatId: 'room' }, ack], ['leave-room', { chatId: 'room' }],
  ]);
  expect(service.isConnected()).toBe(true);
  service.disconnect();
});

test.each([
  ['', undefined, '/socket.io'],
  ['/api/v1/', undefined, '/api/v1/socket.io'],
  [' https://www.mdsystemtip.space/ ', 'https://www.mdsystemtip.space', '/socket.io'],
  ['https://staff.mdsystemtip.space/api/v1/', 'https://staff.mdsystemtip.space', '/api/v1/socket.io'],
  ['http://192.168.1.5:3000/api/', 'http://192.168.1.5:3000', '/api/socket.io'],
])('uses API base %p as an origin and transport path, not a namespace', async (base, origin, path) => {
  const { fire } = setup();
  const service = createSocketService({ getApiBaseUrl: () => base, getToken: async () => 'jwt' });
  const pending = service.connect();
  expect(io).toHaveBeenLastCalledWith(origin, expect.objectContaining({ path }));
  fire('connect');
  await pending;
  service.disconnect();
});

test('preserves an explicitly configured Socket.IO transport path', async () => {
  const { fire } = setup();
  const service = createSocketService({
    getApiBaseUrl: () => 'https://www.mdsystemtip.space/api',
    getToken: async () => 'jwt', options: { path: '/custom/socket.io' },
  });
  const pending = service.connect();
  expect(io).toHaveBeenLastCalledWith('https://www.mdsystemtip.space', expect.objectContaining({ path: '/custom/socket.io' }));
  fire('connect');
  await pending;
  service.disconnect();
});
