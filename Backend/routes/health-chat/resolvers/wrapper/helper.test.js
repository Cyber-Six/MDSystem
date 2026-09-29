jest.mock('../../../../config/query.js', () => ({ query: jest.fn() }));
const db = require('../../../../config/query.js');
const helper = require('./helper.js');
const rows = (...items) => ({ rows: items, rowCount: items.length });
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('expiry uses last activity, with null, future and past cases', () => {
  expect(helper.CHAT_EXPIRY_DAYS).toBe(3);
  expect(helper.calculateExpiryDate(null)).toBeNull(); expect(helper.isChatExpired(null)).toBe(false);
  expect(helper.calculateExpiryDate('2026-01-01T00:00:00Z').toISOString()).toBe('2026-01-04T00:00:00.000Z');
  expect(helper.isChatExpired('2020-01-01T00:00:00Z')).toBe(true);
  expect(helper.isChatExpired('2099-01-01T00:00:00Z')).toBe(false);
});

test('participant lookup normalizes dates and optional identity fields', async () => {
  expect(await helper.getParticipantInfo(null)).toBeNull();
  db.query.mockResolvedValueOnce(rows()); expect(await helper.getParticipantInfo(1)).toBeNull();
  db.query.mockResolvedValueOnce(rows({ id: 2, first_name: 'A', last_name: 'B', email: 'a@example.com', identifier: 'X', profile: 'Student', branch: 'Manila', date_of_birth: new Date('2000-01-02T00:00:00Z'), sex: 'F' }));
  expect(await helper.getParticipantInfo(2)).toEqual({ id: 2, firstName: 'A', lastName: 'B', email: 'a@example.com', identifier: 'X', profileType: 'Student', branch: 'Student', dateOfBirth: '2000-01-02', sex: 'F' });
  db.query.mockResolvedValueOnce(rows({ id: 3, date_of_birth: '2001-02-03T12:00:00Z', branch: 'QuezonCity' }));
  expect(await helper.getParticipantInfo(3)).toEqual({ id: 3, firstName: 'Unknown', lastName: 'User', email: undefined, identifier: undefined, profileType: null, branch: 'QuezonCity', dateOfBirth: '2001-02-03', sex: null });
  db.query.mockResolvedValueOnce(rows({ id: 4, date_of_birth: 123 }));
  expect((await helper.getParticipantInfo(4)).dateOfBirth).toBeNull();
  db.query.mockResolvedValueOnce(rows({ id: 5 }));
  expect((await helper.getParticipantInfo(5)).branch).toBeNull();
});

test('chat ownership and staff assignment return booleans from row counts', async () => {
  db.query.mockResolvedValueOnce(rows({ id: 1 })).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows({ id: 2 })).mockResolvedValueOnce(rows());
  expect(await helper.verifyPatientOwnsChat(3, 7)).toBe(true);
  expect(db.query.mock.calls[0][1]).toEqual([3, 7]);
  expect(await helper.verifyPatientOwnsChat(3, 8)).toBe(false);
  expect(await helper.verifyMedicalAssignedToChat(3, 5)).toBe(true);
  expect(await helper.verifyMedicalAssignedToChat(3, 6)).toBe(false);
});

test('chat status handles absent, expired, active and closed tickets', async () => {
  db.query.mockResolvedValueOnce(rows()); expect(await helper.checkChatStatus(1)).toEqual({ isActive: false, status: null });
  db.query.mockResolvedValueOnce(rows({ status: 'Ongoing', session_start: new Date('2020-01-01') }));
  expect(await helper.checkChatStatus(2)).toEqual({ isActive: false, status: 'Expired' });
  db.query.mockResolvedValueOnce(rows({ status: 'Ongoing', last_message_at: new Date('2099-01-01'), session_start: new Date('2020-01-01') }));
  expect(await helper.checkChatStatus(2)).toEqual({ isActive: true, status: 'Ongoing' });
  db.query.mockResolvedValueOnce(rows({ status: 'Ongoing', session_start: null, last_message_at: null }));
  expect(await helper.checkChatStatus(2)).toEqual({ isActive: true, status: 'Ongoing' });
  db.query.mockResolvedValueOnce(rows({ status: 'Open' })).mockResolvedValueOnce(rows({ status: 'Closed' }));
  expect(await helper.checkChatStatus(3)).toEqual({ isActive: true, status: 'Open' });
  expect(await helper.checkChatStatus(4)).toEqual({ isActive: false, status: 'Closed' });
});

