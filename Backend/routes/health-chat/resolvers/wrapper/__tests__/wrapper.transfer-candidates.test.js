const mockDbQuery = jest.fn();
const mockIsMedicalAdmin = jest.fn();
const mockThrowGraphQLError = jest.fn(() => {
  return {
    message: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    throw: jest.fn(() => {
      throw new Error('GraphQL error');
    }),
  };
});

jest.mock('../../../../../config/query.js', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../../../../services/permit.js', () => ({
  isMedicalAdmin: (...args) => mockIsMedicalAdmin(...args),
  isMedicalPermittedPatientBased: jest.fn(),
  permissions: {
    is_admin: 'IS_ADMIN',
    health_chat_allow_access: 'ALLOW_TO_ACCESS_HEALTH_CHAT',
    privileged_to_perform_on_superior: 'PRIVILEGED_TO_PERFORM_ON_SUPERIOR',
  },
}));

jest.mock('../../../../../utils/graphql-helper.js', () => ({
  throwGraphQLError: (...args) => mockThrowGraphQLError(...args),
}));

jest.mock('../../../../../config/multer.js', () => ({
  promoteFile: jest.fn(),
}));

jest.mock('../../../../../config/sockets', () => ({
  emitToRoom: jest.fn(),
  notifyUser: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../../../utils/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../helper.js', () => ({
  calculateExpiryDate: jest.fn(),
  isChatExpired: jest.fn(),
  verifyPatientOwnsChat: jest.fn(),
  verifyMedicalAssignedToChat: jest.fn(),
  checkChatStatus: jest.fn(),
  formatChatRecord: jest.fn(),
  formatChatRecordsBatch: jest.fn(),
  formatMessage: jest.fn(),
  hasActiveTicket: jest.fn(),
  getParticipantInfo: jest.fn(),
  getParticipantInfoBatch: jest.fn(),
  autoExpireTickets: jest.fn(),
  getLastMessageInfo: jest.fn(),
  CHAT_EXPIRY_DAYS: 3,
}));

const Wrapper = require('../wrapper.js');

describe('health-chat transfer candidates', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    mockIsMedicalAdmin.mockReset();
    mockThrowGraphQLError.mockClear();
  });

  test('builds enum-safe query and returns mapped candidates', async () => {
    mockIsMedicalAdmin.mockResolvedValue(false);

    mockDbQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 55, patientId: 1001, medicalId: 99, status: 'Ongoing' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ branch: 'Manila', identity: 'Student' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 33,
            branch: 'Manila',
            role: 'doctor',
            first_name: 'Anne',
            last_name: 'Cruz',
            email: 'anne.cruz@example.com',
          },
        ],
      });

    const result = await Wrapper.Query._getTransferCandidates(
      null,
      { chatId: '55' },
      { user: { id: 99 }, res: {} }
    );

    expect(result).toEqual([
      {
        id: 33,
        firstName: 'Anne',
        lastName: 'Cruz',
        email: 'anne.cruz@example.com',
        branch: 'Manila',
        role: 'doctor',
      },
    ]);

    expect(mockDbQuery).toHaveBeenCalledTimes(3);
    const candidateSql = mockDbQuery.mock.calls[2][0];

    expect(candidateSql).toContain('$4::"UserDesignation" = \'Both\'::"UserDesignation"');
    expect(candidateSql).toContain('rm.branch = $4::"UserDesignation"');
    expect(candidateSql).toContain('mp.designation = $4::"UserDesignation"');

    const candidateParams = mockDbQuery.mock.calls[2][1];
    expect(candidateParams[3]).toBe('Manila');
  });
});
