jest.mock('../../../config/query.js', () => ({ query: jest.fn(), queryClient: jest.fn(), queryControlledClient: jest.fn(), connect: jest.fn(), findEmailByUserId: jest.fn() }));
jest.mock('../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../utils/logger.js', () => ({ warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }));
jest.mock('../../../services/authorization/permit.js', () => ({ permissions: { emr_allow_set_vital_sign: 'vital', emr_allow_set_dental_record: 'dental', emr_allow_edit_catalogs: 'catalog' }, isMedicalPermittedPatientBased: jest.fn(), isMedicalPermitted: jest.fn() }));
jest.mock('../../../config/sockets', () => ({ isConnectedAnywhere: jest.fn(), emitToUser: jest.fn() }));
jest.mock('../../../services/email/emailservice', () => ({ enqueueNotificationEmail: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid') }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../config/query.js');
const permit = require('../../../services/authorization/permit.js');
const logger = require('../../../utils/logger.js');
const sockets = require('../../../config/sockets');
const { enqueueNotificationEmail } = require('../../../services/email/emailservice');
const Mutation = require('./mutation.js');
const ctx = { user: { id: 4 }, res: {} };
const rows = (...values) => ({ rows: values });

function transaction() {
  return { query: jest.fn().mockResolvedValue(rows()), release: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true });
  db.query.mockResolvedValue(rows());
  db.queryClient.mockResolvedValue(rows({ id: 10 }));
  db.queryControlledClient.mockResolvedValue(rows({ id: 20 }));
  db.connect.mockResolvedValue(transaction());
  db.findEmailByUserId.mockResolvedValue(null);
  sockets.isConnectedAnywhere.mockResolvedValue(true);
  sockets.emitToUser.mockReturnValue(true);
  enqueueNotificationEmail.mockResolvedValue(undefined);
});

test('creates vital signs only for permitted staff and maps insert errors', async () => {
  db.query.mockResolvedValueOnce(rows({ id: 1, patientId: 7 }));
  await expect(Mutation.createVitalSigns(null, { patientId: 7, input: { height_cm: 170 } }, ctx)).resolves.toEqual({ id: 1, patientId: 7 });
  expect(db.query.mock.calls[0][1]).toEqual([7, 170, undefined, undefined, undefined, undefined, null]);
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.createVitalSigns(null, { patientId: 7, input: {} }, ctx)).rejects.toThrow('401:Unauthorized');
  db.query.mockRejectedValueOnce(new Error('bad input'));
  await expect(Mutation.createVitalSigns(null, { patientId: 7, input: {} }, ctx)).rejects.toThrow('400:Failed to create VitalSigns: bad input');
});

test('creates dental records with optional tooth and oral finding rows and notifies online patients', async () => {
  const client = transaction(); db.connect.mockResolvedValueOnce(client);
  db.queryClient.mockResolvedValueOnce(rows({ id: 11, patientId: 7 }));
  db.queryControlledClient.mockResolvedValueOnce(rows({ id: 1, toothIndex: 1, legend: 'MISSING' }))
    .mockResolvedValueOnce(rows({ id: 2 }));
  db.query.mockResolvedValueOnce(rows({ first_name: 'Ada', last_name: 'Lovelace' }));
  const placements = [{ toothIndex: 1, legend: 'MISSING' }, { toothIndex: 2, legend: 'PRESENT' }];
  const result = await Mutation.createDentalRecord(null, { patientId: 7, input: { notes: 'checked', ToothPlacements: placements, oralFindings: [{ oralFindingId: 2, status: 'Present' }] } }, ctx);
  expect(result).toMatchObject({ id: 11, ToothPlacements: [{ id: 1, toothIndex: 1, legend: 'MISSING' }], oralFindings: [{ id: 2 }] });
  expect(client.query).toHaveBeenCalledWith('COMMIT'); expect(client.release).toHaveBeenCalled();
  expect(sockets.emitToUser).toHaveBeenCalledWith('7', 'staff:notification', expect.objectContaining({ fromName: 'Ada Lovelace', recommendations: ['Missing tooth management - Tooth 1'] }));
  expect(enqueueNotificationEmail).not.toHaveBeenCalled();
});