test('last message and formatting support system senders, unread counts and no messages', async () => {
  db.query.mockResolvedValueOnce(rows());
  expect(await helper.getLastMessageInfo(2)).toEqual({ lastMessage: null, lastMessageAt: null, unreadCount: 0 });
  db.query.mockResolvedValueOnce(rows({ id: 3, userId: null, stamp: 'today', unread_count: null }));
  expect(await helper.getLastMessageInfo(2)).toEqual({ lastMessage: { id: 3, userId: null, stamp: 'today', unread_count: null, sender: null }, lastMessageAt: 'today', unreadCount: 0 });
  db.query.mockResolvedValueOnce(rows({ id: 4, userId: 7, stamp: 'today', unread_count: 2 })).mockResolvedValueOnce(rows({ id: 7, first_name: 'A' }));
  expect((await helper.getLastMessageInfo(2)).lastMessage.sender.firstName).toBe('A');
  db.query.mockResolvedValueOnce(rows({ id: 7 }));
  expect((await helper.formatMessage({ id: 8, userId: 7 })).sender.id).toBe(7);
});

test('single chat formatting joins patient, medical and last message with expiry', async () => {
  db.query.mockResolvedValueOnce(rows({ id: 7, first_name: 'P' })).mockResolvedValueOnce(rows({ id: 8, first_name: 'M' })).mockResolvedValueOnce(rows({ id: 4, userId: null, stamp: '2026-01-02T00:00:00Z', unread_count: 3 }));
  const formatted = await helper.formatChatRecord({ id: 4, patientId: 7, medicalId: 8, status: 'Ongoing', session_start: '2026-01-01T00:00:00Z', closed_by_type: 'Medical' });
  expect(formatted.patient.firstName).toBe('P'); expect(formatted.medical.firstName).toBe('M');
  expect(formatted.expiresAt.toISOString()).toBe('2026-01-05T00:00:00.000Z'); expect(formatted.closedBy).toBe('Medical'); expect(formatted.unreadCount).toBe(3);
  db.query.mockResolvedValueOnce(rows());
  const noMessage = await helper.formatChatRecord({ id: 5, status: 'Closed', session_start: '2026-01-01T00:00:00Z' });
  expect(noMessage).toMatchObject({ patient: null, medical: null, closedBy: null, expiresAt: null, lastMessage: null, lastMessageAt: null, unreadCount: 0 });
  db.query.mockResolvedValueOnce(rows());
  const fallback = await helper.formatChatRecord({ id: 6, status: 'Ongoing', session_start: '2026-01-01T00:00:00Z' });
  expect(fallback.expiresAt.toISOString()).toBe('2026-01-04T00:00:00.000Z');
});

