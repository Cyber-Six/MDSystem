jest.mock('../../../config/query', () => ({ query: jest.fn() }));
const db = require('../../../config/query');
const { validateUpdateTicket } = require('./record-validator');
beforeEach(() => db.query.mockReset());
test.each(['Medical', 'Dental', 'Both'])('checks missing and complete records for %s tickets', async scope => {
  db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ first: null, second: 'RequiredRecord' }] }).mockResolvedValueOnce({ rows: [{ first: null }] });
  await expect(validateUpdateTicket(12, scope)).resolves.toEqual(['patientUpdateLog']);
  await expect(validateUpdateTicket(12, scope)).resolves.toEqual(['RequiredRecord']);
  await expect(validateUpdateTicket(12, scope)).resolves.toEqual([]);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE pul.id = $1'), [12]);
  const sql = db.query.mock.calls[0][0];
  if (scope !== 'Dental') expect(sql).toContain('MedicalHistory');
  if (scope !== 'Medical') expect(sql).toContain('DentalHistory');
});
test('defaults to combined validation and rejects unknown scopes', async () => {
  db.query.mockResolvedValue({ rows: [] });
  await validateUpdateTicket(12);
  expect(db.query.mock.calls[0][0]).toContain('EmergencyContact');
  await expect(validateUpdateTicket(12, 'invalid')).rejects.toThrow('Unknown scope');
});
