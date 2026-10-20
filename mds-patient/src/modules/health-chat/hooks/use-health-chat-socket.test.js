import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { createSocketDouble } from '../../../../../tests/support/socket-service-double';
import { useHealthChatSocket } from './use-health-chat-socket';

jest.mock('@mdsystem/core/services/socket-service', () => ({ createSocketService: jest.fn() }));
jest.mock('../../../packages-core-adapter', () => ({ apiBaseUrlProvider: {}, tokenService: {} }));

let root, result;
let options;
function Probe() { result = useHealthChatSocket(options); return null; }
const render = async () => { await act(async () => { root.render(React.createElement(Probe)); }); };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
  options = { chatId: 'first', chatStatus: 'Ongoing', onNewMessage: jest.fn() };
  jest.clearAllMocks();
});
afterEach(async () => { await act(async () => { root.unmount(); }); });

test('joins once per connection and uses the latest active chat without duplicating listeners', async () => {
  const socket = createSocketDouble();
  createSocketService.mockReturnValue(socket.service);
  await render();
  expect(socket.joins()).toEqual(['first']);
  await act(async () => { socket.fire('disconnect'); });
  expect(result.isConnected).toBe(false);
  options = { ...options, chatId: 'second' };
  await render();
  await act(async () => { socket.fire('connect'); });
  expect(result.isConnected).toBe(true);
  expect(socket.joins()).toEqual(['first', 'second']);
  await act(async () => { socket.fire('disconnect'); socket.fire('connect'); });
  expect(socket.joins()).toEqual(['first', 'second', 'second']);
  expect(createSocketService).toHaveBeenCalledTimes(1);
  expect(socket.handlers.get('connect').size).toBe(1);
  expect(socket.handlers.get('healthchat:new-message').size).toBe(1);
  options = { ...options, chatStatus: 'Closed' };
  await render();
  expect(result.isConnected).toBe(false);
  expect(socket.handlers.size).toBe(0);
  await act(async () => { root.unmount(); });
  root = createRoot(document.createElement('div'));
  expect(socket.handlers.size).toBe(0);
});

test('cancels a pending connection on unmount and ignores a late resolution', async () => {
  const socket = createSocketDouble(true);
  createSocketService.mockReturnValue(socket.service);
  await render();
  await act(async () => { root.unmount(); socket.finish(); });
  root = createRoot(document.createElement('div'));
  expect(socket.service.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.joins()).toEqual([]);
  expect(socket.handlers.size).toBe(0);
});