test('dental grading notifications fall back to email, tolerate emit failure, missing identity, and notification errors', async () => {
  sockets.isConnectedAnywhere.mockResolvedValueOnce(false);
  db.findEmailByUserId.mockResolvedValueOnce('patient@example.test');
  db.query.mockResolvedValueOnce(rows());
  const c1 = transaction(); db.connect.mockResolvedValueOnce(c1); db.queryClient.mockResolvedValueOnce(rows({ id: 2 }));
  const nineRecommendations = Array.from({ length: 9 }, (_, index) => ({ toothIndex: index + 1, legend: index ? 'CUSTOM_MARK' : 'MISSING' }));
  nineRecommendations.push({ toothIndex: 12, legend: 'PRESENT' }, {});
  db.queryControlledClient.mockResolvedValueOnce(rows(...nineRecommendations.slice(0, 9)));
  await Mutation.createDentalRecord(null, { patientId: 8, input: { ToothPlacements: nineRecommendations, oralFindings: [] } }, ctx);
  expect(enqueueNotificationEmail).toHaveBeenCalledWith('patient@example.test', 'Dental Grading Completed', expect.stringContaining('and 1 more recommendation.'));
  sockets.isConnectedAnywhere.mockResolvedValueOnce(true); sockets.emitToUser.mockReturnValueOnce(false);
  db.findEmailByUserId.mockResolvedValueOnce(null); db.query.mockResolvedValueOnce(rows({ first_name: '', last_name: '' }));
  const c2 = transaction(); db.connect.mockResolvedValueOnce(c2); db.queryClient.mockResolvedValueOnce(rows({ id: 3 }));
  await Mutation.createDentalRecord(null, { patientId: 9, input: {} }, ctx);
  expect(logger.warn).toHaveBeenCalled();
  sockets.isConnectedAnywhere.mockRejectedValueOnce(new Error('socket unavailable'));
  const c3 = transaction(); db.connect.mockResolvedValueOnce(c3); db.queryClient.mockResolvedValueOnce(rows({ id: 4 }));
  db.query.mockResolvedValueOnce(rows()); db.findEmailByUserId.mockResolvedValueOnce('p@test'); enqueueNotificationEmail.mockRejectedValueOnce(new Error('mail unavailable'));
  await expect(Mutation.createDentalRecord(null, { patientId: 10, input: {} }, ctx)).resolves.toMatchObject({ id: 4 });
  expect(logger.error).toHaveBeenCalled();
  const c4 = transaction(); db.connect.mockResolvedValueOnce(c4); db.queryClient.mockRejectedValueOnce(new Error('write failed'));
  await expect(Mutation.createDentalRecord(null, { patientId: 11, input: {} }, ctx)).rejects.toThrow('400:Failed to create DentalRecord: write failed');
  const c5 = transaction(); db.connect.mockResolvedValueOnce(c5); db.queryClient.mockResolvedValueOnce(rows({ id: 5 }));
  db.queryControlledClient.mockResolvedValueOnce(rows(...Array.from({ length: 10 }, (_, index) => ({ toothIndex: index + 1, legend: 'CUSTOM_MARK' }))));
  sockets.isConnectedAnywhere.mockResolvedValueOnce(true); sockets.emitToUser.mockReturnValueOnce(true);
  await Mutation.createDentalRecord(null, { patientId: 12, input: { ToothPlacements: Array.from({ length: 10 }, (_, index) => ({ toothIndex: index + 1, legend: 'CUSTOM_MARK' })) } }, ctx);
  expect(sockets.emitToUser).toHaveBeenCalled();
  const c6 = transaction(); db.connect.mockResolvedValueOnce(c6); db.queryClient.mockResolvedValueOnce(rows({ id: 6 }));
  await Mutation.createDentalRecord(null, { patientId: null, input: {} }, ctx);
  const c7 = transaction(); db.connect.mockResolvedValueOnce(c7); db.queryClient.mockResolvedValueOnce(rows({ id: 0 }));
  sockets.isConnectedAnywhere.mockResolvedValueOnce(true); sockets.emitToUser.mockReturnValueOnce(true);
  await Mutation.createDentalRecord(null, { patientId: 13, input: {} }, ctx);
  expect(sockets.emitToUser.mock.calls.at(-1)[2].recordId).toBeNull();
});

