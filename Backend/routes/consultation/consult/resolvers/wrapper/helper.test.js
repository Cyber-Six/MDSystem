jest.mock('../../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../../../config/query.js');
const logger = require('../../../../../utils/logger.js');
const { getLatestOutcome, getOutcomeData, groupByOutcome, getPatientIdFromConsultationId, getPatientIdFromOutcomeId } = require('./helper.js');

beforeEach(() => jest.clearAllMocks());

test('latest consultation outcome returns newest row or null', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await getLatestOutcome(4)).toEqual({ id: 2 });
  expect(db.query.mock.calls[0][1]).toEqual([4]);
  expect(await getLatestOutcome(4)).toBeNull();
});

test('outcome rows use requested pagination and map database failure to a GraphQL 500', async () => {
  const res = { status: jest.fn().mockReturnThis() };
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
  expect(await getOutcomeData('ConsultationTreatment', 8, undefined, undefined, res)).toEqual([{ id: 1 }]);
  expect(db.query.mock.calls[0][0]).toContain('"ConsultationTreatment"');
  expect(db.query.mock.calls[0][1]).toEqual([8, 0, 10]);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await getOutcomeData('ConsultationDiagnosis', 8, 5, 2, res)).toEqual([]);
  expect(db.query.mock.calls[1][1]).toEqual([8, 5, 2]);
  db.query.mockRejectedValueOnce(Error('database offline'));
  await expect(getOutcomeData('ConsultationTreatment', 8, 0, 10, res)).rejects.toThrow('Failed to fetch ConsultationTreatment');
  expect(res.status).toHaveBeenCalledWith(500);
  expect(logger.error).toHaveBeenCalledWith('Error fetching ConsultationTreatment: database offline');
});

test('groups rows under outcome IDs while preserving row order and handles empty results', () => {
  const first = { outcomeId: 3, id: 1 }; const second = { outcomeId: 3, id: 2 }; const third = { outcomeId: 4, id: 3 };
  expect(groupByOutcome({ rows: [first, second, third] })).toEqual({ 3: [first, second], 4: [third] });
  expect(groupByOutcome({ rows: [] })).toEqual({});
});

test('patient lookups return identifiers and null for missing consultations or outcomes', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ patientId: 7 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await getPatientIdFromConsultationId(5)).toBe(7);
  expect(db.query.mock.calls[0][1]).toEqual([5]);
  expect(await getPatientIdFromConsultationId(6)).toBeNull();
  db.query.mockResolvedValueOnce({ rows: [{ patientId: 9 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await getPatientIdFromOutcomeId(10)).toBe(9);
  expect(db.query.mock.calls[2][1]).toEqual([10]);
  expect(await getPatientIdFromOutcomeId(11)).toBeNull();
});
