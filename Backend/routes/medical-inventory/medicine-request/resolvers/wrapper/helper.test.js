jest.mock('../../../../../config/query', () => ({ query: jest.fn() }));
const db = require('../../../../../config/query');
const helper = require('./helper');
let res;
const batch = { id: 2, active: true, expiryDate: '2031-01-01' };
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2030-01-01'));
  res = { status: jest.fn().mockReturnThis() };
});
afterEach(() => jest.useRealTimers());
test.each([[[]], [[{ id: 1 }]]])('reports whether a pending request exists: %j', async rows => {
  db.query.mockResolvedValue({ rows });
  await expect(helper.hasActiveRequest(8, res)).resolves.toBe(rows.length > 0);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("'Pending'"), [8]);
});
test.each(['validateBatchAvailable', 'validateBatchesAvailable'])('%s accepts an available batch with parameterized identifiers', async name => {
  db.query.mockResolvedValueOnce({ rows: [batch] }).mockResolvedValueOnce({ rows: [{ count: '4' }] });
  const args = name === 'validateBatchAvailable' ? [2, 4, res] : [[2], res];
  await expect(helper[name](...args)).resolves.toEqual(name === 'validateBatchAvailable' ? batch : undefined);
  expect(db.query.mock.calls[0]).toEqual([expect.stringContaining('MedicineBatch'), [2]]);
});
describe.each(['validateBatchAvailable', 'validateBatchesAvailable'])('%s', name => {
  test.each([
    [[], 'Medicine batch not found', 404],
    [[{ ...batch, active: false }], 'Medicine item is inactive', 400],
    [[{ ...batch, expiryDate: '2030-01-01' }], 'Medicine batch has expired', 400],
  ])('rejects invalid batches %j', async (rows, message, status) => {
    db.query.mockResolvedValue({ rows });
    const args = name === 'validateBatchAvailable' ? [2, 1, res] : [[2], res];
    await expect(helper[name](...args)).rejects.toThrow(message);
    expect(res.status).toHaveBeenLastCalledWith(status);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
test('rejects quantities exceeding unassigned stock', async () => {
  db.query.mockResolvedValueOnce({ rows: [batch] }).mockResolvedValueOnce({ rows: [{ count: '2' }] });
  await expect(helper.validateBatchAvailable(2, 3, res)).rejects.toThrow('Only 2 units available, requested 3');
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('"transactionId" IS NULL'), [2]);
});
test.each([[[], 'Medicine item not found', 404], [[{ id: 2, active: false }], 'Medicine item is inactive', 400]])('validates requested medicines before checking quantities', async (rows, message, status) => {
  db.query.mockResolvedValueOnce({ rows });
  await expect(helper.validateBatchesWithQuantity([{ batchId: 2, quantity: 3 }], 'Main', res)).rejects.toThrow(message);
  expect(res.status).toHaveBeenLastCalledWith(status);
  expect(db.query).toHaveBeenCalledTimes(1);
});
test.each([[[], 0], [[{ medicalItemId: 2, available: '2' }], 2]])('rejects insufficient branch stock %j', async (rows, count) => {
  db.query.mockResolvedValueOnce({ rows: [batch] }).mockResolvedValueOnce({ rows });
  await expect(helper.validateBatchesWithQuantity([{ batchId: 2, quantity: 3 }], 'Main', res)).rejects.toThrow(`Only ${count} units available, requested 3`);
});
test('checks multiple medicine quantities only against the requested branch', async () => {
  db.query.mockResolvedValueOnce({ rows: [batch, { id: 5, active: true }] }).mockResolvedValueOnce({ rows: [{ medicalItemId: 2, available: '3' }, { medicalItemId: 5, available: '4' }] });
  await expect(helper.validateBatchesWithQuantity([{ batchId: 2, quantity: 3 }, { batchId: 5, quantity: 2 }], 'Main', res)).resolves.toBeUndefined();
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('mb.location = $3'), [2, 5, 'Main']);
});
test.each([[[], null], [[{ patientId: 7 }], 7], [[{ patientId: null }], null]])('looks up request ownership %j', async (rows, expected) => {
  db.query.mockResolvedValue({ rows });
  await expect(helper.getPatientIdByRequestId(12)).resolves.toBe(expected);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('MedicineRequestLog'), [12]);
});
test.each([
  ['hasActiveRequest', [8]], ['validateBatchAvailable', [2, 1]],
  ['validateBatchesAvailable', [[2]]], ['validateBatchesWithQuantity', [[{ batchId: 2, quantity: 1 }], 'Main']],
  ['getPatientIdByRequestId', [12]],
])('%s propagates database errors', async (name, args) => {
  db.query.mockRejectedValue(new Error('database offline'));
  await expect(helper[name](...args, res)).rejects.toThrow('database offline');
});
