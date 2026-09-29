jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./socket-events', () => ({ registerHandlers: jest.fn() }));
jest.mock('../../services/permit', () => ({
  getStaffBranch: jest.fn(), isMedicalPermitted: jest.fn(),
  permissions: Object.fromEntries(['appointment_allow_view_records', 'inventory_allow_view', 'health_chat_allow_access', 'emr_allow_approval', 'is_admin'].map(key => [key, key])),
}));
const { socketMock } = require('../../test-support/fixtures.cjs');
const { registerHandlers } = require('./socket-events');
const permit = require('../../services/permit');
require('./notification-events');
const handlers = registerHandlers.mock.calls[0][0];
beforeEach(() => { permit.getStaffBranch.mockReset(); permit.isMedicalPermitted.mockReset(); });
test.each([true, false])('joins the authenticated self room (ack=%s)', async withAck => {
  const socket = socketMock(), ack = withAck ? jest.fn() : undefined;
  await handlers['notification:join-self'](socket, {}, ack);
  expect(socket.join).toHaveBeenCalledWith('user:12');
  if (ack) expect(ack).toHaveBeenCalledWith({ success: true, room: 'user:12' });
  socket.join.mockImplementation(() => { throw new Error('join failed'); });
  await handlers['notification:join-self'](socket, {}, ack);
  if (ack) expect(ack).toHaveBeenLastCalledWith({ error: 'INTERNAL_ERROR', message: 'join failed' });
});
test.each([true, false])('rejects absent branch and handles lookup errors (ack=%s)', async withAck => {
  const socket = socketMock(), ack = withAck ? jest.fn() : undefined;
  await handlers['notification:join-branch'](socket, {}, ack);
  expect(socket.join).not.toHaveBeenCalled();
  if (ack) expect(ack).toHaveBeenCalledWith({ error: 'NO_BRANCH', message: 'No branch assigned' });
  permit.getStaffBranch.mockRejectedValue(new Error('lookup failed'));
  await handlers['notification:join-branch'](socket, {}, ack);
  if (ack) expect(ack).toHaveBeenLastCalledWith({ error: 'INTERNAL_ERROR', message: 'lookup failed' });
});
test.each([
  ['Manila', 'Both', false, 'Manila', ['Arlegui', 'Casal']],
  ['Both', 'QuezonCity', false, 'QuezonCity', ['Arlegui', 'Casal', 'QuezonCity']],
  ['Both', 'Both', false, 'Both', ['Arlegui', 'Casal', 'QuezonCity']],
  ['Manila', 'QuezonCity', false, null, ['Arlegui', 'Casal']],
  ['QuezonCity', 'Manila', true, 'Both', ['QuezonCity']],
  ['Custom', undefined, false, 'Both', ['Custom']],
])('limits room subscriptions for designation=%s permission=%s admin=%s', async (branch, permissionBranch, admin, chatScope, locations) => {
  permit.getStaffBranch.mockResolvedValue(branch);
  permit.isMedicalPermitted.mockImplementation(async (_id, key) => ({ permitted: key === 'is_admin' ? admin : true, branch: permissionBranch }));
  const socket = socketMock({ userRole: 'medical' }), ack = jest.fn();
  await handlers['notification:join-branch'](socket, {}, ack);
  const expected = locations.flatMap(location => [`branch:${location}:appointments`, `branch:${location}:inventory`, `branch:${location}:records`]);
  if (chatScope) expected.push(`notif:healthchat:${chatScope}`);
  expected.push(...(branch === 'Both' ? ['Manila', 'QuezonCity', 'Both'] : [branch, 'Both']).map(value => `role:${value}::staff`));
  expect(socket.join.mock.calls.map(([room]) => room)).toEqual(expected);
  expect(ack).toHaveBeenCalledWith({ success: true, branch, rooms: expected });
});
test.each(['patient', 'medical'])('joins no privileged rooms without permissions (%s)', async userRole => {
  permit.getStaffBranch.mockResolvedValue('Manila');
  permit.isMedicalPermitted.mockResolvedValue({ permitted: false });
  const socket = socketMock({ userRole });
  await handlers['notification:join-branch'](socket, {});
  expect(socket.join).not.toHaveBeenCalled();
});
