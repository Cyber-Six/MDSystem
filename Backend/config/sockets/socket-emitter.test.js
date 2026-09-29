jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./socket-store', () => ({ isConnectedAnywhere: jest.fn() }));
jest.mock('./notification-store', () => ({ pushPending: jest.fn(), getPushToken: jest.fn() }));
jest.mock('../../services/emailservice', () => ({ enqueueNotificationEmail: jest.fn() }));
jest.mock('./push-notification', () => ({ sendExpoPushNotification: jest.fn(), eventToPushContent: jest.fn() }));
jest.mock('./notification-preferences', () => ({ resolveChannelsForEvent: jest.fn() }));
jest.mock('../query', () => ({ findEmailByUserId: jest.fn() }));
jest.mock('./socket-server', () => ({ getIO: jest.fn() }));
const emitter = require('./socket-emitter');
const { getIO } = require('./socket-server');
const { isConnectedAnywhere } = require('./socket-store');
const { pushPending, getPushToken } = require('./notification-store');
const { enqueueNotificationEmail } = require('../../services/emailservice');
const push = require('./push-notification');
const { resolveChannelsForEvent } = require('./notification-preferences');
const { findEmailByUserId } = require('../query');
const { withEnvironment } = require('../../test-support/fixtures.cjs');
let io;
beforeEach(() => {
  jest.resetAllMocks();
  io = { emit: jest.fn(), emitWithAck: jest.fn() };
  io.to = jest.fn(() => io); io.timeout = jest.fn(() => io);
  getIO.mockReturnValue(io);
  resolveChannelsForEvent.mockResolvedValue({ web: true, email: false, emailFallback: true });
  isConnectedAnywhere.mockResolvedValue(true);
  findEmailByUserId.mockResolvedValue('user@test.invalid');
});
test('targets users, rooms, roles, and broadcasts', () => {
  expect(emitter.emitToUser(12, 'event', 'data')).toBe(true);
  expect(io.to).toHaveBeenCalledWith('user:12');
  expect(emitter.emitToUsers([13, 14], 'event', 'data')).toBe(true);
  expect(io.to).toHaveBeenCalledWith('user:13');
  expect(io.to).toHaveBeenCalledWith('user:14');
  expect(emitter.emitToRoom('room', 'event', 'data')).toBe(true);
  expect(io.to).toHaveBeenCalledWith('room');
  expect(emitter.emitToRole('medical', 'event', 'data')).toBe(true);
  expect(io.to).toHaveBeenCalledWith('role:medical');
  expect(emitter.emitToAll('event', 'data')).toBe(true);
  expect(io.emit).toHaveBeenCalledTimes(6);
  expect(io.emit).toHaveBeenCalledWith('event', 'data');
});
test('returns false if socket IO is unavailable', async () => {
  getIO.mockReturnValue(null);
  expect(emitter.emitToUser(12, 'event', {})).toBe(false);
  expect(emitter.emitToUsers([12], 'event', {})).toBe(false);
  expect(emitter.emitToRoom('room', 'event', {})).toBe(false);
  expect(emitter.emitToAll('event', {})).toBe(false);
  await expect(emitter.emitToUserWithAck(12, 'event', {})).resolves.toBe(false);
});
test.each([[[], false], [[{}], true]])('reports acknowledgements %j', async (responses, expected) => {
  io.emitWithAck.mockResolvedValue(responses);
  await expect(emitter.emitToUserWithAck(12, 'event', {}, 25)).resolves.toBe(expected);
  expect(io.timeout).toHaveBeenCalledWith(25);
});
test.each([[undefined, false], [[], false], [[{}], true]])('handles partial timeout acknowledgements %j', async (responses, expected) => {
  io.emitWithAck.mockRejectedValue(Object.assign(new Error('timeout'), { responses }));
  await expect(emitter.emitToUserWithAck(12, 'event', {}, 25)).resolves.toBe(expected);
});
test.each([undefined, '100'])('uses the configured or default acknowledgement timeout %s', async setting => {
  const restore = withEnvironment({ SOCKET_ACK_TIMEOUT_MS: setting });
  try {
    io.emitWithAck.mockResolvedValue([]);
    await emitter.emitToUserWithAck(12, 'event', {});
    expect(io.timeout).toHaveBeenCalledWith(setting ? 100 : 5000);
  } finally { restore(); }
});
test('suppresses all channels without dispatching', async () => {
  resolveChannelsForEvent.mockResolvedValue({ web: false, email: false, emailFallback: false });
  await expect(emitter.notifyUser(12, 'event', {})).resolves.toBe('suppressed');
  expect(isConnectedAnywhere).not.toHaveBeenCalled();
});
test('delivers to online users without fallback email', async () => {
  await expect(emitter.notifyUser(12, 'event', {})).resolves.toBe('delivered');
  expect(io.emit).toHaveBeenCalledWith('event', {});
  expect(pushPending).not.toHaveBeenCalled();
  expect(enqueueNotificationEmail).not.toHaveBeenCalled();
});
test.each([null, { title: 'Push', body: 'Body' }, { title: 'Push', body: 'Body', data: { id: 1 }, channelId: 'chat' }])('queues offline notifications and sends available push content %j', async content => {
  isConnectedAnywhere.mockResolvedValue(false);
  push.eventToPushContent.mockReturnValue(content);
  getPushToken.mockResolvedValue('push-token');
  await expect(emitter.notifyUser(12, 'event', {})).resolves.toBe('queued');
  expect(pushPending).toHaveBeenCalledWith(12, 'event', {});
  if (content) expect(push.sendExpoPushNotification).toHaveBeenCalledWith('push-token', content.title, content.body, content.data || {}, '12', content.channelId);
  else expect(push.sendExpoPushNotification).not.toHaveBeenCalled();
  expect(enqueueNotificationEmail).toHaveBeenCalledWith('user@test.invalid', 'Event', 'You have a new notification: event', null, null, null);
});
test('does not send push without a registered token and tolerates preference failure', async () => {
  resolveChannelsForEvent.mockRejectedValue(new Error('preferences unavailable'));
  isConnectedAnywhere.mockResolvedValue(false);
  push.eventToPushContent.mockReturnValue({ title: 'Push', body: 'Body' });
  await emitter.notifyUser(12, 'event', {});
  expect(push.sendExpoPushNotification).not.toHaveBeenCalled();
  expect(pushPending).toHaveBeenCalled();
});
test('supports email-only delivery, supplied email content, and subject sanitization', async () => {
  resolveChannelsForEvent.mockResolvedValue({ web: false, email: true, emailFallback: false });
  await expect(emitter.notifyUser(12, 'event', {}, { email: 'custom@test.invalid', title: ' Title\r\nInjected ', message: ' Body ', notes: 'note', ctaText: 'Open', ctaLink: '/open' })).resolves.toBe('queued');
  expect(enqueueNotificationEmail).toHaveBeenCalledWith('custom@test.invalid', 'Title Injected', 'Body', 'note', 'Open', '/open');
  expect(io.emit).not.toHaveBeenCalled();
  expect(findEmailByUserId).not.toHaveBeenCalled();
});
test('forces email online but gives skipEmail precedence', async () => {
  await emitter.notifyUser(12, 'event', { message: ' Message ' }, null, { forceEmail: true });
  expect(enqueueNotificationEmail).toHaveBeenCalledWith('user@test.invalid', 'Event', 'Message', null, null, null);
  enqueueNotificationEmail.mockClear();
  await emitter.notifyUser(12, 'event', {}, null, { forceEmail: true, skipEmail: true });
  expect(enqueueNotificationEmail).not.toHaveBeenCalled();
});
test.each([
  ['{"title":" Title ","body":" Body "}', 'Title', 'Body'],
  ['{"body":"Body"}', 'Staff Notification', 'Body'],
  ['{"title":"Title"}', 'Title', '{"title":"Title"}'],
  ['{}', 'Staff Notification', '{}'],
  ['{invalid}', 'Staff Notification', '{invalid}'],
  ['plain text', 'Staff Notification', 'plain text'],
  [12, 'Staff Notification', 'You have a new notification: staff:notification'],
])('resolves broadcast email content %j', async (message, title, body) => {
  await emitter.notifyUser(12, 'staff:notification', { message }, null, { forceEmail: true });
  expect(enqueueNotificationEmail).toHaveBeenCalledWith('user@test.invalid', title, body, null, null, null);
});
test.each([undefined, '---'])('provides fallback titles for empty event labels %j', async event => {
  await emitter.notifyUser(12, event, undefined, { title: ' ', message: ' ' }, { forceEmail: true });
  expect(enqueueNotificationEmail.mock.calls[0][1]).toBe('Notification');
});
test('handles missing recipient email and queue errors without losing socket delivery', async () => {
  findEmailByUserId.mockResolvedValue(null);
  await expect(emitter.notifyUser(12, 'event', {}, null, { forceEmail: true })).resolves.toBe('delivered');
  expect(enqueueNotificationEmail).not.toHaveBeenCalled();
  findEmailByUserId.mockRejectedValue(new Error('DB unavailable'));
  await expect(emitter.notifyUser(12, 'event', {}, null, { forceEmail: true })).resolves.toBe('delivered');
});
test('groups multi-user delivery results by outcome', async () => {
  resolveChannelsForEvent.mockImplementation(async id => id === 3 ? { web: false, email: false, emailFallback: false } : { web: true, email: false, emailFallback: false });
  isConnectedAnywhere.mockImplementation(async id => id === 1);
  await expect(emitter.notifyUsers([1, 2, 3], 'event', {})).resolves.toEqual({ delivered: [1], queued: [2], suppressed: [3] });
});
