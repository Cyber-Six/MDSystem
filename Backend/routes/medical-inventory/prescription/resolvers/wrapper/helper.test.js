jest.mock('../../../../../config/query', () => ({ query: jest.fn() }));
const db = require('../../../../../config/query');
const { validateBatchAvailable, validateBatchesWithQuantity } = require('./helper');
const res = { status: jest.fn().mockReturnThis() };
beforeEach(() => { db.query.mockReset(); jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z')); });
afterEach(() => jest.useRealTimers());
const valid = { id: 12, active: true, expiryDate: '2027-01-01', available: '5' };
test.each([
  [[], 'Medicine batch not found', 404], [[{ ...valid, active: false }], 'Medicine item is inactive', 400],
  [[{ ...valid, expiryDate: '2026-01-01' }], 'Medicine batch has expired', 400],
])('rejects unavailable batch %j', async (rows, message, status) => {
  db.query.mockResolvedValue({ rows });
  await expect(validateBatchAvailable(12, res)).rejects.toThrow(message);
  await expect(validateBatchesWithQuantity([{ batchId: 12, quantity: 1 }], res)).rejects.toThrow(message);
  expect(res.status).toHaveBeenCalledWith(status);
});
test('accepts nonexpired batches and available stock', async () => {
  db.query.mockResolvedValue({ rows: [valid] });
  await expect(validateBatchAvailable(12, res)).resolves.toBe(valid);
  await expect(validateBatchesWithQuantity([{ batchId: 12, quantity: 5 }], res)).resolves.toBeUndefined();
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('WHERE mb.id IN ($1)'), [12]);
  await expect(validateBatchesWithQuantity([{ batchId: 12, quantity: 6 }], res)).rejects.toThrow('Only 5 units available, requested 6');
});
test.each([null, []])('rejects empty prescription %j', async items => {
  await expect(validateBatchesWithQuantity(items, res)).rejects.toThrow('At least one medicine item is required');
  expect(db.query).not.toHaveBeenCalled();
});
