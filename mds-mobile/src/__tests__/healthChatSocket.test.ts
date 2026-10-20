import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { createSocketDouble } from '../../../tests/support/socket-service-double';
import { useHealthChatSocket } from '../hooks/useHealthChatSocket';

jest.mock('@mdsystem/core/services/socket-service', () => ({ createSocketService: jest.fn() }));
jest.mock('../core', () => ({ TokenStorage: {}, getApiBaseUrl: jest.fn(), refreshAccessToken: jest.fn() }));

const options = () => ({
  chatId: 'first', chatStatus: 'Ongoing', onNewMessage: jest.fn(), onTyping: jest.fn(),
  onTicketApproved: jest.fn(), onTicketClosed: jest.fn(),
});
let foreground: (state: AppStateStatus) => void;
let remove: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

test('rejoins once per connection with the latest chat and removes listeners on unmount', async () => {
  const socket = createSocketDouble();
  (createSocketService as jest.Mock).mockReturnValue(socket.service);
  const hook = renderHook((props: ReturnType<typeof options>) => useHealthChatSocket(props), { initialProps: options() });
  await act(async () => {});
  expect(socket.joins()).toEqual(['first']);
  await act(async () => { socket.fire('disconnect'); });
  expect(hook.result.current.isConnected).toBe(false);
  hook.rerender({ ...options(), chatId: 'second' });
  await act(async () => { socket.fire('connect'); });
  expect(hook.result.current.isConnected).toBe(true);
  expect(socket.joins()).toEqual(['first', 'second']);
  await act(async () => { socket.fire('disconnect'); socket.fire('connect'); });
  expect(socket.joins()).toEqual(['first', 'second', 'second']);
  expect(socket.handlers.get('connect').size).toBe(1);
  expect(socket.handlers.get('healthchat:new-message').size).toBe(1);
  hook.rerender({ ...options(), chatStatus: 'Closed' });
  expect(hook.result.current.isConnected).toBe(false);
  expect(socket.handlers.size).toBe(0);
  hook.unmount();
  expect(socket.handlers.size).toBe(0);
  expect(remove).toHaveBeenCalledTimes(1);
});

test('foreground events do not duplicate pending connections, and unmount cancels setup', async () => {
  const socket = createSocketDouble(true);
  (createSocketService as jest.Mock).mockReturnValue(socket.service);
  const hook = renderHook(() => useHealthChatSocket(options()));
  await act(async () => { foreground('active'); foreground('active'); });
  expect(createSocketService).toHaveBeenCalledTimes(1);
  hook.unmount();
  await act(async () => { socket.finish(); });
  expect(socket.service.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.joins()).toEqual([]);
  expect(socket.handlers.size).toBe(0);
});

test('returning to the foreground replaces a disconnected socket and joins only once', async () => {
  const first = createSocketDouble();
  const second = createSocketDouble();
  (createSocketService as jest.Mock).mockReturnValueOnce(first.service).mockReturnValueOnce(second.service);
  const hook = renderHook(() => useHealthChatSocket(options()));
  await act(async () => {});
  await act(async () => { first.fire('disconnect'); });
  await act(async () => { foreground('active'); });
  expect(createSocketService).toHaveBeenCalledTimes(2);
  expect(first.handlers.size).toBe(0);
  expect(second.joins()).toEqual(['first']);
  expect(hook.result.current.isConnected).toBe(true);
  hook.unmount();
});
