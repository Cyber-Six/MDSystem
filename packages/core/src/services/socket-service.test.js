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
