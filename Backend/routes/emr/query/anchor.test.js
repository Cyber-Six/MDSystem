jest.mock('../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
const { query } = require('../../../config/query');
const anchors = require('./anchor');
const { decodeOralApplianceNotes } = require('../custom-choice-storage');
beforeEach(() => query.mockReset());
test.each(['MaintenanceMedication', 'OralAppliance', 'DentalRecord'])('creates a %s anchor with optional notes', async table => {
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
test.each(['VisualAcuity', 'MedicalHistory', 'Hospitalization', 'Operation', 'Immunization', 'DentalProcedure', 'Allergy'])('creates a %s anchor without writing an unsupported notes column', async table => {
  query.mockResolvedValue({ rows: [{ id: 12 }] });
  await expect(anchors[table](12, 'ignored profile note')).resolves.toEqual({ id: 12 });
  const [sql, values] = query.mock.calls[0];
  expect(sql).toContain(`INSERT INTO "${table}" ("id")`);
  expect(sql).not.toContain('"notes"');
  expect(sql).toContain('DO NOTHING');
  expect(values).toEqual([12]);
});
test('propagates storage failures', async () => {
  query.mockRejectedValue(new Error('unavailable'));
  await expect(anchors.Allergy(12)).rejects.toThrow('unavailable');
});

test('stores oral appliance custom fields in the existing notes column', async () => {
  query.mockResolvedValue({ rows: [{ id: 12 }] });
  await anchors.OralAppliance(12, null, { otherDescription: 'Custom guard', otherArch: 'Upper' });
  const stored = query.mock.calls.at(-1)[1][1];
  expect(decodeOralApplianceNotes(stored)).toEqual({ notes: null, otherDescription: 'Custom guard', otherArch: 'Upper' });

  await anchors.OralAppliance(12, 'patient note', { otherDescription: null, otherArch: null });
  expect(query.mock.calls.at(-1)[1]).toEqual([12, 'patient note']);
});
