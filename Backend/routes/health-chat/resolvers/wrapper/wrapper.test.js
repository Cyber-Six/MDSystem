const mockQuery = jest.fn();
const mockAutoExpireTickets = jest.fn();
const mockFormatChatRecordsBatch = jest.fn();
const mockFormatChatRecord = jest.fn();
const mockError = jest.fn((message, status) => Object.assign(new Error(message), { status }));

jest.mock('../../../../config/query', () => ({ query: (...args) => mockQuery(...args) }));
jest.mock('../../../../utils/graphql-helper', () => ({ throwGraphQLError: jest.fn(() => ({ message(value) { this.errorMessage = value; return this; }, status(value) { this.statusCode = value; return this; }, throw() { throw mockError(this.errorMessage, this.statusCode); } })) }));
jest.mock('../../../../config/multer', () => ({ promoteFile: jest.fn() }));
jest.mock('../../../../config/sockets', () => ({ emitToRoom: jest.fn(), notifyUser: jest.fn() }));
jest.mock('../../../../services/authorization/permit', () => ({ isMedicalAdmin: jest.fn(), isMedicalPermittedPatientBased: jest.fn(), permissions: {} }));
jest.mock('../../../../utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('./helper', () => ({
  calculateExpiryDate: jest.fn(), isChatExpired: jest.fn(), verifyPatientOwnsChat: jest.fn(), verifyMedicalAssignedToChat: jest.fn(), checkChatStatus: jest.fn(),
  formatChatRecord: (...args) => mockFormatChatRecord(...args), formatChatRecordsBatch: (...args) => mockFormatChatRecordsBatch(...args),
  formatMessage: jest.fn(), hasActiveTicket: jest.fn(), getParticipantInfo: jest.fn(), getParticipantInfoBatch: jest.fn(),
  autoExpireTickets: (...args) => mockAutoExpireTickets(...args), getLastMessageInfo: jest.fn(), CHAT_EXPIRY_DAYS: 30,
}));

const { Query, Mutation } = require('./wrapper');

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
  mockAutoExpireTickets.mockResolvedValue(0);
  mockFormatChatRecordsBatch.mockResolvedValue([]);
  mockFormatChatRecord.mockResolvedValue({ id: 7, status: 'ongoing' });
});

test('patient ticket list requires identity, expires stale tickets, filters and counts results', async () => {
  await expect(Query._getMyTickets(null, {}, { user: null, res: {} })).rejects.toMatchObject({ status: 401 });
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 7 }] }).mockResolvedValueOnce({ rows: [{ total: 1 }] });
  mockFormatChatRecordsBatch.mockResolvedValueOnce([{ id: 7 }]);
  await expect(Query._getMyTickets(null, { status: 'ongoing', offset: 5, limit: 2 }, { user: { id: 8 } })).resolves.toEqual({ chats: [{ id: 7 }], total: 1 });
  expect(mockAutoExpireTickets).toHaveBeenCalledWith(8);
  expect(mockQuery.mock.calls[0][1]).toEqual([8, 'ongoing', 2, 5]);
});

test('ticket lookup and expiration mutation enforce authentication and format results', async () => {
  await expect(Query._getMyTicket(null, { chatId: 7 }, { user: null, res: {} })).rejects.toMatchObject({ status: 401 });
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 7 }] });
  await expect(Query._getMyTicket(null, { chatId: 7 }, { user: { id: 8 } })).resolves.toEqual({ id: 7, status: 'ongoing' });
  expect(mockFormatChatRecord).toHaveBeenCalledWith({ id: 7 });
  await expect(Mutation._expireOldTickets(null, null, { user: null, res: {} })).rejects.toMatchObject({ status: 401 });
  mockAutoExpireTickets.mockResolvedValueOnce(3);
  await expect(Mutation._expireOldTickets(null, null, { user: { id: 8 } })).resolves.toBe(3);
  expect(mockAutoExpireTickets).toHaveBeenLastCalledWith();
});
