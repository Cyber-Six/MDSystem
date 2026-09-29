const mockClient = { get: jest.fn(), set: jest.fn(), scan: jest.fn() };
jest.mock('../../redis', () => ({ getClient: jest.fn(() => mockClient) }));
jest.mock('../../../utils/logger', () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const logger = require('../../../utils/logger');
const {
  acknowledgeNotification, getNotificationStatus, getReceivedNotifications,
  getSentNotifications, trackNotification,
} = require('../notification-acknowledgement');

describe('notification acknowledgement store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });
  afterEach(() => jest.restoreAllMocks());

  test('tracks notification metadata with the recipient-specific key and TTL', async () => {
    mockClient.set.mockResolvedValue('OK');
    await trackNotification('notif-1', 2, 3, 'socket');
    expect(mockClient.set).toHaveBeenCalledWith('notif:ack:notif-1:2', JSON.stringify({
      notificationId: 'notif-1', userId: '2', senderId: '3', deliveredVia: 'socket', timestamp: 1000,
      acknowledged: false, acknowledgedAt: null,
    }), expect.objectContaining({ EX: expect.any(Number) }));
  });

  test('swallows tracking failures and logs them', async () => {
    mockClient.set.mockRejectedValueOnce(new Error('offline'));
    await expect(trackNotification('x', 1, 2, 'email')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to track notification:x: offline'));
  });

  test('acknowledges only the actual recipient and handles missing records', async () => {
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ notificationId: 'notif-1', userId: '2', senderId: '3', acknowledged: false }));
    mockClient.set.mockResolvedValueOnce('OK');
    await expect(acknowledgeNotification('notif-1', 2)).resolves.toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith('notif:ack:notif-1:2', expect.stringContaining('"acknowledged":true'), expect.objectContaining({ XX: true }));

    mockClient.get.mockResolvedValueOnce(null);
    await expect(acknowledgeNotification('missing', 2)).resolves.toBe(false);
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'other' }));
    await expect(acknowledgeNotification('notif-1', 2)).resolves.toBe(false);
  });

  test('returns false when acknowledgement races with expiry or Redis fails', async () => {
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ userId: '2' }));
    mockClient.set.mockResolvedValueOnce(null);
    await expect(acknowledgeNotification('race', 2)).resolves.toBe(false);
    mockClient.get.mockRejectedValueOnce(new Error('offline'));
    await expect(acknowledgeNotification('broken', 2)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to acknowledge notif:broken: offline'));
  });

  test('reads status and returns null for absent or invalid Redis data', async () => {
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ notificationId: 'notif-1', userId: '2' }));
    await expect(getNotificationStatus('notif-1', 2)).resolves.toEqual({ notificationId: 'notif-1', userId: '2' });
    mockClient.get.mockResolvedValueOnce(null);
    await expect(getNotificationStatus('missing', 2)).resolves.toBeNull();
    mockClient.get.mockRejectedValueOnce(new Error('offline'));
    await expect(getNotificationStatus('notif-1', 2)).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get status for notif:notif-1: offline'));
  });

  test('scans, filters, sorts, and limits sent and received notifications', async () => {
    const newest = { senderId: '1', userId: '2', timestamp: 20 };
    const oldest = { senderId: '1', userId: '3', timestamp: 10 };
    mockClient.scan.mockResolvedValueOnce(['0', ['notif:ack:a:2', 'notif:ack:b:3']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify(oldest)).mockResolvedValueOnce(JSON.stringify(newest));
    await expect(getSentNotifications(1, 2)).resolves.toEqual([newest, oldest]);

    mockClient.scan.mockResolvedValueOnce(['0', ['notif:ack:a:2', 'notif:ack:b:3']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify(newest)).mockResolvedValueOnce(JSON.stringify(oldest));
    await expect(getReceivedNotifications(2)).resolves.toEqual([newest]);
  });

  test('returns empty lists for scan failures and stops at the iteration guard', async () => {
    mockClient.scan.mockRejectedValueOnce(new Error('offline'));
    await expect(getSentNotifications(1)).resolves.toEqual([]);
    mockClient.scan.mockRejectedValueOnce(new Error('offline'));
    await expect(getReceivedNotifications(2)).resolves.toEqual([]);

    mockClient.scan.mockResolvedValue(['1', []]);
    await expect(getSentNotifications(1)).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('getSentNotifications hit iteration limit'));
    mockClient.scan.mockResolvedValue(['1', []]);
    await expect(getReceivedNotifications(2)).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('getReceivedNotifications hit iteration limit'));
  });

  test('skips missing records while scanning and respects a zero limit', async () => {
    mockClient.scan.mockResolvedValueOnce(['0', ['a', 'b']]);
    mockClient.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify({ senderId: '1', timestamp: 1 }));
    await expect(getSentNotifications(1)).resolves.toEqual([{ senderId: '1', timestamp: 1 }]);
    mockClient.scan.mockResolvedValueOnce(['0', ['a']]);
    await expect(getReceivedNotifications(2, 0)).resolves.toEqual([]);
  });

  test('filters mismatched sender and recipient records', async () => {
    mockClient.scan.mockResolvedValueOnce(['0', ['sent', 'other']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ senderId: '9', timestamp: 1 }))
      .mockResolvedValueOnce(JSON.stringify({ senderId: '1', timestamp: 2 }));
    await expect(getSentNotifications(1)).resolves.toEqual([{ senderId: '1', timestamp: 2 }]);
    mockClient.scan.mockResolvedValueOnce(['0', ['received', 'other']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ userId: '9', timestamp: 1 }))
      .mockResolvedValueOnce(JSON.stringify({ userId: '2', timestamp: 2 }));
    await expect(getReceivedNotifications(2)).resolves.toEqual([{ userId: '2', timestamp: 2 }]);
  });

  test('stops scanning once the requested limit is reached', async () => {
    mockClient.scan.mockResolvedValueOnce(['0', ['first', 'second']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ senderId: '1', timestamp: 3 }));
    await expect(getSentNotifications(1, 1)).resolves.toHaveLength(1);
    mockClient.scan.mockResolvedValueOnce(['0', ['first', 'second']]);
    mockClient.get.mockResolvedValueOnce(null);
    await expect(getReceivedNotifications(2)).resolves.toEqual([]);
  });

  test('sorts multiple received records by newest timestamp', async () => {
    mockClient.scan.mockResolvedValueOnce(['0', ['a', 'b']]);
    mockClient.get.mockResolvedValueOnce(JSON.stringify({ userId: '2', timestamp: 1 }))
      .mockResolvedValueOnce(JSON.stringify({ userId: '2', timestamp: 9 }));
    await expect(getReceivedNotifications(2)).resolves.toEqual([
      { userId: '2', timestamp: 9 }, { userId: '2', timestamp: 1 },
    ]);
  });
});
