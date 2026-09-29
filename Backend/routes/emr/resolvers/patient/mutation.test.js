jest.mock('../../../../config/query.js', () => ({ query: jest.fn(), isUserValidated: jest.fn(), getUserBranch: jest.fn() }));
jest.mock('./helper.js', () => ({ assertActiveUpdateTicket: jest.fn() }));
jest.mock('../../wrapper/mutation.js', () => ({}));
jest.mock('../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../../config/sockets', () => ({ emitToRole: jest.fn() }));
jest.mock('../record-validator.js', () => ({ validateUpdateTicket: jest.fn() }));

const db = require('../../../../config/query.js');
const Query = require('./query.js');
const Mutation = require('./mutation.js');
const Wrapper = require('../../wrapper/mutation.js');
const { assertActiveUpdateTicket } = require('./helper.js');
const { validateUpdateTicket } = require('../record-validator.js');
const { emitToRole } = require('../../../../config/sockets');

beforeEach(() => jest.clearAllMocks());

test('creates a full-scope update ticket without requiring existing validation', async () => {
  Query.getUpdateTicket = jest.fn().mockResolvedValue(null);
  db.query.mockResolvedValueOnce({ rows: [{ id: 15 }] });
  await expect(Mutation.createUpdateTicket(null, { scope: 'Both' }, { user: { id: 6 }, res: {} })).resolves.toBe(15);
  expect(db.query.mock.calls[0][1]).toEqual([6, 'Both']);
  expect(db.isUserValidated).not.toHaveBeenCalled();
});

test('blocks duplicate tickets and unverified partial scopes', async () => {
  Query.getUpdateTicket = jest.fn().mockResolvedValue({ status: 'Pending' });
  await expect(Mutation.createUpdateTicket(null, { scope: 'Profile' }, { user: { id: 6 }, res: {} })).rejects.toThrow('400:An update ticket is already in progress.');
  Query.getUpdateTicket.mockResolvedValueOnce(null);
  db.isUserValidated.mockResolvedValueOnce(false);
  await expect(Mutation.createUpdateTicket(null, { scope: 'Profile' }, { user: { id: 6 }, res: {} })).rejects.toThrow('400:Creating update tickets for partial scopes is not allowed without an existing ticket.');
});

test('creates verified partial-scope tickets and accepts prior tickets in terminal statuses', async () => {
  Query.getUpdateTicket = jest.fn().mockResolvedValue({ status: 'Cancelled' });
  db.isUserValidated.mockResolvedValueOnce(true);
  db.query.mockResolvedValueOnce({ rows: [{ id: 21 }] });
  await expect(Mutation.createUpdateTicket(null, { scope: 'Profile' }, { user: { id: 6 }, res: {} })).resolves.toBe(21);
  expect(db.isUserValidated).toHaveBeenCalledWith(6);
  for (const status of ['Completed', 'Cancelled', 'Expired']) {
    Query.getUpdateTicket.mockResolvedValueOnce({ status });
    db.query.mockResolvedValueOnce({ rows: [{ id: 22 }] });
    await expect(Mutation.createUpdateTicket(null, { scope: 'Both' }, { user: { id: 6 }, res: {} })).resolves.toBe(22);
  }
});

test('submits complete tickets, selects pending versus revision status, and notifies staff', async () => {
  const context = { user: { id: 6 }, res: {} };
  Query.getUpdateTicket = jest.fn().mockResolvedValue({ id: 30, scope: 'Both', status: 'InProgress' });
  assertActiveUpdateTicket.mockReturnValue(true);
  validateUpdateTicket.mockResolvedValue([]);
  db.getUserBranch.mockResolvedValue('Manila');
  await expect(Mutation.submitUpdateTicket(null, {}, context)).resolves.toBe('Pending');
  expect(db.query).toHaveBeenCalledWith('UPDATE "patientUpdateLog" SET status = $1 WHERE id = $2;', ['Pending', 30]);
  expect(emitToRole).toHaveBeenCalledWith('Manila::staff', 'updateTicket', expect.objectContaining({ ticketId: 30, patientId: 6, status: 'Pending', scope: 'Both' }));

  Query.getUpdateTicket.mockResolvedValueOnce({ id: 31, scope: 'Dental', status: 'Revision' });
  await expect(Mutation.submitUpdateTicket(null, {}, context)).resolves.toBe('RevisionSubmitted');
  expect(emitToRole).toHaveBeenLastCalledWith('Manila::staff', 'updateTicket', expect.objectContaining({ status: 'RevisionSubmitted', scope: 'Dental' }));
  validateUpdateTicket.mockResolvedValueOnce(['address', 'phone']);
  await expect(Mutation.submitUpdateTicket(null, {}, context)).rejects.toThrow('400:Cannot submit update ticket. Required records are missing or incomplete: address, phone');
});

