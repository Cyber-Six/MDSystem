jest.mock('../../config/query.js', () => ({ query: jest.fn(), isPatientValidated: jest.fn(), setExpiredUpdateTickets: jest.fn() }));
jest.mock('../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../utils/logger.js', () => ({ debug: jest.fn(), error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../config/query.js');
const { Query } = require('./patient-resolverquery.js');

beforeEach(() => jest.clearAllMocks());

test('returns profile and update ticket for the authenticated patient', async () => {
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query.getProfile(null, {}, { user: { id: 5 }, logId: 2 })).resolves.toEqual({ id: '1', program: 'BSCS', year: 'FIRST' });
  expect(db.query).toHaveBeenCalledWith('', [5, 2]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 10, status: 'Pending' }] });
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 5 }, res: {} })).resolves.toBe(10);
});

test('rejects missing user context and returns null when no update ticket exists', async () => {
  await expect(Query.getUpdateTicket(null, {}, { user: null, res: {} })).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 5 }, res: {} })).resolves.toBeUndefined();
});

const historyQueries = [
  'getUserDentalPhotos', 'getUserObgynHistory', 'getUserLifestyle', 'getUserDentalHistory',
  'getUserOralApplianceProfile', 'getUserEmergencyContact', 'getUserAllergyProfile',
  'getUserMedicationProfile', 'getUserDentalProcedureProfile', 'getUserImmunizationProfile',
  'getUserOperationProfile', 'getUserHospitalizationProfile', 'getUserMedicalHistory',
  'getUserVisualAcuityProfile',
];

test.each(historyQueries)('%s applies optional range/scope/status pagination and accepts an unfiltered empty result', async name => {
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query[name](null, { id: 5, from: '2025-01-01', to: '2025-12-31', scope: 'patient', statuses: ['Approved'], offset: 2, limit: 8 }, { user: { id: 7 }, res: {} })).resolves.toEqual([]);
  expect(db.query.mock.calls[0][1]).toEqual([5, '2025-01-01', '2025-12-31', 'patient', ['Approved'], 2, 8]);
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query[name](null, { id: 5 }, { user: { id: 7 }, res: {} })).resolves.toEqual([]);
  expect(db.query.mock.calls[1][1]).toEqual([5]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 9, upperTeeth: 'U', lowerTeeth: 'L', isValid: true, notes: 'notes', conditions: 'condition', status: 'Active' }] });
  await expect(Query[name](null, { id: 5 }, { user: { id: 7 }, res: {} })).resolves.toHaveLength(1);
});

test.each(['getProfile', 'getUpdateTicket', 'getUserProfile', ...historyQueries])('%s rejects an unauthenticated patient with the GraphQL unauthorized response', async name => {
  await expect(Query[name](null, { id: 5 }, { user: null, res: {} })).rejects.toThrow('401:Unauthorized');
});

test('maps only supported profile types and returns each patient history row shape', async () => {
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query.getUserProfile(null, { id: 5, from: 'from', to: 'to', offset: 1, limit: 4, scope: 'patient', statuses: ['Approved'] }, { user: { id: 7 }, res: {} })).resolves.toEqual([]);
  expect(db.query.mock.calls[0][1]).toEqual([5, 'from', 'to', 'patient', ['Approved'], 1, 4]);
  db.query.mockResolvedValueOnce({ rows: [
    { id: 1, profile_type: 'Student', program: 'BSCS', year: 'FIRST' },
    { id: 2, profile_type: 'Employee', department: 'IT', role: 'Nurse', position: 'Staff' },
    { id: 3, profile_type: 'Unknown' },
  ] });
  await expect(Query.getUserProfile(null, { id: 5 }, { user: { id: 7 }, res: {} })).resolves.toEqual([
    { id: 1, program: 'BSCS', year: 'FIRST', archived_at: null },
    { id: 2, department: 'IT', role: 'Nurse', position: 'Staff', archived_at: null },
  ]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 4, upperTeeth: 'U', lowerTeeth: 'L', isValid: true }] });
  await expect(Query.getUserDentalPhotos(null, { id: 5 }, { user: { id: 7 }, res: {} })).resolves.toEqual([{ id: 4, upperTeeth: 'U', lowerTeeth: 'L', isValid: true, archived_at: null }]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 6, notes: 'notes', visualAcuity: '20/20' }] });
  await expect(Query.getUserVisualAcuityProfile(null, { id: 5 }, { user: { id: 7 }, res: {} })).resolves.toEqual([{ id: 6, notes: 'notes', visualAcuity: '20/20', archived_at: null }]);
});

test('returns in-progress tickets until expiry and marks stale validated tickets expired', async () => {
  const recent = new Date().toISOString();
  db.query.mockResolvedValueOnce({ rows: [{ id: 10, status: 'InProgress', created_at: recent }] });
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 5 }, res: {} })).resolves.toBe(10);
  expect(db.isPatientValidated).not.toHaveBeenCalled();
  db.query.mockResolvedValueOnce({ rows: [{ id: 11, status: 'InProgress', created_at: '2000-01-01T00:00:00Z' }] });
  db.isPatientValidated.mockResolvedValueOnce(false);
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 5 }, res: {} })).resolves.toBe(11);
  expect(db.setExpiredUpdateTickets).not.toHaveBeenCalled();
  db.query.mockResolvedValueOnce({ rows: [{ id: 12, status: 'InProgress', created_at: '2000-01-01T00:00:00Z' }] });
  db.isPatientValidated.mockResolvedValueOnce(true);
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 5 }, res: {} })).resolves.toBe(12);
  expect(db.setExpiredUpdateTickets).toHaveBeenCalledWith(12);
});
