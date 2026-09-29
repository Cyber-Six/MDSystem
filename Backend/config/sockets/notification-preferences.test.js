jest.mock('../redis', () => ({ getKey: jest.fn(), setKey: jest.fn(), delKey: jest.fn() }));
jest.mock('../query', () => ({ getUserPreferences: jest.fn() }));
jest.mock('../../utils/logger', () => ({ warn: jest.fn() }));
const redis = require('../redis');
const query = require('../query');
const prefs = require('./notification-preferences');
beforeEach(() => jest.resetAllMocks());

test.each([
  ['appointment:created', 'appointments'], ['healthchat:message', 'healthChat'],
  ['medicine:request:created', 'medicineRequests'], ['medicine:prescription:issued', 'medicineRequests'],
  ['document:ready', 'documents'], ['updateTicket:ready', 'emr'], ['inventory:updated', 'inventory'],
  ['admin:notification', 'general'], ['staff:notification', 'general'], ['role:updated', 'roleManagement'], ['unknown', 'general'],
])('maps %s to %s', (event, module) => expect(prefs.resolveModuleFromEvent(event)).toBe(module));
test('returns fresh independent default objects and caches the DB fallback', async () => {
  const defaults = prefs.getDefaultModuleChannels();
  defaults.appointments.web = false;
  expect(defaults.documents.web).toBe(true);
  const result = await prefs.getNotificationPreferences(12);
  expect(result).toEqual({ channels: prefs.DEFAULT_CHANNELS, moduleChannels: prefs.getDefaultModuleChannels() });
  expect(redis.setKey).toHaveBeenCalledWith('notif-pref:12', JSON.stringify(result), 300);
});
test('uses a valid cache without querying the DB', async () => {
  const cached = { channels: { web: false }, moduleChannels: {} };
  redis.getKey.mockResolvedValue(JSON.stringify(cached));
  await expect(prefs.getNotificationPreferences(1)).resolves.toEqual(cached);
  expect(query.getUserPreferences).not.toHaveBeenCalled();
});
test.each(['null', '{}', '{bad'])('falls through unusable cache %s', async cached => {
  redis.getKey.mockResolvedValue(cached);
  const result = await prefs.getNotificationPreferences(1);
  expect(query.getUserPreferences).toHaveBeenCalledWith(1);
  expect(result.channels).toEqual(prefs.DEFAULT_CHANNELS);
});
test('uses boolean global and module settings and inherits missing module fields', async () => {
  query.getUserPreferences.mockResolvedValue({ notification: {
    channels: { web: false, email: true, emailFallback: false },
    moduleChannels: { appointments: { web: true, email: false, emailFallback: true }, documents: {} },
  } });
  const result = await prefs.getNotificationPreferences(1);
  expect(result.moduleChannels.appointments).toEqual({ web: true, email: false, emailFallback: true });
  expect(result.moduleChannels.documents).toEqual(result.channels);
});
test.each([
  {}, { channels: 'invalid', moduleChannels: 'invalid' },
  { channels: {}, moduleChannels: { appointments: 'invalid' } },
])('ignores invalid or absent preference settings %j', async notification => {
  query.getUserPreferences.mockResolvedValue({ notification });
  expect((await prefs.getNotificationPreferences(1)).channels).toEqual(prefs.DEFAULT_CHANNELS);
});
test('survives failures reading and writing cache and DB', async () => {
  redis.getKey.mockRejectedValue(new Error('cache down'));
  redis.setKey.mockRejectedValue(new Error('cache down'));
  query.getUserPreferences.mockRejectedValue(new Error('DB down'));
  expect((await prefs.getNotificationPreferences(1)).channels).toEqual(prefs.DEFAULT_CHANNELS);
});
test('invalidates the cache and tolerates cache deletion failure', async () => {
  await prefs.invalidateNotifPrefCache(7);
  expect(redis.delKey).toHaveBeenCalledWith('notif-pref:7');
  redis.delKey.mockRejectedValue(new Error('offline'));
  await expect(prefs.invalidateNotifPrefCache(7)).resolves.toBeUndefined();
});
test.each([
  [{ channels: { web: false, email: true, emailFallback: false }, moduleChannels: {} }, { web: false, email: true, emailFallback: false }],
  [{ channels: {}, moduleChannels: { general: {} } }, { web: true, email: false, emailFallback: true }],
])('resolves module channels with global fallback', async (cached, expected) => {
  redis.getKey.mockResolvedValue(JSON.stringify(cached));
  await expect(prefs.resolveChannelsForEvent(1, 'unknown')).resolves.toEqual(expected);
});
