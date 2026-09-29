jest.mock('../../../config/query', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => require('../../../test-support/fixtures.cjs').loggerMock());
jest.mock('dotenv', () => ({ config: jest.fn() }));
const db = require('../../../config/query');
const helpers = require('./helper');
test.each([
  ['getPatientIdFromvitalSignsId', 'VitalSigns'], ['getPatientIdFromDentalRecordId', 'DentalRecord'],
])('resolves ownership from %s and returns null when missing', async (method, table) => {
  db.query.mockReset().mockResolvedValueOnce({ rows: [{ patientId: 12 }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ patientId: null }] });
  await expect(helpers[method](8)).resolves.toBe(12);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining(`FROM "${table}"`), [8]);
  await expect(helpers[method](8)).resolves.toBeNull();
  await expect(helpers[method](8)).resolves.toBeNull();
});
