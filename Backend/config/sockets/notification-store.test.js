jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('../redis', () => ({ getClient: jest.fn(), lRangeDelKey: jest.fn(), lLenKey: jest.fn() }));
const redis = require('../redis');
const store = require('./notification-store');
const { withEnvironment } = require('../../test-support/fixtures.cjs');
let client, restore;
beforeEach(() => {
  jest.resetAllMocks();
  restore = withEnvironment({ NOTIF_PENDING_TTL: undefined, NOTIF_MAX_PENDING: undefined });
  client = { set: jest.fn(), get: jest.fn(), del: jest.fn(), exec: jest.fn() };
  for (const method of ['multi', 'rPush', 'expire', 'lTrim']) client[method] = jest.fn(() => client);
  redis.getClient.mockReturnValue(client);
});
afterEach(() => restore());
test.each([false, true])('queues an expiring bounded notification list (configured=%s)', async configured => {
  if (configured) { process.env.NOTIF_PENDING_TTL = '60'; process.env.NOTIF_MAX_PENDING = '3'; }
  await store.pushPending(12, 'event', { value: 4 });
  expect(client.rPush).toHaveBeenCalledWith('notif:pending:12', expect.any(String));
  expect(JSON.parse(client.rPush.mock.calls[0][1])).toEqual({ id: expect.any(String), event: 'event', data: { value: 4 }, ts: expect.any(Number) });
  expect(client.expire).toHaveBeenCalledWith('notif:pending:12', configured ? 60 : 604800);
  expect(client.lTrim).toHaveBeenCalledWith('notif:pending:12', configured ? -3 : -100, -1);
  expect(client.exec).toHaveBeenCalledTimes(1);
});
test('handles a queue write failure', async () => {
  client.exec.mockRejectedValue(new Error('offline'));
  await expect(store.pushPending(12, 'event', {})).resolves.toBeUndefined();
});
test.each([[null, []], [[], []], [['invalid'], []], [['invalid', '{"id":"n1"}'], [{ id: 'n1' }]]])('flushes and filters pending data %j', async (raw, expected) => {
  redis.lRangeDelKey.mockResolvedValue(raw);
  await expect(store.flushPending(12)).resolves.toEqual(expected);
  expect(redis.lRangeDelKey).toHaveBeenCalledWith('notif:pending:12');
});
test('defaults to an empty queue when Redis fails', async () => {
  redis.lRangeDelKey.mockRejectedValue(new Error('offline'));
  await expect(store.flushPending(12)).resolves.toEqual([]);
});
test('reads a badge count and defaults to zero on failure', async () => {
  redis.lLenKey.mockResolvedValueOnce(3).mockRejectedValueOnce(new Error('offline'));
  await expect(store.getPendingCount(12)).resolves.toBe(3);
  await expect(store.getPendingCount(12)).resolves.toBe(0);
});
test('saves, retrieves, and deletes push tokens with a 30-day TTL', async () => {
  client.get.mockResolvedValue('token');
  await store.savePushToken(12, 'token');
  expect(client.set).toHaveBeenCalledWith('push-token:12', 'token', { EX: 2592000 });
  await expect(store.getPushToken(12)).resolves.toBe('token');
  expect(client.get).toHaveBeenCalledWith('push-token:12');
  await store.deletePushToken(12);
  expect(client.del).toHaveBeenCalledWith('push-token:12');
});
test('tolerates push token storage failures', async () => {
  redis.getClient.mockImplementation(() => { throw new Error('offline'); });
  await expect(store.savePushToken(12, 'token')).resolves.toBeUndefined();
  await expect(store.getPushToken(12)).resolves.toBeNull();
  await expect(store.deletePushToken(12)).resolves.toBeUndefined();
});
