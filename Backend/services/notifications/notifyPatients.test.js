jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../config/sockets', () => ({ notifyUsers: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../config/sockets/notification-acknowledgement', () => ({ trackNotification: jest.fn() }));
jest.mock('../../utils/validator', () => ({ ValidateUserBranchbyUserBranch: jest.fn((_staff, patient) => patient === 'Manila') }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'notification-id') }));
const db = require('../../config/query');
const { notifyUsers, notifyUser } = require('../../config/sockets');
const { trackNotification } = require('../../config/sockets/notification-acknowledgement');
const { notifyPatients, listPatientNotificationGroups, notifyPatientGroup } = require('./notifyPatients');
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
  require('../../utils/validator').ValidateUserBranchbyUserBranch.mockImplementation((_staff, patient) => patient === 'Manila');
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

test('an omitted legacy recipient list remains limited to the explicit permission scope', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, branch: 'Both' }] })
    .mockResolvedValueOnce({ rows: [
      { userId: 12, branch: 'Manila' }, { userId: 13, branch: 'QuezonCity' },
      { userId: 14, branch: 'Both' }, { userId: 15, branch: null },
    ] })
    .mockResolvedValueOnce({ rows: [] });
  notifyUsers.mockResolvedValueOnce({ delivered: ['12', '14'], queued: [] });
  const result = await notifyPatients(1, 'message', null, 'Manila');
  expect(notifyUsers).toHaveBeenCalledWith(['12', '14'], 'staff:notification', expect.any(Object));
  expect(result.totalRecipients).toBe(2);
});

test('lists only authorized group scopes and includes a shared-campus patient once in a both-campus count', async () => {
  db.query.mockResolvedValueOnce({ rows: [
    { profile: 'Student', branch: 'Manila', count: '2' },
    { profile: 'Student', branch: 'QuezonCity', count: '3' },
    { profile: 'Student', branch: 'Both', count: '1' },
  ] });
  const all = await listPatientNotificationGroups('Both');
  expect(all.branches).toEqual(['Manila', 'QuezonCity', 'Both']);
  expect(all.groups.filter(group => group.profile === 'Student').map(group => group.count)).toEqual([3, 4, 6]);
  db.query.mockResolvedValueOnce({ rows: [{ profile: 'Employee', branch: 'Both', count: '2' }] });
  await expect(listPatientNotificationGroups('QuezonCity')).resolves.toEqual({
    branches: ['QuezonCity'],
    groups: [
      { profile: 'Student', branch: 'QuezonCity', count: 0 },
      { profile: 'Employee', branch: 'QuezonCity', count: 2 },
    ],
  });
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining("uc.credentials_status = 'Active'"), [
    ['Student', 'Employee'], ['QuezonCity', 'Both'],
  ]);
});

test('group membership is resolved again and a changed count does not send', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ userId: 12 }, { userId: 13 }] });
  await expect(notifyPatientGroup(1, 'message', { profile: 'Student', branch: 'Manila', expectedCount: 1 }))
    .resolves.toEqual({ audienceChanged: true });
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("uc.credentials_status = 'Active'"), [
    ['Student'], ['Manila', 'Both'],
  ]);
  expect(notifyUser).not.toHaveBeenCalled();
});

test('group delivery uses the existing patient event and reports aggregate outcomes even after an individual failure', async () => {
  db.query.mockResolvedValueOnce({ rows: [12, 13, 14, 15].map(userId => ({ userId })) })
    .mockResolvedValueOnce({ rows: [{ first_name: 'Test', last_name: 'Staff' }] });
  notifyUser.mockResolvedValueOnce('delivered').mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce('queued').mockResolvedValueOnce('suppressed');
  await expect(notifyPatientGroup(1, ' message ', { profile: 'Employee', branch: 'Both', expectedCount: 4 }))
    .resolves.toEqual({
      notificationId: 'notif_staff_notification-id', totalRecipients: 4,
      deliveryCounts: { delivered: 1, queued: 1, suppressed: 1, unconfirmed: 1 },
    });
  expect(notifyUser.mock.calls.map(([id]) => id)).toEqual(['12', '13', '14', '15']);
  expect(notifyUser).toHaveBeenCalledWith('12', 'staff:notification', expect.objectContaining({
    id: 'notif_staff_notification-id', message: 'message', from: 1, fromName: 'Test Staff',
  }));
  expect(trackNotification.mock.calls).toEqual([
    ['notif_staff_notification-id', '12', 1, 'socket'],
    ['notif_staff_notification-id', '14', 1, 'email'],
  ]);
});
