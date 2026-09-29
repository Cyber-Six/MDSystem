jest.mock('../../../../../config/query', () => ({ query: jest.fn() }));
const db = require('../../../../../config/query');
const helper = require('./helper');
const res = { status: jest.fn().mockReturnThis() };
beforeEach(() => db.query.mockReset());
test('returns existing active items', async () => {
  const item = { id: 12, category: 'Medicine', active: true };
  db.query.mockResolvedValue({ rows: [item] });
  await expect(helper.validateItemExists(12, res)).resolves.toBe(item);
  await expect(helper.validateItemActive(12, res)).resolves.toBe(item);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('MedicalItems'), [12]);
});
test('rejects missing and inactive items', async () => {
  db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ active: false }] });
  await expect(helper.validateItemExists(12, res)).rejects.toThrow('Medical item not found');
  expect(res.status).toHaveBeenCalledWith(404);
  await expect(helper.validateItemActive(12, res)).rejects.toThrow('Medical item is inactive');
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each(['SupplyBatch', 'MedicineBatch'])('resolves %s branch and missing batches', async table => {
  db.query.mockResolvedValueOnce({ rows: [{ location: 'Manila' }] }).mockResolvedValueOnce({ rows: [] });
  await expect(helper.batchIdToBranch(table, 12)).resolves.toBe('Manila');
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining(`FROM "${table}"`), [12]);
  await expect(helper.batchIdToBranch(table, 12)).resolves.toBeNull();
});
test('rejects untrusted batch table names before querying', async () => {
  await expect(helper.batchIdToBranch('other', 12)).rejects.toThrow('Invalid batch type');
  expect(db.query).not.toHaveBeenCalled();
});
