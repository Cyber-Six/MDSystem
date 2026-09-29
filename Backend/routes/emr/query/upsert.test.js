jest.mock('../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
jest.mock('../../../utils/validator', () => ({ normalizeName: jest.fn(() => 'Normalized Name'), normalizeNumber: jest.fn(() => '+639123456789') }));
const { query } = require('../../../config/query');
const { upsertEmergencyNumber } = require('./upsert');
beforeEach(() => query.mockReset());
test('reuses an existing normalized contact without inserting a duplicate', async () => {
  const row = { id: 12 };
  query.mockResolvedValue({ rows: [row] });
  await expect(upsertEmergencyNumber({ contactName: 'name', contactNumber: 'number' })).resolves.toBe(row);
  expect(query).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['+639123456789', 'Normalized Name', null]);
});
test.each([{}, { address: 'Manila', isVerified: true }])('inserts normalized contact with defaults %j', async optional => {
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 13 }] });
  await expect(upsertEmergencyNumber({ contactName: 'name', contactNumber: 'number', relationship: ' Parent ', ...optional })).resolves.toEqual({ id: 13 });
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO "EmergencyNumber"'), ['Normalized Name', 'Parent', '+639123456789', optional.address || null, optional.isVerified || false]);
});
