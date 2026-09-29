jest.mock('../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../services/permit.js', () => ({ isMedicalPermitted: jest.fn() }));
jest.mock('../../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../emr/wrapper/query.js', () => ({ _getUserUpdateTicket: jest.fn() }));
jest.mock('../../health-chat/resolvers/wrapper/helper.js', () => ({ autoExpireTickets: jest.fn() }));

const db = require('../../../config/query.js'); const permit = require('../../../services/permit.js'); const logger = require('../../../utils/logger.js');
const emr = require('../../emr/wrapper/query.js'); const chat = require('../../health-chat/resolvers/wrapper/helper.js');
const { Query } = require('./wrapper.js');
const ctx = (user = { id: 7 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
const rows = (...items) => ({ rows: items });
const grants = ['ALLOW_TO_APPROVE_EMR', 'ALLOW_TO_APPROVE_APPOINTMENT', 'ALLOW_TO_APPROVE_MEDICINE_REQUEST', 'ALLOW_TO_VIEW_APPOINTMENT', 'ALLOW_TO_VIEW_CONSULTATION', 'ALLOW_TO_VIEW_INVENTORY', 'ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION', 'ALLOW_TO_VIEW_PROFILE'];
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermitted.mockResolvedValue({ permitted: false }); chat.autoExpireTickets.mockResolvedValue(); emr._getUserUpdateTicket.mockResolvedValue(null); });

test('staff without dashboard grants receive no data and run only the branch lookup', async () => {
  db.query.mockResolvedValueOnce(rows());
  expect(await Query._getDashboardStats(null, {}, ctx())).toEqual({ pendingRequests: null, pendingBreakdown: null, todayAppointments: null, todayRemaining: null, activeConsultations: null, lowStockItems: null, tomorrowAvailability: null, recentPatients: null, recentRequests: null });
  expect(db.query).toHaveBeenCalledTimes(1); expect(logger.warn).toHaveBeenCalled();
});

test('all staff grants aggregate counts, branch-scoped queries, availability, and recent lists', async () => {
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true });
  const results = [rows({ designation: 'Manila' }), rows({ count: 2 }), rows({ count: 3 }), rows({ count: 4 }), rows({ total: 5, remaining: 1 }), rows({ count: 6 }), rows({ count: 7 }), rows(
    { label: 'Clinic', morningAllowed: '2', afternoonAllowed: '3', morningBooked: '1', afternoonBooked: '1' },
    { label: 'Clinic', morningAllowed: '1', afternoonAllowed: '0', morningBooked: '3', afternoonBooked: '0' },
    { location: 'QuezonCity', morningAllowed: '1', afternoonAllowed: '1', morningBooked: '0', afternoonBooked: '0' },
    { morningAllowed: null, afternoonAllowed: null, morningBooked: null, afternoonBooked: null }
  ), rows({ id: 9, name: ' Jane ', identifier: 'A', profile: 'Student', lastVisit: 'today' }, { id: 10, name: null, identifier: 'B' }), rows({ id: 11, name: ' Person ', type: 'EMR', status: 'Pending', submitted: 'now' }, { id: 12, name: null })];
  db.query.mockImplementation(() => Promise.resolve(results.shift()));
  const result = await Query._getDashboardStats(null, {}, ctx());
  expect(result).toEqual({
    pendingRequests: 9, pendingBreakdown: { emr: 2, appointments: 3, medicine: 4 }, todayAppointments: 5, todayRemaining: 1,
    activeConsultations: 6, lowStockItems: 7,
    tomorrowAvailability: [{ label: 'Clinic', total: 6, open: 3 }, { label: 'QuezonCity', total: 2, open: 2 }, { label: 'Other', total: 0, open: 0 }],
    recentPatients: [{ id: 9, name: 'Jane', identifier: 'A', program: 'Student', lastVisit: 'today' }, { id: 10, name: '—', identifier: 'B', program: '—', lastVisit: undefined }],
    recentRequests: [{ id: 11, name: 'Person', type: 'EMR', status: 'Pending', submitted: 'now' }, { id: 12, name: '—', type: undefined, status: undefined, submitted: undefined }]
  });
  expect(db.query).toHaveBeenCalledTimes(10);
  expect(db.query.mock.calls[1][1]).toEqual(['Manila']);
});

