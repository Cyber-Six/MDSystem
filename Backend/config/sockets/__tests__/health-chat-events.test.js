const mockRegisterHandlers = jest.fn();
const mockVerifyPatientOwnsChat = jest.fn();
const mockVerifyMedicalAssignedToChat = jest.fn();
const mockIsMedicalAdmin = jest.fn();

jest.mock('../socket-events.js', () => ({
  registerHandlers: (...args) => mockRegisterHandlers(...args),
}));

jest.mock('../../../routes/health-chat/resolvers/wrapper/helper.js', () => ({
  verifyPatientOwnsChat: (...args) => mockVerifyPatientOwnsChat(...args),
  verifyMedicalAssignedToChat: (...args) => mockVerifyMedicalAssignedToChat(...args),
}));

jest.mock('../../../services/permit.js', () => ({
  isMedicalAdmin: (...args) => mockIsMedicalAdmin(...args),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

require('../health-chat-events.js');

function createSocket({ userId = '101', userRole = 'patient' } = {}) {
  const toEmit = jest.fn();

  return {
    userId,
    userRole,
    data: {},
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: toEmit })),
    _toEmit: toEmit,
  };
}

describe('health-chat socket security', () => {
  let handlers;

  beforeEach(() => {
    handlers = mockRegisterHandlers.mock.calls[0][0];
    mockVerifyPatientOwnsChat.mockReset();
    mockVerifyMedicalAssignedToChat.mockReset();
    mockIsMedicalAdmin.mockReset();
  });

  test('denies join-room when patient does not own chat', async () => {
    const socket = createSocket({ userId: '501', userRole: 'patient' });
    const ack = jest.fn();

    mockVerifyPatientOwnsChat.mockResolvedValueOnce(false);

    await handlers['healthchat:join-room'](socket, { chatId: '55' }, ack);

    expect(ack).toHaveBeenCalledWith({
      error: 'ACCESS_DENIED',
      message: 'You are not authorized to access this chat.',
    });
    expect(socket.join).not.toHaveBeenCalled();
  });

  test('allows join-room for assigned medical staff', async () => {
    const socket = createSocket({ userId: '900', userRole: 'medical' });
    const ack = jest.fn();

    mockIsMedicalAdmin.mockResolvedValueOnce(false);
    mockVerifyMedicalAssignedToChat.mockResolvedValueOnce(true);

    await handlers['healthchat:join-room'](socket, { chatId: 88 }, ack);

    expect(socket.join).toHaveBeenCalledWith('healthchat:88');
    expect(socket.data.authorizedHealthChats.has(88)).toBe(true);
    expect(ack).toHaveBeenCalledWith({ success: true, room: 'healthchat:88' });
  });

  test('validates IDs, initializes socket authorization state, and joins patient/admin chats', async () => {
    const join = handlers['healthchat:join-room'];
    const invalid = createSocket();
    const invalidAck = jest.fn();
    await join(invalid, { chatId: '0' }, invalidAck);
    expect(invalidAck).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PARAMS' }));
    await join(invalid, { chatId: 'unsafe' });

    const patient = createSocket({ userId: '44', userRole: 'patient' });
    delete patient.data;
    mockVerifyPatientOwnsChat.mockResolvedValueOnce(true);
    await join(patient, { chatId: '12' }, jest.fn());
    expect(patient.data.authorizedHealthChats.has(12)).toBe(true);
    expect(patient.join).toHaveBeenCalledWith('healthchat:12');

    const admin = createSocket({ userId: '88', userRole: 'medical' });
    mockIsMedicalAdmin.mockResolvedValueOnce(true);
    await join(admin, { chatId: 13 }, jest.fn());
    expect(mockVerifyMedicalAssignedToChat).not.toHaveBeenCalled();
    expect(admin.data.authorizedHealthChats.has(13)).toBe(true);
  });

  test('leaves valid rooms and reports invalid parameters', () => {
    const leave = handlers['healthchat:leave-room'];
    const socket = createSocket();
    socket.data.authorizedHealthChats = new Set([22]);
    const ack = jest.fn();
    leave(socket, { chatId: 22 }, ack);
    expect(socket.leave).toHaveBeenCalledWith('healthchat:22');
    expect(socket.data.authorizedHealthChats.has(22)).toBe(false);
    expect(ack).toHaveBeenCalledWith({ success: true });
    const invalidAck = jest.fn();
    leave(socket, { chatId: -1 }, invalidAck);
    expect(invalidAck).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PARAMS' }));
    leave(socket, { chatId: null });
  });

  test('denies typing when user has no access to chat', async () => {
    const socket = createSocket({ userId: '777', userRole: 'patient' });
    const ack = jest.fn();

    mockVerifyPatientOwnsChat.mockResolvedValueOnce(false);

    await handlers['healthchat:typing'](socket, { chatId: '42', isTyping: true }, ack);

    expect(ack).toHaveBeenCalledWith({
      error: 'ACCESS_DENIED',
      message: 'You are not authorized to access this chat.',
    });
    expect(socket.to).not.toHaveBeenCalled();
  });

  test('allows typing when chat is already authorized on socket', async () => {
    const socket = createSocket({ userId: '777', userRole: 'patient' });
    const ack = jest.fn();
    socket.data.authorizedHealthChats = new Set([42]);

    await handlers['healthchat:typing'](socket, { chatId: '42', isTyping: true }, ack);

    expect(socket.to).toHaveBeenCalledWith('healthchat:42');
    expect(socket._toEmit).toHaveBeenCalledWith('healthchat:user-typing', {
      chatId: 42,
      userId: '777',
      userType: 'Patient',
      isTyping: true,
    });
    expect(ack).toHaveBeenCalledWith({ success: true });
  });

  test('authorizes typing through ownership/admin checks and emits false typing state', async () => {
    const typing = handlers['healthchat:typing'];
    const patient = createSocket({ userId: '777', userRole: 'patient' });
    mockVerifyPatientOwnsChat.mockResolvedValueOnce(true);
    await typing(patient, { chatId: '42' }, jest.fn());
    expect(patient.data.authorizedHealthChats.has(42)).toBe(true);
    expect(patient._toEmit).toHaveBeenCalledWith('healthchat:user-typing', expect.objectContaining({ userType: 'Patient', isTyping: false }));

    const medical = createSocket({ userId: '900', userRole: 'medical' });
    mockIsMedicalAdmin.mockResolvedValueOnce(true);
    await typing(medical, { chatId: 43, isTyping: 1 }, jest.fn());
    expect(medical._toEmit).toHaveBeenCalledWith('healthchat:user-typing', expect.objectContaining({ userType: 'Medical', isTyping: true }));

    const invalidUser = createSocket({ userId: '0', userRole: 'patient' });
    const denied = jest.fn();
    await typing(invalidUser, { chatId: 43, isTyping: true }, denied);
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCESS_DENIED' }));

    const unsupportedRole = createSocket({ userId: '91', userRole: 'guest' });
    const unsupportedAck = jest.fn();
    await handlers['healthchat:join-room'](unsupportedRole, { chatId: 44 }, unsupportedAck);
    expect(unsupportedAck).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCESS_DENIED' }));
  });

  test('handles invalid typing IDs with and without acknowledgements', async () => {
    const typing = handlers['healthchat:typing'];
    const socket = createSocket();
    const ack = jest.fn();
    await typing(socket, { chatId: NaN }, ack);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_PARAMS' }));
    await typing(socket, { chatId: 'not-a-number' });
  });
});
