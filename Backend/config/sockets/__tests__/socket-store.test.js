jest.mock('../../redis', () => ({
  sAddKey: jest.fn(), sRemKey: jest.fn(), sCardKey: jest.fn(), delKey: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({ error: jest.fn() }));

const redis = require('../../redis');
const logger = require('../../../utils/logger');
const {
  getConnectedCount, getSocketIds, isConnected, isConnectedAnywhere,
  trackConnection, untrackConnection,
} = require('../socket-store');

describe('socket store', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tracks local connections and mirrors them to Redis', async () => {
    redis.sAddKey.mockResolvedValue();
    await trackConnection('user-1', 'socket-1');
    await trackConnection('user-1', 'socket-2');
    expect(isConnected('user-1')).toBe(true);
    expect(getSocketIds('user-1')).toEqual(expect.arrayContaining(['socket-1', 'socket-2']));
    expect(getConnectedCount()).toBeGreaterThanOrEqual(1);
    expect(redis.sAddKey).toHaveBeenCalledWith('socket:user:user-1', 'socket-1', expect.any(Number));
  });

  test('removes sockets and deletes empty Redis user sets', async () => {
    redis.sRemKey.mockResolvedValue();
    redis.sCardKey.mockResolvedValue(0);
    await untrackConnection('user-1', 'socket-1');
    await untrackConnection('user-1', 'socket-2');
    expect(isConnected('user-1')).toBe(false);
    expect(getSocketIds('user-1')).toEqual([]);
    expect(redis.delKey).toHaveBeenCalledWith('socket:user:user-1');
  });

  test('keeps Redis presence sets when sockets remain and safely ignores unknown local users', async () => {
    redis.sRemKey.mockResolvedValue();
    redis.sCardKey.mockResolvedValue(1);
    await untrackConnection('never-connected-user', 'missing-socket');
    expect(redis.delKey).not.toHaveBeenCalled();
    expect(isConnected('never-connected-user')).toBe(false);
  });

  test('uses cluster Redis presence and falls back to local presence on errors', async () => {
    redis.sCardKey.mockResolvedValueOnce(2);
    await expect(isConnectedAnywhere('remote-user')).resolves.toBe(true);
    redis.sAddKey.mockResolvedValue();
    await trackConnection('fallback-user', 'socket-1');
    redis.sCardKey.mockRejectedValueOnce(new Error('redis offline'));
    await expect(isConnectedAnywhere('fallback-user')).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('isConnectedAnywhere failed'), 'redis offline');
  });

  test('contains Redis add and remove errors while preserving local state', async () => {
    redis.sAddKey.mockRejectedValueOnce(new Error('add failed'));
    await trackConnection('local-user', 'socket-1');
    expect(isConnected('local-user')).toBe(true);
    redis.sRemKey.mockRejectedValueOnce(new Error('remove failed'));
    await untrackConnection('local-user', 'socket-1');
    expect(isConnected('local-user')).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('[SOCKET_STORE] Redis add failed:', 'add failed');
  });
});
