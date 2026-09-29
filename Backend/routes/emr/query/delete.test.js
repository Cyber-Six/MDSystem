jest.mock('../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
const { query } = require('../../../config/query');
const deletion = require('./delete');
beforeEach(() => query.mockReset());
test.each([
  ['VisualAcuityRecord', 'id'], ['MedicalCondition', 'medicalHistoryId'], ['MedicationRecord', 'medicationId'],
  ['HospitalizationRecord', 'hospitalizationId'], ['OperationRecord', 'operationId'], ['ImmunizationRecord', 'immunizationId'],
  ['DentalProcedureRecord', 'dentalProcedureId'], ['AllergyRecord', 'allergyId'], ['OralApplianceRecord', 'applianceId'],
])('deletes %s using its parent key %s', async (table, key) => {
  query.mockResolvedValue({ rows: [{ id: 12 }] });
  await expect(deletion[table](12)).resolves.toEqual({ success: true, record: { id: 12 } });
  expect(query).toHaveBeenCalledWith(expect.stringContaining(`DELETE FROM "${table}"`), [12]);
  expect(query.mock.calls[0][0]).toContain(`WHERE "${key}" = $1`);
});
test('reports missing records and propagates storage failures', async () => {
  query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('unavailable'));
  await expect(deletion.AllergyRecord(12)).resolves.toEqual({ success: false, reason: 'NOT_FOUND', detail: 'No record with id 12' });
  await expect(deletion.AllergyRecord(12)).rejects.toThrow('unavailable');
});