test('dental record creation rolls back failures and always releases the transaction', async () => {
  const client = transaction(); db.connect.mockResolvedValueOnce(client);
  db.queryClient.mockRejectedValueOnce(Object.assign(new Error('foreign key'), { code: '23503' }));
  await expect(Mutation.createDentalRecord(null, { patientId: 7, input: {} }, ctx)).rejects.toThrow('400:Invalid oralFindingId provided.');
  expect(client.query).toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalled();
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.createDentalRecord(null, { patientId: 7, input: {} }, ctx)).rejects.toThrow('401:Unauthorized');
});

test('updates vital signs within the lock window, rejects unauthorized, missing, stale, and empty updates', async () => {
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })).mockResolvedValueOnce(rows({ id: 1 }));
  await expect(Mutation.updateVitalSigns(null, { id: 1, input: { height_cm: 170, weight_kg: 65, blood_pressure: '120/80', heart_rate: 70, temperature: 36.5, notes: '' } }, ctx)).resolves.toEqual({ id: 1 });
  expect(db.query.mock.calls[1][1]).toEqual([170, 65, '120/80', 70, 36.5, '', 1]);
  db.query.mockResolvedValueOnce(rows());
  await expect(Mutation.updateVitalSigns(null, { id: 2, input: {} }, ctx)).rejects.toThrow('404:VitalSigns not found.');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.updateVitalSigns(null, { id: 3, input: {} }, ctx)).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date(0) })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true);
  await expect(Mutation.updateVitalSigns(null, { id: 4, input: {} }, ctx)).rejects.toThrow('403:VitalSigns can only be updated within 24 hours of creation.');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true);
  await expect(Mutation.updateVitalSigns(null, { id: 5, input: {} }, ctx)).rejects.toThrow('400:Failed to update VitalSigns: 400:No fields to update.');
});

test('updates dental record data transactionally, including replacement and empty child collections', async () => {
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() }))
    .mockResolvedValueOnce(rows({ id: 6 }))
    .mockResolvedValueOnce(rows({ id: 1, toothIndex: 3 }))
    .mockResolvedValueOnce(rows({ oralFindingId: 2 }));
  const client = transaction(); db.connect.mockResolvedValueOnce(client);
  db.queryControlledClient.mockResolvedValue(rows());
  await expect(Mutation.updateDentalRecord(null, { id: 6, input: { notes: 'updated', ToothPlacements: [{ toothIndex: 3, legend: 'FILLED' }], oralFindings: [{ oralFindingId: 2, status: 'Present' }] } }, ctx)).resolves.toMatchObject({ id: 6, ToothPlacements: [{ toothIndex: 3 }], oralFindings: [{ oralFindingId: 2 }] });
  expect(client.query).toHaveBeenCalledWith('COMMIT'); expect(client.release).toHaveBeenCalled();
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })).mockResolvedValueOnce(rows({ id: 7 })).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows());
  const empty = transaction(); db.connect.mockResolvedValueOnce(empty);
  await expect(Mutation.updateDentalRecord(null, { id: 7, input: { ToothPlacements: [], oralFindings: [] } }, ctx)).resolves.toMatchObject({ ToothPlacements: [], oralFindings: [] });
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })).mockResolvedValueOnce(rows({ id: 8 })).mockResolvedValueOnce(rows()).mockResolvedValueOnce(rows());
  const noChanges = transaction(); db.connect.mockResolvedValueOnce(noChanges);
  await expect(Mutation.updateDentalRecord(null, { id: 8, input: {} }, ctx)).resolves.toMatchObject({ id: 8, ToothPlacements: [], oralFindings: [] });
});

