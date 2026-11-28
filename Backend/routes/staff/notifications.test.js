jest.mock('../../config/middleware/jwtProtect', () => ({ jwtProtect: jest.fn(() => jest.fn()) }));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }));
jest.mock('../../services/notifications/notifyStaffs', () => ({ notifyStaffs: jest.fn() }));
jest.mock('../../services/notifications/notifyPatients', () => ({
  PATIENT_GROUPS: ['Student', 'Employee'],
  GROUP_BRANCHES: ['Manila', 'QuezonCity', 'Both'],
  notifyPatients: jest.fn(),
  notifyPatientGroup: jest.fn(),
  listPatientNotificationGroups: jest.fn(),
}));
jest.mock('../../services/authorization/permit', () => ({
  permissions: { is_admin: 'is_admin', notification_allow_send_to_patients: 'notification_allow_send_to_patients' },
  isMedicalPermitted: jest.fn(),
}));
jest.mock('../../config/query', () => ({ verifyUserIdentities: jest.fn(), getUserIdentitiesDetailed: jest.fn(), getPatientBranches: jest.fn() }));
jest.mock('../../config/sockets/notification-acknowledgement', () => ({ acknowledgeNotification: jest.fn(), getNotificationStatus: jest.fn(), getSentNotifications: jest.fn(), getReceivedNotifications: jest.fn() }));

const router = require('./notifications');
const permit = require('../../services/authorization/permit');
const queries = require('../../config/query');
const { notifyStaffs } = require('../../services/notifications/notifyStaffs');
const { notifyPatients, notifyPatientGroup, listPatientNotificationGroups } = require('../../services/notifications/notifyPatients');
const acknowledgements = require('../../config/sockets/notification-acknowledgement');

function handler(method, path) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  return layer.route.stack.at(-1).handle;
}
function response() {
  const res = { status: jest.fn(), json: jest.fn(), set: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}
const request = ({ id = 12, body = {}, params = {} } = {}) => ({ user: id == null ? {} : { id }, body, params });
const delivery = { notificationId: 'n-1', totalRecipients: 1, delivery: { delivered: [], queued: [] } };

beforeEach(() => {
  jest.clearAllMocks();
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true, branch: 'Manila' });
  queries.verifyUserIdentities.mockResolvedValue({ invalid: [], totalInvalid: 0 });
  queries.getUserIdentitiesDetailed.mockResolvedValue([{ id: 7 }]);
  queries.getPatientBranches.mockResolvedValue([{ userId: '7', branch: 'Manila' }]);
  notifyStaffs.mockResolvedValue(delivery); notifyPatients.mockResolvedValue(delivery);
  acknowledgements.acknowledgeNotification.mockResolvedValue(true);
  acknowledgements.getNotificationStatus.mockResolvedValue(null);
  acknowledgements.getSentNotifications.mockResolvedValue([]);
  acknowledgements.getReceivedNotifications.mockResolvedValue([]);
});

