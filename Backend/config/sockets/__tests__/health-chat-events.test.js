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
});
