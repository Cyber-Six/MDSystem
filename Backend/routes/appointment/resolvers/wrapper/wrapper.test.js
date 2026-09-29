jest.mock('../../../../config/query.js', () => ({ query: jest.fn(), connect: jest.fn(), getUserBranch: jest.fn(), getUserPatientType: jest.fn() }));
jest.mock('../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`GraphQL ${c.status.mock.lastCall[0]}: ${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('./helper.js', () => ({ decodeSchedulingFlags: jest.fn(flags => flags ? ['Monday'] : []), encodeSchedulingFlags: jest.fn(), validateSchedulerDate: jest.fn(), getAppointmentCounts: jest.fn(), isWithinFutureTimeframe: jest.fn(), validateSatisfiedAllRequirements: jest.fn(), insertSlotCustomDates: jest.fn(), insertSchedulerWhitelist: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../../config/query.js');
const { Query, Mutation } = require('./wrapper.js');
const helper = require('./helper.js');

beforeEach(() => jest.clearAllMocks());

test('lists open patient appointments with branch, patient type, paging, and decoded days', async () => {
  db.getUserBranch.mockResolvedValue('Manila'); db.getUserPatientType.mockResolvedValue('Student');
  db.query.mockResolvedValue({ rows: [{ id: 4, scheduleFlags: 1 }, { id: 5, scheduleFlags: 0 }] });
  const rows = await Query._listOpenAppointments(null, { user: undefined, offset: 2, limit: 3 }, { user: { id: 9 }, res: {} });
  expect(rows).toEqual([{ id: 4, scheduleFlags: 1, schedulePerWeek: ['Monday'] }, { id: 5, scheduleFlags: 0, schedulePerWeek: [] }]);
  expect(db.query.mock.calls[0][1]).toEqual([9, 3, 2, 'Manila', 'Student', null]);
  expect(helper.decodeSchedulingFlags).toHaveBeenCalledTimes(2);
});

test('requires a user and uses pagination defaults and an optional scheduler ID', async () => {
  await expect(Query._listOpenAppointments(null, { offset: 0, limit: 0 }, { user: null, res: {} })).rejects.toThrow('GraphQL 401: Unauthorized');
  db.getUserBranch.mockResolvedValue('Both'); db.getUserPatientType.mockResolvedValue(null); db.query.mockResolvedValue({ rows: [] });
  await expect(Query._listOpenAppointments(null, { schedulerId: 7 }, { user: { id: 2 }, res: {} })).resolves.toEqual([]);
  expect(db.query.mock.calls[0][1]).toEqual([2, 10, 0, 'Both', null, 7]);
});

test.each([
  ...Object.entries(Query).map(([name, resolver]) => ['Query', name, resolver]),
  ...Object.entries(Mutation).map(([name, resolver]) => ['Mutation', name, resolver]),
])('%s.%s rejects unauthenticated callers before touching storage', async (_group, _name, resolver) => {
  await expect(resolver(null, {}, { user: null, res: {} })).rejects.toThrow('GraphQL 401: Unauthorized');
  expect(db.query).not.toHaveBeenCalled();
});

test.each([
  ['_listOpenAppointments', { schedulerId: 1, limit: 5, offset: 0 }],
  ['_listAllOpenAppointments', { location: 'Manila', staffBranch: 'Both' }],
  ['_listCustomDates', { schedulerId: 1 }],
  ['_listAppointmentSchedule', { schedulerId: 1, date: '2026-10-02', skipTimeframe: true }],
  ['_listAllAppointmentRequirements', { schedulerId: 1 }],
  ['_getUserAppointmentRecords', { userId: 9 }],
  ['_getUserAppointmentStatus', { userId: 9 }],
  ['_searchAppointmentStatuses', { status: 'Pending', location: 'Manila', searchTerm: 'Ada Lovelace', date: '2026-10-02', schedulerId: '1' }],
  ['_getAppointmentStatusCounts', { location: 'Manila', schedulerId: '1', date: '2026-10-02' }],
  ['_listSchedulerWhitelist', { schedulerId: 1 }],
  ['_checkDateOccupancy', { schedulerId: 1, date: '2026-10-02' }],
])('%s reaches its authenticated empty-state behavior', async (name, args) => {
  db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  if (name === '_listAppointmentSchedule') {
    await expect(Query[name](null, args, { user: { id: 9 }, res: {} })).rejects.toThrow('GraphQL 404: Scheduler not found');
    return;
  }
  const result = await Query[name](null, args, { user: { id: 9 }, res: {} });
  if (name === '_getUserAppointmentStatus') {
    expect(result).toBeNull();
  } else if (name === '_checkDateOccupancy') {
    expect(result).toEqual({ count: 0 });
  } else {
    expect(result).toEqual([]);
  }
});

test('lists month availability in a transaction and releases its client', async () => {
  const client = { query: jest.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ morningAllowed: true, afternoonAllowed: false }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [{ id: 8, morningAllowed: true }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 1 }), release: jest.fn() };
  db.connect.mockResolvedValue(client);
  await expect(Query._listMonthAvailability(null, { schedulerId: 2, startDate: '2026-10-01', endDate: '2026-10-31' }, { user: { id: 9 }, res: {} })).resolves.toEqual([{ id: 8, morningAllowed: true }]);
  expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
  expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  expect(client.release).toHaveBeenCalled();
});
