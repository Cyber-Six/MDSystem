jest.mock('../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const db = require('../../../../config/query.js');
const helper = require('./helper.js');
const errorResponse = () => ({ status: jest.fn() });

beforeEach(() => jest.clearAllMocks());

test('encodes unique valid days, rejects invalid days, and decodes every scheduling bit', () => {
  expect(helper.encodeSchedulingFlags(['Monday', 'Wednesday', 'Monday'])).toBe(5);
  expect(helper.encodeSchedulingFlags(['Funday'])).toBe(-1);
  expect(helper.decodeSchedulingFlags(127)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  expect(helper.decodeSchedulingFlags(0)).toEqual([]);
});

test('scheduler date checks missing schedules, custom exclusion/inclusion, and weekly fallback', async () => {
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(false);
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ scheduleFlags: 1 }] }).mockResolvedValueOnce({ rowCount: 1, rows: [{ type: 'Exclude' }] });
  expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(false);
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ scheduleFlags: 0 }] }).mockResolvedValueOnce({ rowCount: 1, rows: [{ type: 'Include' }] });
  expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(true);
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ scheduleFlags: 1 }] }).mockResolvedValueOnce({ rowCount: 1, rows: [{ type: 'Other' }] });
  expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(true);
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ scheduleFlags: 1 }] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
  expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(true);
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ scheduleFlags: 0 }] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
  expect(await helper.validateSchedulerDate(8, '2026-09-28')).toBe(false);
});

test('appointment count query returns database aggregation', async () => {
  const counts = { morningRegistered: 1, morningPending: 0 };
  db.query.mockResolvedValueOnce({ rows: [counts] }); expect(await helper.getAppointmentCounts(3, '2026-09-28')).toBe(counts);
});

test('future timeframe includes today and its upper bound but excludes past and later days', () => {
  const today = new Date(); const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const past = new Date(today); past.setDate(today.getDate() - 1);
  const edge = new Date(today); edge.setDate(today.getDate() + 7);
  const future = new Date(today); future.setDate(today.getDate() + 8);
  expect(helper.isWithinFutureTimeframe(format(today), 7)).toBe(true);
  expect(helper.isWithinFutureTimeframe(format(edge), 7)).toBe(true);
  expect(helper.isWithinFutureTimeframe(format(past), 7)).toBe(false);
  expect(helper.isWithinFutureTimeframe(format(future), 7)).toBe(false);
});

test('requirement validation accepts exact sets and rejects unexpected or missing IDs', async () => {
  const response = errorResponse();
  db.query.mockResolvedValueOnce({ rows: [] }); expect(await helper.validateSatisfiedAllRequirements(1, null, response)).toBe(true);
  db.query.mockResolvedValueOnce({ rows: [] }); await expect(helper.validateSatisfiedAllRequirements(1, [{ scheduleRequirementId: 2 }], response)).rejects.toThrow('No requirements expected');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }); await expect(helper.validateSatisfiedAllRequirements(1, [{ scheduleRequirementId: 1 }], response)).rejects.toThrow('Missing required IDs: 2');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); await expect(helper.validateSatisfiedAllRequirements(1, [{ scheduleRequirementId: 1 }, { scheduleRequirementId: 3 }], response)).rejects.toThrow('Unexpected IDs provided: 3');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); expect(await helper.validateSatisfiedAllRequirements(1, [{ scheduleRequirementId: 1 }], response)).toBe(true);
});

test('bulk inserts validate input and generate parameterized dates and whitelist rows', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
  await expect(helper.insertSlotCustomDates(5, [], client)).rejects.toThrow('Dates array must not be empty');
  await expect(helper.insertSlotCustomDates(5, null, client)).rejects.toThrow('Dates array must not be empty');
  await helper.insertSlotCustomDates(5, ['2026-10-01', { scheduledDate: '2026-10-02', type: 'Exclude' }, { scheduledDate: '2026-10-03' }], client);
  expect(client.query.mock.calls[0][1]).toEqual([5, '2026-10-01', 'Include', 5, '2026-10-02', 'Exclude', 5, '2026-10-03', 'Include']);
  await expect(helper.insertSchedulerWhitelist(4, [], client)).rejects.toThrow('patientIds array must not be empty');
  await expect(helper.insertSchedulerWhitelist(4, 'not-array', client)).rejects.toThrow('patientIds array must not be empty');
  await helper.insertSchedulerWhitelist(4, ['a', 'b'], client); expect(client.query.mock.calls[1][1]).toEqual([4, 'a', 'b']);
});

test('lookup helpers return values and report missing scheduler or slot', async () => {
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ location: 'Manila' }] }); expect(await helper.getBranchFromShedulerId(1)).toBe('Manila');
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); await expect(helper.getBranchFromShedulerId(2)).rejects.toThrow('Scheduler not found');
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ patientId: 6 }] }); expect(await helper.getPatientIdFromSlotId(7)).toBe(6);
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); await expect(helper.getPatientIdFromSlotId(8)).rejects.toThrow('Slot not found');
  db.query.mockResolvedValueOnce({ rows: [{ userId: 10 }] }); expect(await helper.getUserIDViaIdentifier('p1', 'Manila')).toEqual([{ userId: 10 }]);
});