test('batch formatter handles empty input, duplicate user IDs, absent messages and fallback identity data', async () => {
  expect(await helper.formatChatRecordsBatch([])).toEqual([]);
  db.query.mockResolvedValueOnce(rows({ id: 7, first_name: 'P', last_name: 'One', date_of_birth: '2000-01-02T00:00:00Z' }, { id: 8, date_of_birth: new Date('1999-01-01T00:00:00Z'), profile: 'Staff' }, { id: 9, date_of_birth: 123 }))
    .mockResolvedValueOnce(rows({ id: 10, consultationVirtualId: 1, userId: 7, stamp: '2026-01-02T00:00:00Z' }))
    .mockResolvedValueOnce(rows({ chat_id: 1, count: 2 }))
    .mockResolvedValueOnce(rows({ id: 7, first_name: 'P' }));
  const formatted = await helper.formatChatRecordsBatch([
    { id: 1, patientId: 7, medicalId: 8, status: 'Ongoing', session_start: '2026-01-01T00:00:00Z', closed_by_type: 'Medical' },
    { id: 2, patientId: 7, medicalId: 9, status: 'Open', session_start: '2026-01-01T00:00:00Z' },
    { id: 3, patientId: null, medicalId: null, status: 'Closed' }
  ]);
  expect(db.query.mock.calls[0][1]).toEqual([[7, 8, 9]]);
  expect(formatted[0].patient.firstName).toBe('P'); expect(formatted[0].lastMessage.sender.id).toBe(7);
  expect(formatted[0].expiresAt.toISOString()).toBe('2026-01-05T00:00:00.000Z'); expect(formatted[0].unreadCount).toBe(2);
  expect(formatted[1]).toMatchObject({ lastMessage: null, lastMessageAt: null, unreadCount: 0, expiresAt: null });
  expect(formatted[2]).toMatchObject({ patient: null, medical: null, closedBy: null });
  db.query.mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows());
  const noUsers = await helper.formatChatRecordsBatch([{ id: 4, status: 'Ongoing', session_start: '2026-01-01T00:00:00Z' }]);
  expect(noUsers[0].expiresAt.toISOString()).toBe('2026-01-04T00:00:00.000Z');
  db.query.mockResolvedValueOnce(rows({ id: 11, consultationVirtualId: 5, userId: 99, stamp: '2026-01-02T00:00:00Z' }))
    .mockResolvedValueOnce(rows())
    .mockResolvedValueOnce(rows());
  const missingSender = await helper.formatChatRecordsBatch([{ id: 5, status: 'Closed' }]);
  expect(missingSender[0].lastMessage.sender).toBeNull();
  expect(missingSender[0].unreadCount).toBe(0);
});

test('auto expiry processes four ticket classes, writes system prompts, throttles global runs and scopes patient runs', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000000);
  let updates = 0;
  db.query.mockImplementation(async sql => sql.includes('INSERT INTO "HealthChatPrompt"') ? rows() : rows({ id: ++updates }));
  expect(await helper.autoExpireTickets()).toBe(4);
  expect(db.query).toHaveBeenCalledTimes(8);
  expect(await helper.autoExpireTickets()).toBe(0);
  expect(db.query).toHaveBeenCalledTimes(8);
  now.mockReturnValue(1031000);
  db.query.mockImplementation(async sql => sql.includes('INSERT INTO "HealthChatPrompt"') ? rows() : rows());
  expect(await helper.autoExpireTickets()).toBe(0);
  expect(db.query).toHaveBeenCalledTimes(12);
  expect(await helper.autoExpireTickets(7)).toBe(0);
  expect(db.query).toHaveBeenCalledTimes(16);
  expect(db.query.mock.calls[12][1]).toEqual(['3 days', 7]);
  expect(db.query.mock.calls[13][1]).toEqual([7]);
});

test('active-ticket and patient lookup query after auto expiry and handle no rows', async () => {
  db.query.mockImplementation(async sql => sql.includes('SELECT 1 FROM "HealthChat"') ? rows({ id: 1 }) : rows());
  expect(await helper.hasActiveTicket(7)).toBe(true);
  db.query.mockImplementation(async () => rows());
  expect(await helper.hasActiveTicket(7)).toBe(false);
  db.query.mockResolvedValueOnce(rows({ patientId: 9 })).mockResolvedValueOnce(rows());
  expect(await helper.getPatientIdFromChatId(3)).toBe(9);
  expect(await helper.getPatientIdFromChatId(4)).toBeNull();
});
