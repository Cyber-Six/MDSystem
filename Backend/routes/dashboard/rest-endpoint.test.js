const mockRouter = { get: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('../../config/query.js', () => ({ getUserBranch: jest.fn(), query: jest.fn() }));
jest.mock('../../config/middleware/jwtProtect', () => ({ jwtProtect: jest.fn(() => 'medical-auth') }));
jest.mock('../../utils/logger', () => ({ error: jest.fn() }));

const db = require('../../config/query.js');
const logger = require('../../utils/logger');
require('./rest-endpoint.js');
const handler = mockRouter.get.mock.calls[0][2];
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const rows = (...items) => ({ rows: items });

beforeEach(() => jest.clearAllMocks());

test('scopes nine queries to the staff branch and aggregates populated counts and availability', async () => {
  db.getUserBranch.mockResolvedValue('Manila');
  const results = [rows({ count: 2 }), rows({ count: 3 }), rows({ count: 4 }), rows({ count: 5 }), rows({ count: 6 }), rows({ total: 7, remaining: 1 }), rows(
    { label: 'Clinic', morningAllowed: '2', afternoonAllowed: '3', morningBooked: '1', afternoonBooked: '1' },
    { label: 'Clinic', morningAllowed: '1', afternoonAllowed: '0', morningBooked: '3', afternoonBooked: '0' },
    { location: 'QuezonCity', morningAllowed: '1', afternoonAllowed: '1', morningBooked: '0', afternoonBooked: '0' },
    { morningAllowed: null, afternoonAllowed: null, morningBooked: null, afternoonBooked: null }
  ), rows({ id: 1, name: ' Jane Doe ', identifier: 'A', profile: 'Student', lastVisit: 'now' }, { id: 2, name: null, identifier: 'B' }), rows({ id: 9, name: ' Person ', type: 'EMR', status: 'Pending', submitted: 'today' }, { id: 10, name: null })];
  db.query.mockImplementation(() => Promise.resolve(results.shift()));
  const res = response(); await handler({ user: { id: 42 } }, res);
  expect(db.getUserBranch).toHaveBeenCalledWith(42);
  expect(db.query).toHaveBeenCalledTimes(9);
  expect(db.query.mock.calls[0][1]).toEqual(['Manila']);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    stats: { pendingRequests: 9, pendingBreakdown: { emr: 2, appointments: 3, medicine: 4 }, todayAppointments: 7, todayRemaining: 1, activeConsultations: 5, lowStockItems: 6 },
    tomorrowAvailability: { Clinic: { total: 6, open: 3 }, QuezonCity: { total: 2, open: 2 }, Other: { total: 0, open: 0 } },
    recentPatients: [{ id: 1, name: 'Jane Doe', identifier: 'A', program: 'Student', lastVisit: 'now' }, { id: 2, name: undefined, identifier: 'B', program: '—', lastVisit: undefined }]
  }));
  expect(res.json.mock.calls[0][0].pendingRequests[0].name).toBe('Person');
  expect(res.json.mock.calls[0][0].pendingRequests[1].name).toBeUndefined();
});

test('empty database rows produce zero counts and empty lists', async () => {
  db.getUserBranch.mockResolvedValue('Both'); db.query.mockImplementation(() => Promise.resolve(rows()));
  const res = response(); await handler({ user: { id: 1 } }, res);
  expect(res.json).toHaveBeenCalledWith({
    stats: { pendingRequests: 0, pendingBreakdown: { emr: 0, appointments: 0, medicine: 0 }, todayAppointments: 0, todayRemaining: 0, activeConsultations: 0, lowStockItems: 0 },
    tomorrowAvailability: {}, recentPatients: [], pendingRequests: []
  });
});

test('database failure returns a server error without leaking details', async () => {
  db.getUserBranch.mockResolvedValue('Manila'); db.query.mockRejectedValue(Error('database unavailable'));
  const res = response(); await handler({ user: { id: 1 } }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch dashboard statistics' });
  expect(logger.error).toHaveBeenCalledWith('Error fetching dashboard stats:', expect.any(Error));
});
