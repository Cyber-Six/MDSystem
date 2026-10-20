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