test.each(grants)('single grant %s only runs its relevant dashboard segment', async grant => {
  permit.isMedicalPermitted.mockImplementation((_id, name) => Promise.resolve({ permitted: name === grant }));
  db.query.mockResolvedValue(rows({}));
  const result = await Query._getDashboardStats(null, {}, ctx());
  expect(result).toBeDefined();
  expect(permit.isMedicalPermitted).toHaveBeenCalledTimes(8);
  expect(db.query.mock.calls[0][1]).toEqual([7]);
  expect(db.query.mock.calls.length).toBeGreaterThan(1);
  if (grant === 'ALLOW_TO_VIEW_APPOINTMENT') expect(result.todayAppointments).toBeUndefined();
  else if (grant === 'ALLOW_TO_VIEW_PROFILE') expect(result.recentPatients).toEqual([{ id: undefined, name: '—', identifier: undefined, program: '—', lastVisit: undefined }]);
  else if (grant === 'ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION') expect(result.tomorrowAvailability).toEqual([{ label: 'Other', open: 0, total: 0 }]);
});

test('staff dashboard treats empty aggregate rows as zero and maps database errors', async () => {
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true });
  db.query.mockResolvedValue(rows());
  const result = await Query._getDashboardStats(null, {}, ctx());
  expect(result.pendingRequests).toBe(0); expect(result.todayAppointments).toBe(0); expect(result.tomorrowAvailability).toEqual([]);
  db.query.mockRejectedValueOnce(Error('offline'));
  await expect(Query._getDashboardStats(null, {}, ctx())).rejects.toThrow('Failed to fetch dashboard statistics');
  expect(logger.error).toHaveBeenCalled();
});

test('patient dashboard requires a user and composes independent appointment, medicine, EMR and chat results', async () => {
  for (const user of [null, {}]) await expect(Query._getPatientDashboardData(null, {}, ctx(user))).rejects.toThrow('Unauthorized');
  db.query.mockResolvedValueOnce(rows({ id: 1 })).mockResolvedValueOnce(rows({ id: 2 })).mockResolvedValueOnce(rows({ id: 3 })).mockResolvedValueOnce(rows({ total: 4 }));
  emr._getUserUpdateTicket.mockResolvedValueOnce({ id: 5, status: 'Pending', scope: 'Profile', notes: 'note', created_at: 'today' });
  expect(await Query._getPatientDashboardData(null, {}, ctx())).toEqual({
    appointment: { id: 1 }, medicineReqs: [{ id: 2 }], updateTicket: { id: '5', status: 'Pending', scope: 'Profile', notes: 'note', created_at: 'today' },
    chatData: { chats: [{ id: 3 }], total: 4 }
  });
  expect(chat.autoExpireTickets).toHaveBeenCalledWith(7);
});

test('patient dashboard isolates segment failures and defaults empty values', async () => {
  db.query.mockRejectedValueOnce(Error('appointment failed')).mockRejectedValueOnce('medicine failed');
  emr._getUserUpdateTicket.mockRejectedValueOnce(Error('emr failed'));
  chat.autoExpireTickets.mockRejectedValueOnce(Error('chat failed'));
  expect(await Query._getPatientDashboardData(null, {}, ctx())).toEqual({ appointment: null, medicineReqs: [], updateTicket: null, chatData: { chats: [], total: 0 } });
  expect(logger.warn).toHaveBeenCalledTimes(4);
  db.query.mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows());
  emr._getUserUpdateTicket.mockResolvedValueOnce({ id: 6 });
  expect(await Query._getPatientDashboardData(null, {}, ctx())).toEqual({ appointment: null, medicineReqs: [], updateTicket: { id: '6', status: null, scope: null, notes: null, created_at: null }, chatData: { chats: [], total: 0 } });
  db.query.mockRejectedValueOnce('appointment failed').mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows({ total: 0 }));
  emr._getUserUpdateTicket.mockRejectedValueOnce('emr failed');
  const withStringFailures = await Query._getPatientDashboardData(null, {}, ctx());
  expect(withStringFailures.appointment).toBeNull(); expect(withStringFailures.updateTicket).toBeNull();
});

test('patient dashboard maps synchronous query failures to a GraphQL server error', async () => {
  db.query.mockImplementationOnce(() => { throw Error('bad query'); });
  await expect(Query._getPatientDashboardData(null, {}, ctx())).rejects.toThrow('Failed to fetch patient dashboard data');
});
