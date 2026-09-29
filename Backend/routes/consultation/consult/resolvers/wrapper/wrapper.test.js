jest.mock('../../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../../config/icdapi/icdmain.js', () => ({ GetIcd: jest.fn(), GetTitle: jest.fn(), getIcdDetails: jest.fn() }));
jest.mock('../../../../../utils/graphql-helper.js', () => ({
  GraphQLError: class GraphQLError extends Error {},
  throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`GraphQL ${c.status.mock.lastCall[0]}: ${c.message.mock.lastCall[0]}`); }); return c; }),
}));
jest.mock('../../../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('./helper.js', () => ({ getLatestOutcome: jest.fn(), getOutcomeData: jest.fn(), groupByOutcome: jest.fn(result => Object.fromEntries(result.rows.map(row => [row.outcomeId, [...(Object.fromEntries(result.rows.map(r => [r.outcomeId, []]))[row.outcomeId] || []), row]]))) }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../../../config/query.js');
const helper = require('./helper.js');
const icd = require('../../../../../config/icdapi/icdmain.js');
const { Query } = require('./wrapper.js');

beforeEach(() => jest.clearAllMocks());

test('returns consultations with pagination and translates database failures', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
  await expect(Query._getConsultations(null, { patientId: 8 }, { user: { id: 8 }, res: {} })).resolves.toEqual([{ id: 1 }]);
  expect(db.query.mock.calls[0][1]).toEqual([8, 0, 10]);
  db.query.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(Query._getConsultations(null, { patientId: 8 }, { user: { id: 8 }, res: {} })).rejects.toThrow('GraphQL 500: Failed to fetch consultations');
});

test('rejects unauthenticated consultation requests and returns no outcomes for an empty result', async () => {
  await expect(Query._getConsultations(null, { patientId: 1 }, { user: null, res: {} })).rejects.toThrow('GraphQL 401: Unauthorized');
  await expect(Query._getOutcomes(null, { consultationId: 2 }, { user: null, res: {} })).rejects.toThrow('GraphQL 401: Unauthorized');
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query._getOutcomes(null, { consultationId: 2 }, { user: { id: 1 }, res: {} })).resolves.toEqual([]);
});

test('loads and enriches consultation outcomes and delegates ICD and outcome data lookups', async () => {
  const outcome = { id: 3 };
  db.query.mockResolvedValueOnce({ rows: [outcome] })
    .mockResolvedValueOnce({ rows: [{ outcomeId: 3, value: 'pain' }] })
    .mockResolvedValueOnce({ rows: [{ outcomeId: 3, value: 'normal' }] })
    .mockResolvedValueOnce({ rows: [{ outcomeId: 3, value: 'rest' }] })
    .mockResolvedValueOnce({ rows: [{ outcomeId: 3, value: 'diagnosis' }] });
  helper.groupByOutcome.mockImplementation(result => ({ 3: result.rows }));
  const res = { status: jest.fn() };
  await expect(Query._getOutcomes(null, { consultationId: 3 }, { user: { id: 1 }, res })).resolves.toEqual([{ id: 3, complaints: [{ outcomeId: 3, value: 'pain' }], peFindings: [{ outcomeId: 3, value: 'normal' }], treatments: [{ outcomeId: 3, value: 'rest' }], diagnoses: [{ outcomeId: 3, value: 'diagnosis' }] }]);
  helper.getOutcomeData.mockResolvedValue(['item']);
  await expect(Query._getComplaints(null, { outcomeId: 3 }, { user: { id: 1 }, res })).resolves.toEqual(['item']);
  await expect(Query._getPEFindings(null, { outcomeId: 3 }, { user: { id: 1 }, res })).resolves.toEqual(['item']);
  icd.GetIcd.mockResolvedValue(['icd']); icd.GetTitle.mockResolvedValue(['title']); icd.getIcdDetails.mockResolvedValue({ id: 3 });
  await expect(Query._getIcdViaCode(null, { code: 'A00' }, { user: { id: 1 }, res })).resolves.toEqual(['title']);
  await expect(Query._getIcdViaTitle(null, { title: 'flu' }, { user: { id: 1 }, res })).resolves.toEqual(['icd']);
  await expect(Query._getIcdDetails(null, { id: 3 }, { user: { id: 1 }, res })).resolves.toEqual({ id: 3 });
});