test('rejects unavailable or unauthorized dental updates and translates transactional failures', async () => {
  db.query.mockResolvedValueOnce(rows());
  await expect(Mutation.updateDentalRecord(null, { id: 1, input: {} }, ctx)).rejects.toThrow('404:DentalRecord not found.');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date(0) }));
  await expect(Mutation.updateDentalRecord(null, { id: 1, input: {} }, ctx)).rejects.toThrow('403:DentalRecord can only be updated within 24 hours of creation.');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.updateDentalRecord(null, { id: 1, input: {} }, ctx)).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true);
  const client = transaction(); db.connect.mockResolvedValueOnce(client); db.queryClient.mockRejectedValueOnce(Object.assign(new Error('foreign key'), { code: '23503' }));
  await expect(Mutation.updateDentalRecord(null, { id: 1, input: { notes: 'bad' } }, ctx)).rejects.toThrow('400:Invalid oralFindingId provided.');
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  db.query.mockResolvedValueOnce(rows({ patientId: 7, created_at: new Date() })); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true);
  const broken = transaction(); db.connect.mockResolvedValueOnce(broken); db.queryClient.mockRejectedValueOnce(new Error('write failed'));
  await expect(Mutation.updateDentalRecord(null, { id: 2, input: { notes: 'x' } }, ctx)).rejects.toThrow('400:Failed to update DentalRecord: write failed');
});

test('creates, updates and deletes oral finding catalog rows with permission and validation handling', async () => {
  db.query.mockResolvedValueOnce(rows({ id: 1, name: 'Finding', isActive: true }));
  await expect(Mutation.createOralFindingCatalog(null, { input: { name: 'Finding' } }, ctx)).resolves.toEqual({ id: 1, name: 'Finding', isActive: true });
  expect(db.query.mock.calls[0][1]).toEqual(['Finding', null, true, 4]);
  db.query.mockResolvedValueOnce(rows({ id: 2, name: 'Disabled', isActive: false }));
  await expect(Mutation.createOralFindingCatalog(null, { input: { name: 'Disabled', description: 'desc', isActive: false } }, ctx)).resolves.toMatchObject({ isActive: false });
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Mutation.createOralFindingCatalog(null, { input: { name: 'x' } }, ctx)).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Mutation.updateOralFindingCatalog(null, { id: 2, input: { name: 'x' } }, ctx)).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce(rows({ id: 2 } )).mockResolvedValueOnce(rows({ id: 2, name: 'Updated' }));
  await expect(Mutation.updateOralFindingCatalog(null, { id: 2, input: { name: 'Updated', description: 'desc', isActive: false } }, ctx)).resolves.toEqual({ id: 2, name: 'Updated' });
  db.query.mockResolvedValueOnce(rows());
  await expect(Mutation.updateOralFindingCatalog(null, { id: 3, input: {} }, ctx)).rejects.toThrow('400:Failed to update OralFindingCatalog: 404:OralFindingCatalog not found.');
  db.query.mockResolvedValueOnce(rows({ id: 4 }));
  await expect(Mutation.updateOralFindingCatalog(null, { id: 4, input: {} }, ctx)).rejects.toThrow('400:Failed to update OralFindingCatalog: 400:No fields to update.');
  db.query.mockResolvedValueOnce(rows({ id: 5 })).mockResolvedValueOnce(rows({ id: 5 }));
  await expect(Mutation.deleteOralFindingCatalog(null, { id: 5 }, ctx)).resolves.toEqual({ id: 5 });
  db.query.mockResolvedValueOnce(rows());
  await expect(Mutation.deleteOralFindingCatalog(null, { id: 6 }, ctx)).rejects.toThrow('400:Failed to delete OralFindingCatalog: 404:OralFindingCatalog not found.');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Mutation.deleteOralFindingCatalog(null, { id: 7 }, ctx)).rejects.toThrow('401:Unauthorized');
  db.query.mockRejectedValueOnce(new Error('insert failed'));
  await expect(Mutation.createOralFindingCatalog(null, { input: { name: 'err' } }, ctx)).rejects.toThrow('400:Failed to create OralFindingCatalog: insert failed');
});