test('cancels only in-progress or pending tickets and broadcasts successful cancellations', async () => {
  const context = { user: { id: 6 }, res: {} };
  Query.getUpdateTicket = jest.fn().mockResolvedValue({ id: 40, scope: 'Profile', status: 'InProgress' });
  db.getUserBranch.mockResolvedValue('QuezonCity');
  await expect(Mutation.cancelUpdateTicket(null, {}, context)).resolves.toBe('Cancelled');
  expect(emitToRole).toHaveBeenCalledWith('QuezonCity::staff', 'updateTicket', expect.objectContaining({ ticketId: 40, patientId: 6, scope: 'Profile', status: 'Cancelled' }));
  Query.getUpdateTicket.mockResolvedValueOnce({ id: 41, scope: 'Both', status: 'Pending' });
  await expect(Mutation.cancelUpdateTicket(null, {}, context)).resolves.toBe('Cancelled');
  Query.getUpdateTicket.mockResolvedValueOnce({ id: 42, scope: 'Both', status: 'Revision' });
  await expect(Mutation.cancelUpdateTicket(null, {}, context)).rejects.toThrow("400:Cannot cancel update ticket that is not in 'InProgress' or 'Pending' status.");
});

test.each([
  ['createStudentProfile', '_StudentProfile', 'Both'],
  ['createEmployeeProfile', '_EmployeeProfile', 'Both'],
  ['createDentalHistory', '_DentalHistory', 'Dental'],
  ['createObgynHistory', '_ObgynHistory', 'Medical'],
  ['createLifestyle', '_Lifestyle', 'Medical'],
  ['createDentalPhotoRecord', '_DentalPhotoRecord', 'Dental'],
  ['createOralApplianceProfile', '_OralApplianceProfile', 'Dental'],
  ['createEmergencyContact', '_EmergencyContact', 'Both'],
  ['createVisualAcuityProfile', '_VisualAcuityProfile', 'Medical'],
  ['createMedicalHistory', '_MedicalHistory', 'Medical'],
  ['createHospitalizationProfile', '_HospitalizationProfile', 'Medical'],
  ['createOperationProfile', '_OperationProfile', 'Medical'],
  ['createImmunizationProfile', '_ImmunizationProfile', 'Medical'],
  ['createDentalProcedureProfile', '_DentalProcedureProfile', 'Dental'],
  ['createAllergyProfile', '_AllergyProfile', 'Medical'],
  ['createMedicationProfile', '_MedicationProfile', 'Medical'],
])('routes %s through its ticket scope and matching mutation wrapper', async (resolver, wrapperKey, scope) => {
  const record = { id: 50, status: 'Pending', scope };
  const args = { input: { example: true } };
  const context = { user: { id: 6 }, res: {} };
  Query.getUpdateTicket = jest.fn().mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  const wrapperResult = { ok: true };
  Wrapper[wrapperKey] = jest.fn().mockResolvedValue(wrapperResult);
  const result = await Mutation[resolver](null, args, context);
  expect(assertActiveUpdateTicket).toHaveBeenCalledWith(record, context.res, scope);
  expect(Wrapper[wrapperKey]).toHaveBeenCalledWith(null, { args, recordId: 50 }, context);
  expect(result).toBe(wrapperResult);
  if (resolver === 'createStudentProfile') expect(result.status).toBe('Pending');
});

test.each([
  ['createDomainCatalogs', '_DomainCatalog'],
  ['createAllergenCatalogs', '_AllergenCatalogs'],
])('routes catalog resolver %s without creating an update ticket', async (resolver, wrapperKey) => {
  const args = { input: { name: 'sample' } };
  const context = { user: { id: 6 }, res: {} };
  const value = { id: 7 };
  Wrapper[wrapperKey] = jest.fn().mockResolvedValue(value);
  await expect(Mutation[resolver](null, args, context)).resolves.toBe(value);
  expect(Wrapper[wrapperKey]).toHaveBeenCalledWith(null, args, context);
  expect(Query.getUpdateTicket).not.toHaveBeenCalled();
});

test('routes oral-appliance catalog through a dental ticket', async () => {
  const record = { id: 60, status: 'InProgress', scope: 'Dental' };
  const args = { input: { name: 'retainer' } };
  const context = { user: { id: 6 }, res: {} };
  Query.getUpdateTicket = jest.fn().mockResolvedValue(record);
  assertActiveUpdateTicket.mockReturnValue(true);
  Wrapper._OralApplianceCatalogs = jest.fn().mockResolvedValue({ id: 8 });
  await expect(Mutation.createOralApplianceCatalogs(null, args, context)).resolves.toEqual({ id: 8 });
  expect(assertActiveUpdateTicket).toHaveBeenCalledWith(record, context.res, 'Dental');
  expect(Wrapper._OralApplianceCatalogs).toHaveBeenCalledWith(null, args, context);
});
