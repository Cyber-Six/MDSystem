jest.mock('../../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('./helper.js', () => ({ validateItemActive: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../../../config/sockets', () => ({ emitToRole: jest.fn() }));

const db = require('../../../../../config/query.js');
const { Query } = require('./wrapper.js');

beforeEach(() => jest.clearAllMocks());

test('lists and fetches medical items using filters and returns null when an item is absent', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, item_name: 'Gauze' }] });
  await expect(Query._getMedicalItems(null, { category: 'Supply', active: true, offset: 4, limit: 6 }, { res: {} })).resolves.toEqual([{ id: 1, item_name: 'Gauze' }]);
  expect(db.query.mock.calls[0][1]).toEqual(['Supply', true, 4, 6]);
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query._getMedicalItem(null, { id: 9 }, { res: {} })).resolves.toBeNull();
});

test('requires boolean stock filters and queries inventory supplies and batches', async () => {
  await expect(Query._getMedicalSupply(null, { medicalItemId: 1 }, { res: {} })).rejects.toThrow('400:Invalid value for availableOnly');
  db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValueOnce({ rows: [{ id: 3 }] });
  await expect(Query._getMedicalSupply(null, { medicalItemId: 1, location: 'Manila', availableOnly: true }, { res: {} })).resolves.toEqual([{ id: 2 }]);
  await expect(Query._getSupplyBatches(null, { supplyItemId: 5, availableOnly: false }, { res: {} })).resolves.toEqual([{ id: 3 }]);
  expect(db.query.mock.calls[0][1]).toEqual([1, 'Manila', true, 0, 20]);
  expect(db.query.mock.calls[1][1]).toEqual([5, undefined, false, 0, 20]);
});