test('staff broadcast checks identity, administrator permission, message and recipient validation', async () => {
  const run = handler('post', '/notify-staffs'); const res = response();
  await run(request({ id: null, body: { message: 'hello' } }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await run(request({ body: { message: 'hello' } }), res); expect(res.status).toHaveBeenLastCalledWith(403);
  for (const message of [null, 4, '']) { await run(request({ body: { message } }), res); expect(res.status).toHaveBeenLastCalledWith(400); }
  await run(request({ body: { message: 'x'.repeat(2001) } }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  await run(request({ body: { message: 'hello', recipientIds: '7' } }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  queries.verifyUserIdentities.mockResolvedValueOnce({ invalid: [9], totalInvalid: 1 });
  await run(request({ body: { message: 'hello', recipientIds: [9] } }), res);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ error: 'INVALID_RECIPIENTS', invalidCount: 1 }));
});

test('staff broadcast delivers to all or selected valid recipients and catches service errors', async () => {
  const run = handler('post', '/notify-staffs'); const res = response();
  await run(request({ body: { message: 'hello' } }), res);
  expect(notifyStaffs).toHaveBeenCalledWith(12, 'hello', null);
  expect(res.json).toHaveBeenLastCalledWith({ success: true, ...delivery });
  await run(request({ body: { message: 'hello', recipientIds: ['7', 8] } }), res);
  expect(notifyStaffs).toHaveBeenLastCalledWith(12, 'hello', ['7', 8]);
  notifyStaffs.mockRejectedValueOnce(new Error('queue down'));
  await run(request({ body: { message: 'hello' } }), res);
  expect(res.status).toHaveBeenLastCalledWith(500);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'NOTIFICATION_FAILED', message: 'Failed to send staff notifications' });
});

test('patient notifications validates recipients and permits shared-campus patients within scope', async () => {
  const run = handler('post', '/notify-patients'); const res = response();
  await run(request({ id: null, body: { message: 'hello' } }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  for (const message of [null, 1]) { await run(request({ body: { message } }), res); expect(res.status).toHaveBeenLastCalledWith(400); }
  await run(request({ body: { message: 'x'.repeat(2001) } }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  await run(request({ body: { message: 'hi', recipientIds: [false] } }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  queries.getUserIdentitiesDetailed.mockResolvedValueOnce([]);
  await run(request({ body: { message: 'hi', recipientIds: [7] } }), res); expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ error: 'INVALID_RECIPIENTS' }));
  queries.getUserIdentitiesDetailed.mockResolvedValueOnce([{ id: 7 }]);
  queries.getPatientBranches.mockResolvedValueOnce([{ userId: '7', branch: 'Manila' }, { userId: '8', branch: 'Both' }]);
  await run(request({ body: { message: 'hello', recipientIds: [7, 8] } }), res);
  expect(permit.isMedicalPermitted).toHaveBeenCalledWith(12, 'notification_allow_send_to_patients');
  expect(notifyPatients).toHaveBeenCalledWith(12, 'hello', [7, 8], 'Manila');
  expect(res.json).toHaveBeenLastCalledWith({ success: true, ...delivery });
  await run(request({ body: { message: 'all valid', recipientIds: [7] } }), res);
  expect(notifyPatients).toHaveBeenLastCalledWith(12, 'all valid', [7], 'Manila');
});

test('patient notifications rejects insufficient scope and handles broadcast and dependency failures', async () => {
  const run = handler('post', '/notify-patients'); const res = response();
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: null });
  await run(request({ body: { message: 'hello' } }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  queries.getPatientBranches.mockResolvedValueOnce([{ userId: '7', branch: 'Manila' }, { userId: '8', branch: 'QuezonCity' }]);
  await run(request({ body: { message: 'hello', recipientIds: [7, 8] } }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  expect(notifyPatients).not.toHaveBeenCalled();
  await run(request({ body: { message: 'hello' } }), res);
  expect(notifyPatients).toHaveBeenCalledWith(12, 'hello', null, 'Manila');
  queries.getUserIdentitiesDetailed.mockRejectedValueOnce(new Error('database down'));
  await run(request({ body: { message: 'hello', recipientIds: [7] } }), res);
  expect(res.status).toHaveBeenLastCalledWith(500);
  notifyPatients.mockRejectedValueOnce(new Error('queue down'));
  await run(request({ body: { message: 'hello' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'NOTIFICATION_FAILED', message: 'Failed to send patient notifications' });
});

test('group preview requires patient notification permission and uses its configured campus', async () => {
  const run = handler('get', '/notify-patient-groups');
  const res = response();
  await run(request({ id: null }), res);
  expect(res.status).toHaveBeenLastCalledWith(401);
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: null });
  await run(request(), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  expect(listPatientNotificationGroups).not.toHaveBeenCalled();

  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'QuezonCity' });
  const options = { branches: ['QuezonCity'], groups: [{ branch: 'QuezonCity', profile: 'Student', count: 3 }] };
  listPatientNotificationGroups.mockResolvedValueOnce(options);
  await run(request(), res);
  expect(permit.isMedicalPermitted).toHaveBeenLastCalledWith(12, 'notification_allow_send_to_patients');
  expect(listPatientNotificationGroups).toHaveBeenCalledWith('QuezonCity');
  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(res.json).toHaveBeenLastCalledWith(options);
});

test('group send checks current scope, rejects a stale count, and never falls back to a legacy send', async () => {
  const run = handler('post', '/notify-patient-groups');
  const res = response();
  const body = { message: 'Campus reminder', profile: 'Employee', branch: 'Manila', expectedCount: 3 };
  for (const overrides of [{ profile: 'Superior' }, { branch: 'All' }, { expectedCount: 0 }, { expectedCount: '3' }]) {
    await run(request({ body: { ...body, ...overrides } }), res);
    expect(res.status).toHaveBeenLastCalledWith(400);
  }
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true, branch: 'Manila' });
  for (const branch of ['QuezonCity', 'Both']) {
    await run(request({ body: { ...body, branch } }), res);
    expect(res.status).toHaveBeenLastCalledWith(403);
  }
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: null });
  await run(request({ body }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  expect(notifyPatientGroup).not.toHaveBeenCalled();

  notifyPatientGroup.mockResolvedValueOnce({ audienceChanged: true });
  await run(request({ body }), res);
  expect(res.status).toHaveBeenLastCalledWith(409);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ error: 'AUDIENCE_CHANGED' }));
  expect(notifyPatientGroup).toHaveBeenLastCalledWith(12, body.message, { profile: 'Employee', branch: 'Manila', expectedCount: 3 });

  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'Both' });
  const result = { notificationId: 'group-1', totalRecipients: 3, deliveryCounts: { delivered: 2, queued: 1, suppressed: 0, unconfirmed: 0 } };
  notifyPatientGroup.mockResolvedValueOnce(result);
  await run(request({ body: { ...body, branch: 'Both' } }), res);
  expect(notifyPatientGroup).toHaveBeenLastCalledWith(12, body.message, { profile: 'Employee', branch: 'Both', expectedCount: 3 });
  expect(res.json).toHaveBeenLastCalledWith({ success: true, ...result });
  expect(notifyPatients).not.toHaveBeenCalled();
});

