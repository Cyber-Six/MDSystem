import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { createSocketDouble } from '../../../../../tests/support/socket-service-double';
import { useHealthChat } from '../context/health-chat-context';
import { useHealthChatSocket } from './use-health-chat-socket';

jest.mock('@mdsystem/core/services/socket-service', () => ({ createSocketService: jest.fn() }));
jest.mock('../../../packages-core-adapter', () => ({ apiBaseUrlProvider: {}, tokenService: {} }));
jest.mock('../context/health-chat-context', () => ({ useHealthChat: jest.fn() }));
jest.mock('../../notification/notification-context', () => ({ useStaffNotifications: () => ({ subscribe: mockSubscribe }) }));
const mockSubscribe = jest.fn(() => jest.fn());
let root, result, context;
function Probe() { result = useHealthChatSocket(); return null; }
const render = async () => { await act(async () => { root.render(React.createElement(Probe)); }); };
beforeEach(() => {
  jest.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
  context = {
    activeTicketId: 'first', selectedChatId: 'patient', selectedTicket: { status: 'Ongoing' },
    tickets: [], setSocketError: jest.fn(), setUserTyping: jest.fn(),
  };
  useHealthChat.mockImplementation(() => context);
});
afterEach(async () => { await act(async () => { root.unmount(); }); });

test('restores the branch and current chat once after reconnect, without restoring stale rooms', async () => {
  const socket = createSocketDouble();
  createSocketService.mockReturnValue(socket.service);
  await render();
  expect(socket.joins()).toEqual(['first']);
  await act(async () => { socket.fire('disconnect'); });
  context = { ...context, activeTicketId: 'second' };
  await render();
  await act(async () => { socket.fire('connect'); });
  expect(socket.joins()).toEqual(['first', 'second']);
  expect(socket.service.emit.mock.calls.filter(([event]) => event === 'notification:join-branch')).toHaveLength(2);
  expect(result.isConnected).toBe(true);
  expect(socket.handlers.get('connect').size).toBe(1);
  expect(socket.handlers.get('healthchat:new-message').size).toBe(1);

  await act(async () => { socket.fire('disconnect'); });
  context = { ...context, selectedTicket: { status: 'Closed' } };
  await render();
  await act(async () => { socket.fire('connect'); });
  expect(socket.joins()).toEqual(['first', 'second']);
});

test('cancels pending connection setup on unmount', async () => {
  const socket = createSocketDouble(true);
  createSocketService.mockReturnValue(socket.service);
  await render();
  await act(async () => { root.unmount(); socket.finish(); });
  root = createRoot(document.createElement('div'));
  expect(socket.joins()).toEqual([]);
  expect(socket.handlers.size).toBe(0);
});
