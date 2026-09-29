jest.mock('expo-server-sdk', () => ({ Expo: Object.assign(jest.fn(), { isExpoPushToken: jest.fn() }) }));
jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./notification-store', () => ({ deletePushToken: jest.fn() }));
const { Expo } = require('expo-server-sdk');
const api = { chunkPushNotifications: jest.fn(messages => [messages]), sendPushNotificationsAsync: jest.fn() };
Expo.mockReturnValue(api);
const { eventToPushContent: content, sendExpoPushNotification: send } = require('./push-notification');
const { deletePushToken } = require('./notification-store');
beforeEach(() => {
  jest.clearAllMocks();
  Expo.isExpoPushToken.mockReturnValue(true);
  api.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);
});
test.each([
  ['healthchat:future', 'health-chat', 'health-chat'], ['appointment:future', 'appointment', 'mds-notifications'],
  ['medicine:future', 'medicine', 'mds-notifications'], ['document:future', 'document', 'mds-notifications'],
  ['updateTicket:future', 'record', 'mds-notifications'], ['inventory:future', 'inventory', 'mds-notifications'],
  ['role:future', 'role-management', 'mds-notifications'], ['future:event', 'general', 'mds-notifications'],
])('routes generic %s notifications to %s', (event, type, channelId) => {
  const result = content(event, { message: ' Message ', id: 1, documentId: null, secret: 'excluded' });
  expect(result).toEqual({ title: expect.any(String), body: 'Message', channelId, data: { type, event, id: 1 } });
});
test('uses notes or a generated message and safely handles absent routing data', () => {
  expect(content('future:event', { notes: ' Notes ', chat: { id: 8 } })).toMatchObject({ body: 'Notes', data: { chatId: 8 } });
  expect(content('future:event', null)).toMatchObject({ body: 'You have a new Future Event notification.' });
  expect(content('future:event', 'text')).toMatchObject({ data: { type: 'general', event: 'future:event' } });
  expect(content('', {})).toMatchObject({ title: 'Notification' });
  expect(content('future:event', { chat: 'invalid' }).data).not.toHaveProperty('chatId');
  expect(content('future:event', { chat: {} }).data).not.toHaveProperty('chatId');
  expect(content('future:event', { chatId: 4, chat: { id: 8 } }).data.chatId).toBe(4);
});
test.each([
  [{ promptType: 'file' }, 'image'], [{ content_type: 'file' }, 'image'],
  [{ text: 'Message' }, 'Message'], [{ content: 'Content' }, 'Content'], [undefined, 'New message'],
])('formats chat message %j', (message, expected) => {
  const result = content('healthchat:new-message', { message, chatId: 4 });
  expect(result.body).toContain(expected);
  expect(result).toMatchObject({ channelId: 'health-chat', data: { chatId: 4, type: 'health-chat' } });
});
test.each(['healthchat:new-message', 'healthchat:ticket-approved', 'healthchat:ticket-closed', 'healthchat:ticket-rejected', 'healthchat:ticket-transferred', 'healthchat:ticket-taken-over', 'healthchat:session-extended'])('preserves chat navigation for %s with direct, nested, or absent IDs', event => {
  for (const data of [{ chatId: 4, expiresAt: 'later' }, { chat: { id: 4 } }, undefined]) {
    expect(content(event, data)).toMatchObject({ channelId: 'health-chat', data: { type: 'health-chat', event, chatId: data ? 4 : undefined } });
  }
});
test.each([
  [{ status: 'Approved', notes: 'Arrive early', slotId: 8 }, 'Appointment Approved', 'Your appointment has been confirmed. Note: Arrive early'],
  [{ status: 'Rejected' }, 'Appointment Rejected', 'Your appointment has been rejected.'],
  [undefined, 'Appointment Updated', 'Your appointment has been updated.'],
])('formats appointment response %j', (data, title, body) => {
  expect(content('appointment:responded', data)).toMatchObject({ title, body, data: { type: 'appointment', slotId: data?.slotId } });
});
test.each([
  ['appointment:attendance-recorded', 'Attendance Recorded', 'appointment', 'slotId'],
  ['medicine:request:approved', 'Medicine Request Approved', 'medicine', 'requestId'],
  ['medicine:request:rejected', 'Medicine Request Declined', 'medicine', 'requestId'],
  ['medicine:request:pending', 'Medicine Request Received', 'medicine', 'requestId'],
  ['medicine:request:cancelled', 'Medicine Request Cancelled', 'medicine', 'requestId'],
  ['medicine:prescription:issued', 'Prescription Ready', 'medicine', 'requestId'],
])('formats %s and retains its navigation identifier', (event, title, type, idKey) => {
  expect(content(event, { [idKey]: 8 })).toMatchObject({ title, data: { type, event, [idKey]: 8 } });
  expect(content(event, undefined)).toMatchObject({ title, data: { [idKey]: undefined } });
});
test.each([
  ['document:new', 'New Document Available'], ['document:approved', 'Document Approved'],
  ['document:rejected', 'Document Rejected'], ['document:cancelled', 'Document Request Cancelled'],
  ['document:requested', 'Document Requested'], ['document:archived', 'Document Archived'],
])('formats %s with custom or default body', (event, title) => {
  expect(content(event, { message: 'custom', documentId: 8, templateType: 'medical' })).toMatchObject({ title, body: 'custom', data: { type: 'document', documentId: 8 } });
  expect(content(event, undefined)).toMatchObject({ title, body: expect.stringMatching(/document/i) });
});
test('formats record update statuses and defaults', () => {
  expect(content('updateTicket:statusChanged', { newStatus: 'Approved', message: 'custom', recordId: 8 })).toMatchObject({ title: 'Record Update Approved', body: 'custom', data: { recordId: 8 } });
  expect(content('updateTicket:statusChanged')).toMatchObject({ title: 'Record Update Updated', body: 'Your record update request has been updated.' });
});
test.each(['staff:notification', 'admin:notification'])('parses broadcast %s and rejects empty messages', event => {
  expect(content(event, { message: '{"title":"Title","body":"Body"}' })).toMatchObject({ title: 'Title', body: 'Body' });
  expect(content(event, { message: '{"body":"Body"}' })).toMatchObject({ title: event.startsWith('staff') ? 'Message from Staff' : 'Message from Admin', body: 'Body' });
  expect(content(event, { message: 'plain' })).toMatchObject({ body: 'plain' });
  expect(content(event, { message: '{invalid' })).toMatchObject({ body: '{invalid' });
  expect(content(event, { message: '{}' })).toBeNull();
  expect(content(event, { message: 12 })).toBeNull();
  expect(content(event)).toBeNull();
});
test('rejects invalid push tokens without contacting Expo', async () => {
  Expo.isExpoPushToken.mockReturnValue(false);
  await send('invalid', 'Title', 'Body');
  expect(api.chunkPushNotifications).not.toHaveBeenCalled();
});
test('sends payloads in Expo chunks with channel defaults and overrides', async () => {
  await send('push-token', 'Title', 'Body');
  expect(api.chunkPushNotifications).toHaveBeenCalledWith([{ to: 'push-token', title: 'Title', body: 'Body', data: {}, channelId: 'mds-notifications', sound: 'default', priority: 'high' }]);
  await send('push-token', 'Title', 'Body', { id: 4 }, 12, 'health-chat');
  expect(api.chunkPushNotifications).toHaveBeenLastCalledWith([expect.objectContaining({ data: { id: 4 }, channelId: 'health-chat' })]);
});
test.each([null, 12])('removes unregistered device tokens when userId=%j', async userId => {
  api.sendPushNotificationsAsync.mockResolvedValue([
    { status: 'error', message: 'unknown' }, { status: 'error', details: { error: 'MessageTooBig' } },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
  ]);
  await send('push-token', 'Title', 'Body', {}, userId);
  if (userId) expect(deletePushToken).toHaveBeenCalledWith('12');
  else expect(deletePushToken).not.toHaveBeenCalled();
});
test('handles provider failure without rejecting the caller', async () => {
  api.sendPushNotificationsAsync.mockRejectedValue(new Error('offline'));
  await expect(send('push-token', 'Title', 'Body')).resolves.toBeUndefined();
});