test('acknowledgement validates user and notification and reports missing, success, and errors', async () => {
  const run = handler('post', '/notify-acknowledge'); const res = response();
  await run(request({ id: null, body: {} }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  await run(request({ body: {} }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  acknowledgements.acknowledgeNotification.mockResolvedValueOnce(false);
  await run(request({ body: { notificationId: 'n1' } }), res); expect(res.status).toHaveBeenLastCalledWith(404);
  await run(request({ body: { notificationId: 'n1' } }), res); expect(res.json).toHaveBeenLastCalledWith({ success: true, message: 'Notification acknowledged' });
  acknowledgements.acknowledgeNotification.mockRejectedValueOnce(new Error('redis down'));
  await run(request({ body: { notificationId: 'n1' } }), res); expect(res.status).toHaveBeenLastCalledWith(500);
});

test('notification status validates inputs, handles absent records, formats acknowledged durations, and catches errors', async () => {
  const run = handler('get', '/notify-status/:notificationId'); const res = response();
  await run(request({ id: null, params: { notificationId: 'n1' } }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  await run(request({ params: {} }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  await run(request({ params: { notificationId: 'n1' } }), res); expect(res.status).toHaveBeenLastCalledWith(404);
  for (const seconds of [1, 2, 60, 120, 3600, 7200, 86400, 172800]) {
    acknowledgements.getNotificationStatus.mockResolvedValueOnce({ timestamp: 0, acknowledged: true, acknowledgedAt: seconds * 1000 });
    await run(request({ params: { notificationId: 'n1' } }), res);
    expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ status: expect.objectContaining({ deliveryDuration: expect.any(String) }) }));
  }
  acknowledgements.getNotificationStatus.mockResolvedValueOnce({ timestamp: 0, acknowledged: false, acknowledgedAt: null });
  await run(request({ params: { notificationId: 'n1' } }), res);
  expect(res.json.mock.calls.at(-1)[0].status).not.toHaveProperty('deliveryDuration');
  acknowledgements.getNotificationStatus.mockRejectedValueOnce(new Error('redis down'));
  await run(request({ params: { notificationId: 'n1' } }), res); expect(res.status).toHaveBeenLastCalledWith(500);
});

test('sent notifications map durations and handle missing identity and retrieval failure', async () => {
  const run = handler('get', '/notify-sent'); const res = response();
  await run(request({ id: null }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  acknowledgements.getSentNotifications.mockResolvedValueOnce([
    { notificationId: 'a', userId: 2, timestamp: 0, acknowledged: true, acknowledgedAt: 1000 },
    { notificationId: 'b', userId: 3, timestamp: 0, acknowledged: false },
  ]);
  await run(request(), res);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2, notifications: expect.arrayContaining([expect.objectContaining({ deliveryDuration: '1 second' }), expect.objectContaining({ deliveryDuration: null })]) }));
  acknowledgements.getSentNotifications.mockRejectedValueOnce(new Error('redis down'));
  await run(request(), res); expect(res.status).toHaveBeenLastCalledWith(500);
});

test('received notifications maps rows and handles missing identity and retrieval failure', async () => {
  const run = handler('get', '/notify-received'); const res = response();
  await run(request({ id: null }), res); expect(res.status).toHaveBeenLastCalledWith(401);
  acknowledgements.getReceivedNotifications.mockResolvedValueOnce([{ notificationId: 'a', senderId: 5, deliveredVia: 'socket', timestamp: 1, acknowledged: true, acknowledgedAt: 2 }]);
  await run(request(), res);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ count: 1, notifications: [expect.objectContaining({ senderId: 5, acknowledged: true })] }));
  acknowledgements.getReceivedNotifications.mockRejectedValueOnce(new Error('redis down'));
  await run(request(), res); expect(res.status).toHaveBeenLastCalledWith(500);
});
