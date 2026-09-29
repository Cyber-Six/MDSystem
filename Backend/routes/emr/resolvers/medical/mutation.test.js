jest.mock('../../../../config/query.js', () => ({ query: jest.fn(), connect: jest.fn(), getUserBranch: jest.fn() }));
jest.mock('../../../../config/sockets', () => ({ notifyUser: jest.fn() }));
jest.mock('./helper.js', () => ({ assertActiveUpdateTicket: jest.fn() }));
jest.mock('../../wrapper/mutation.js', () => ({ _StaffUpdateTicket: jest.fn() }));
jest.mock('../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../../utils/logger.js', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../../services/authorization/permit.js', () => ({ permissions: { emr_allow_approval: 'approval', emr_allow_edit: 'edit', emr_allow_edit_catalogs: 'catalogs' }, isMedicalPermittedPatientBased: jest.fn(), isMedicalPermitted: jest.fn() }));
jest.mock('../record-validator.js', () => ({ validateUpdateTicket: jest.fn() }));

const permit = require('../../../../services/authorization/permit.js');
const Query = require('./query.js');
const Mutation = require('./mutation.js');
const Wrapper = require('../../wrapper/mutation.js');
const db = require('../../../../config/query.js');
const { assertActiveUpdateTicket } = require('./helper.js');
const { notifyUser } = require('../../../../config/sockets');

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

test('blocks staff updates without patient-scoped approval permission', async () => {
  const getTicket = jest.spyOn(Query, 'getUserUpdateTicket');
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  await expect(Mutation.staffUpdateTicket(null, { userId: 8, status: 'Approved' }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
  expect(getTicket).not.toHaveBeenCalled();
});

test('requires a permitted update ticket before staff can change its status', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue(null);
  await expect(Mutation.staffUpdateTicket(null, { userId: 8, status: 'Approved' }, { user: { id: 3 }, res: {} })).rejects.toThrow();
});

test.each([
  ['updateStudentProfile', '_StudentProfile', 'Both'], ['updateEmployeeProfile', '_EmployeeProfile', 'Both'],
  ['updateDentalHistory', '_DentalHistory', 'Dental'], ['updateObgynHistory', '_ObgynHistory', 'Medical'],
  ['updateLifestyle', '_Lifestyle', 'Medical'], ['updateDentalPhotoRecord', '_DentalPhotoRecord', 'Dental'],
  ['updateOralApplianceProfile', '_OralApplianceProfile', 'Dental'], ['updateEmergencyContact', '_EmergencyContact', 'Both'],
  ['updateVisualAcuityProfile', '_VisualAcuityProfile', 'Medical'], ['updateMedicalHistory', '_MedicalHistory', 'Medical'],
  ['updateHospitalizationProfile', '_HospitalizationProfile', 'Medical'], ['updateOperationProfile', '_OperationProfile', 'Medical'],
  ['updateImmunizationProfile', '_ImmunizationProfile', 'Medical'], ['updateDentalProcedureProfile', '_DentalProcedureProfile', 'Dental'],
  ['updateAllergyProfile', '_AllergyProfile', 'Medical'], ['updateMedicationProfile', '_MedicationProfile', 'Medical'],
])('authorizes and routes %s to the correct scoped data mutation', async (resolver, wrapperMethod, scope) => {
  const args = { userId: 8, input: { value: true } };
  const context = { user: { id: 3 }, res: {} };
  const record = { id: 19, scope };
  const result = { saved: true };
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  Wrapper[wrapperMethod] = jest.fn().mockResolvedValue(result);
  await expect(Mutation[resolver](null, args, context)).resolves.toBe(result);
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(3, 'edit', 8);
  expect(assertActiveUpdateTicket).toHaveBeenCalledWith(record, context.res, scope);
  expect(Wrapper[wrapperMethod]).toHaveBeenCalledWith(null, { args, recordId: 19 }, context);
});

test.each([
  'updateStudentProfile', 'updateEmployeeProfile', 'updateDentalHistory', 'updateObgynHistory', 'updateLifestyle',
  'updateDentalPhotoRecord', 'updateOralApplianceProfile', 'updateEmergencyContact', 'updateVisualAcuityProfile',
  'updateMedicalHistory', 'updateHospitalizationProfile', 'updateOperationProfile', 'updateImmunizationProfile',
  'updateDentalProcedureProfile', 'updateAllergyProfile', 'updateMedicationProfile',
])('rejects unauthorized %s before looking up a ticket', async resolver => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  const getTicket = jest.spyOn(Query, 'getUserUpdateTicket');
  await expect(Mutation[resolver](null, { userId: 8, input: {} }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
  expect(getTicket).not.toHaveBeenCalled();
});

test.each([
  ['createDomainCatalogs', '_DomainCatalog'], ['createAllergenCatalogs', '_AllergenCatalogs'],
  ['createOralApplianceCatalogs', '_OralApplianceCatalogs'], ['updateDomainCatalogs', '_UpdateDomainCatalogs'],
  ['updateAllergenCatalogs', '_UpdateAllergenCatalog'], ['updateOralApplianceCatalogs', '_UpdateOralApplianceCatalog'],
])('authorizes catalog mutation %s and delegates it', async (resolver, wrapperMethod) => {
  const args = { userId: 8, input: { label: 'test' } };
  const context = { user: { id: 3 }, res: {} };
  const record = { id: 20, scope: 'Both' };
  const value = { id: 4 };
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true });
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  Wrapper[wrapperMethod] = jest.fn().mockResolvedValue(value);
  await expect(Mutation[resolver](null, args, context)).resolves.toBe(value);
  expect(permit.isMedicalPermitted).toHaveBeenCalledWith(3, 'catalogs');
  expect(assertActiveUpdateTicket).toHaveBeenCalledWith(record, context.res, 'Both');
  expect(Wrapper[wrapperMethod]).toHaveBeenCalledWith(null, args, context);
});

test.each([
  'createDomainCatalogs', 'createAllergenCatalogs', 'createOralApplianceCatalogs',
  'updateDomainCatalogs', 'updateAllergenCatalogs', 'updateOralApplianceCatalogs',
])('rejects unauthorized catalog change %s before fetching a ticket', async resolver => {
  permit.isMedicalPermitted.mockResolvedValue({ permitted: false });
  const getTicket = jest.spyOn(Query, 'getUserUpdateTicket');
  await expect(Mutation[resolver](null, { input: {} }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
  expect(getTicket).not.toHaveBeenCalled();
});

test.each([
  ['Approved', undefined, 'Record Submission Approved'], ['Approved', '  reviewed  ', 'Record Submission Approved'],
  ['Revision', undefined, 'Record Revision Required'], ['Revision', 'please update', 'Record Revision Required'],
  ['Rejected', undefined, 'Record Submission Rejected'], ['Rejected', 'invalid', 'Record Submission Rejected'],
  ['Other', undefined, 'Record Status Updated'], ['Other', '  notes  ', 'Record Status Updated'],
])('updates ticket to %s and sends the matching patient notification', async (status, notes, title) => {
  const args = { userId: 8, status, notes };
  const context = { user: { id: 3 }, res: {} };
  const record = { id: 19, scope: 'Dental' };
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  Wrapper._StaffUpdateTicket.mockResolvedValue(status);
  notifyUser.mockResolvedValue('queued');
  await expect(Mutation.staffUpdateTicket(null, args, context)).resolves.toBe(status);
  expect(Wrapper._StaffUpdateTicket).toHaveBeenCalledWith(null, { args, recordId: 19, scope: 'Dental' }, context);
  expect(notifyUser).toHaveBeenCalledWith(8, 'updateTicket:statusChanged', expect.objectContaining({ recordId: 19, newStatus: status, notes: notes || null, scope: 'Dental' }), expect.objectContaining({ title, notes: notes || null }), { forceEmail: true });
});

test('notification failure does not undo an approved ticket update', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue({ id: 19, scope: null });
  assertActiveUpdateTicket.mockReturnValue(true);
  Wrapper._StaffUpdateTicket.mockResolvedValue('Approved');
  notifyUser.mockRejectedValue(new Error('mail offline'));
  await expect(Mutation.staffUpdateTicket(null, { userId: 8, status: 'Approved' }, { user: { id: 3 }, res: {} })).resolves.toBe('Approved');
});

test.each([
  ['linkVitalSignsToTicket', 'vitalSignsId', 'VitalSigns', 'Medical'],
  ['linkDentalRecordToTicket', 'dentalRecordId', 'DentalRecord', 'Dental'],
])('links %s after validating permissions, ownership, and duplicate state', async (resolver, idArg, table, scope) => {
  const context = { user: { id: 3 }, res: {} };
  const args = { userId: '8', [idArg]: 99 };
  const record = { id: 19, scope };
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation[resolver](null, args, context)).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  db.query.mockResolvedValueOnce({ rows: [{ id: 99, userId: 8 }] }).mockResolvedValueOnce({ rowCount: 1 });
  await expect(Mutation[resolver](null, args, context)).resolves.toBe(true);
  expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining(`FROM "${table}"`), [99]);
  expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining(`SET "${idArg}" = $1`), [99, 19]);

  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Mutation[resolver](null, args, context)).rejects.toThrow(`404:${table} not found.`);
  db.query.mockResolvedValueOnce({ rows: [{ id: 99, userId: 999 }] });
  await expect(Mutation[resolver](null, args, context)).rejects.toThrow(`403:${table} does not belong to this patient.`);
  jest.spyOn(Query, 'getUserUpdateTicket').mockResolvedValue({ ...record, [idArg]: 77 });
  db.query.mockResolvedValueOnce({ rows: [{ id: 99, userId: 8 }] });
  await expect(Mutation[resolver](null, args, context)).rejects.toThrow(`403:This update ticket already has ${table === 'VitalSigns' ? 'VitalSigns' : 'a DentalRecord'} linked.`);
});
