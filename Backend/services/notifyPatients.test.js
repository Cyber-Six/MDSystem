jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
jest.mock('../config/query', () => ({ query: jest.fn() }));
jest.mock('../config/sockets', () => ({ notifyUsers: jest.fn() }));
jest.mock('../config/sockets/notification-acknowledgement', () => ({ trackNotification: jest.fn() }));
jest.mock('../utils/validator', () => ({ ValidateUserBranchbyUserBranch: jest.fn((_staff, patient) => patient === 'Manila') }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'notification-id') }));
const db = require('../config/query');
const { notifyUsers } = require('../config/sockets');
const { trackNotification } = require('../config/sockets/notification-acknowledgement');
const { notifyPatients } = require('./notifyPatients');
beforeEach(() => { jest.resetAllMocks(); require('uuid').v4.mockReturnValue('notification-id'); });
test.each([null, '', 12, '   '])('rejects invalid messages %j before querying', async message => {
  await expect(notifyPatients(1, message)).rejects.toThrow('Message is required');
  expect(db.query).not.toHaveBeenCalled();
});
test('rejects an inactive or missing sender', async () => {
  db.query.mockResolvedValue({ rows: [] });
  await expect(notifyPatients(1, 'message')).rejects.toThrow(/not found/);
  expect(notifyUsers).not.toHaveBeenCalled();
});
test.each([null, [], [12, 13]])('delivers to valid recipients and tracks channel outcomes (%j)', async recipients => {
  require('../utils/validator').ValidateUserBranchbyUserBranch.mockImplementation((_staff, patient) => patient === 'Manila');
  db.query.mockResolvedValueOnce({ rows: [{"id":1,"branch":"Manila"}] })
    .mockResolvedValueOnce({ rows: [{ userId: 12, branch: 'Manila' }, { userId: 13, branch: 'Manila' }, { userId: 14, branch: 'QuezonCity' }] })
    .mockResolvedValueOnce({ rows: recipients ? [{ first_name: 'Test', last_name: 'Staff' }] : [] });
  notifyUsers.mockResolvedValue({ delivered: ['12'], queued: ['13'] });
  const result = await notifyPatients(1, ' message ', recipients);
  expect(notifyUsers).toHaveBeenCalledWith(['12', '13'], 'staff:notification', expect.objectContaining({ id: 'notif_staff_notification-id', message: 'message', from: 1, staffBranch: 'Manila', fromName: recipients ? 'Test Staff' : 'Staff Member' }));
  expect(trackNotification.mock.calls).toEqual([['notif_staff_notification-id', '12', 1, 'socket'], ['notif_staff_notification-id', '13', 1, 'email']]);
  expect(result).toEqual({ notificationId: 'notif_staff_notification-id', totalRecipients: 2, delivery: {
    delivered: [{ userId: '12', deliveryMethod: 'socket', status: 'delivered' }],
    queued: [{ userId: '13', deliveryMethod: 'email', status: 'queued' }],
  } });
  if (recipients?.length) expect(db.query.mock.calls[1][1]).toEqual([['12', '13']]);
});
test('returns an empty delivery when no recipients qualify', async () => {
  db.query.mockResolvedValueOnce({ rows: [{"id":1,"branch":"Manila"}] }).mockResolvedValueOnce({ rows: [] });
  await expect(notifyPatients(1, 'message')).resolves.toEqual({ notificationId: 'notif_staff_notification-id', totalRecipients: 0, delivery: { delivered: [], queued: [] } });
  expect(notifyUsers).not.toHaveBeenCalled();
});
test('propagates database failures', async () => {
  db.query.mockRejectedValue(new Error('database failed'));
  await expect(notifyPatients(1, 'message')).rejects.toThrow('database failed');
});
