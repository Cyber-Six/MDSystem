jest.mock('../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
const { query } = require('../../../config/query');
const anchors = require('./anchor');
beforeEach(() => query.mockReset());
test.each(['VisualAcuity', 'MaintenanceMedication', 'MedicalHistory', 'Hospitalization', 'Operation', 'Immunization', 'DentalProcedure', 'Allergy', 'OralAppliance', 'DentalRecord'])('creates a %s anchor with optional notes', async table => {
  const row = { id: 12, notes: 'note' };
  query.mockResolvedValue({ rows: [row] });
  await expect(anchors[table](12, 'note')).resolves.toBe(row);
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining(`INSERT INTO "${table}"`), [12, 'note']);
  expect(query.mock.calls[0][0]).toContain('DO UPDATE');
  await anchors[table](12);
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('DO NOTHING'), [12]);
  await anchors[table](12, null);
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining(`INSERT INTO "${table}"`), [12, null]);
  expect(query.mock.calls.at(-1)[0]).toContain('SET "notes" = EXCLUDED."notes"');
});
test('propagates storage failures', async () => {
  query.mockRejectedValue(new Error('unavailable'));
  await expect(anchors.Allergy(12)).rejects.toThrow('unavailable');
});

test('persists and clears the oral appliance custom fields and notes', async () => {
  query.mockResolvedValue({ rows: [{ id: 12, notes: null, otherDescription: 'Custom guard', otherArch: 'Upper' }] });
  await anchors.OralAppliance(12, null, { otherDescription: 'Custom guard', otherArch: 'Upper' });
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('"otherDescription" = EXCLUDED."otherDescription"'), [12, null, 'Custom guard', 'Upper']);

  await anchors.OralAppliance(12, null, { otherDescription: null, otherArch: null });
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('"otherArch" = EXCLUDED."otherArch"'), [12, null, null, null]);
});
