const { createServer } = require('node:http');
const jwt = require('jsonwebtoken');
const { io: connectSocket } = require('socket.io-client');
const { withEnvironment } = require('../../../test-support/fixtures.cjs');

jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
jest.mock('../../../utils/authentication-state', () => ({ assertAccountAllowed: jest.fn() }));
jest.mock('../../redis', () => ({
  getClient: () => { throw new Error('Redis adapter disabled for this test'); },
  getStaffAnchor: jest.fn(),
  getSessionBlacklist: jest.fn(),
  setSessionRevocationHandler: jest.fn(),
}));
jest.mock('../socket-store', () => ({ trackConnection: jest.fn(), untrackConnection: jest.fn() }));
jest.mock('../notification-store', () => ({ flushPending: jest.fn(async () => []) }));
jest.mock('../notification-preferences', () => ({ resolveChannelsForEvent: jest.fn() }));
jest.mock('../../../services/email/emailservice', () => ({ enqueueNotificationEmail: jest.fn() }));
jest.mock('../push-notification', () => ({}));
jest.mock('../../query', () => ({}));
jest.mock('../../../services/authorization/permit', () => ({ isMedicalAdmin: jest.fn(async () => false) }));
jest.mock('../../../routes/health-chat/resolvers/wrapper/helper', () => ({
  verifyPatientOwnsChat: jest.fn(),
  verifyMedicalAssignedToChat: jest.fn(),
}));

const { getStaffAnchor, getSessionBlacklist } = require('../../redis');
const { initSocket } = require('../socket-server');
const { emitToRoom } = require('../socket-emitter');
const { verifyPatientOwnsChat, verifyMedicalAssignedToChat } = require('../../../routes/health-chat/resolvers/wrapper/helper');
require('../health-chat-events');

function nextEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const onEvent = value => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 3_000);
    socket.once(event, onEvent);
  });
}

test('delivers chat messages to authorized room members and checks session and assignment on reconnect', async () => {
  const restoreEnv = withEnvironment({ JWT_SECRET: 'health-chat-integration-key', SOCKET_PATH: '/socket.io' });
  const server = createServer();
  const sockets = [];
  let io;
  try {
    io = await initSocket(server);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const chatId = 42;
    const room = `healthchat:${chatId}`;
    const join = socket => socket.timeout(3_000).emitWithAck('healthchat:join-room', { chatId });
    getStaffAnchor.mockResolvedValue('staff-session');
    getSessionBlacklist.mockResolvedValue(false);
    verifyPatientOwnsChat.mockImplementation(async (id, userId) => id === chatId && userId === 101);
    verifyMedicalAssignedToChat.mockImplementation(async (id, userId) => id === chatId && userId === 202);

    function openClient(id, role, claims = {}) {
      const token = jwt.sign({ id, role, ...claims }, process.env.JWT_SECRET, {
        audience: 'mdsystem-app', issuer: 'mdsystem-auth', expiresIn: '5m',
      });
      const socket = connectSocket(`http://127.0.0.1:${server.address().port}`, {
        auth: { token }, autoConnect: false, reconnection: false, transports: ['websocket'],
      });
      sockets.push(socket);
      return socket;
    }

    function connectAndWait(socket, event = 'socket:connected') {
      const result = nextEvent(socket, event);
      socket.connect();
      return result;
    }

    const patient = openClient(101, 'patient', { jti: 'patient-token' });
    const staff = openClient(202, 'medical', { sid: 'staff-session' });
    const otherPatient = openClient(303, 'patient');
    await Promise.all(sockets.map(socket => connectAndWait(socket)));
    await expect(join(otherPatient)).resolves.toMatchObject({ error: 'ACCESS_DENIED' });
    await expect(join(patient)).resolves.toEqual({ success: true, room });
    await expect(join(staff)).resolves.toEqual({ success: true, room });

    const reply = { chatId, senderType: 'Medical', message: { id: 7, text: 'Clinic hours are 8 to 5.' } };
    const received = nextEvent(patient, 'healthchat:new-message');
    expect(io.sockets.adapter.rooms.get(room)).toEqual(new Set([patient.id, staff.id]));
    expect(emitToRoom(room, 'healthchat:new-message', reply)).toBe(true);
    await expect(received).resolves.toEqual(reply);

    // Simulate a handoff in the authorization store while the clients are offline.
    staff.disconnect();
    patient.disconnect();
    verifyMedicalAssignedToChat.mockResolvedValue(false);
    await Promise.all([connectAndWait(staff), connectAndWait(patient)]);
    await expect(join(staff)).resolves.toMatchObject({ error: 'ACCESS_DENIED' });
    await expect(join(patient)).resolves.toEqual({ success: true, room });
    expect(io.sockets.adapter.rooms.get(room)).toEqual(new Set([patient.id]));

    patient.disconnect();
    getSessionBlacklist.mockImplementation(async tokenId => tokenId === 'patient-token');
    await expect(connectAndWait(patient, 'connect_error')).resolves.toMatchObject({
      message: 'SOCKET_AUTH_FAILED: Token revoked',
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (io) await io.close();
    restoreEnv();
  }
});
