jest.mock('../../wrapper/query.js', () => new Proxy({}, {
  get(target, name) {
    if (!target[name]) target[name] = jest.fn();
    return target[name];
  },
}));
jest.mock('../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../../utils/logger.js', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../../services/permit.js', () => ({
  permissions: {
    emr_allow_view: 'emr_allow_view', emr_allow_approval: 'emr_allow_approval',
    appointment_allow_view_records: 'appointment_allow_view_records', profile_allow_view: 'profile_allow_view',
    inventory_allow_manage_requests: 'inventory_allow_manage_requests', consultation_allow_view: 'consultation_allow_view',
    document_allow_view: 'document_allow_view', privileged_to_perform_on_superior: 'privileged_to_perform_on_superior',
    notification_allow_send_to_patients: 'notification_allow_send_to_patients',
  },
  isMedicalPermittedPatientBased: jest.fn(), isMedicalPermitted: jest.fn(),
  isMedicalPermittedPatientBasedMulti: jest.fn(), isMedicalPermittedLocationBasedMulti: jest.fn(),
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../../wrapper/query.js');
const permit = require('../../../../services/permit.js');
const Query = require('./query.js');

beforeEach(() => jest.clearAllMocks());

test('enforces patient-scoped medical permission and applies reviewable statuses', async () => {
  const args = { userId: 8, offset: 2 };
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  Wrapper._getUserProfile.mockResolvedValueOnce([{ id: 1, status: 'Approved' }]);
  await expect(Query.getUserProfile(null, args, { user: { id: 3 }, res: {} })).resolves.toEqual([{ id: 1, status: 'Approved' }]);
  expect(Wrapper._getUserProfile.mock.calls[0][1]).toMatchObject({ userId: 8, offset: 2, statuses: expect.arrayContaining(['Approved', 'Pending']) });
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  await expect(Query.getUserProfile(null, args, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
});

test('returns null for empty records and rejects non-reviewable profiles', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  Wrapper._getUserProfile.mockResolvedValueOnce([]);
  await expect(Query.getUserProfile(null, { userId: 8 }, { user: { id: 3 }, res: {} })).resolves.toBeNull();
  Wrapper._getUserProfile.mockResolvedValueOnce([{ status: 'Cancelled' }]);
  await expect(Query.getUserProfile(null, { userId: 8 }, { user: { id: 3 }, res: {} })).rejects.toThrow('404:No active profile found.');
});

const patientRecordResolvers = [
  ['getUserDentalPhotoRecord', '_getUserDentalPhotoRecord'], ['getUserObgynHistory', '_getUserObgynHistory'],
  ['getUserLifestyle', '_getUserLifestyle'], ['getUserDentalHistory', '_getUserDentalHistory'],
  ['getUserOralApplianceProfile', '_getUserOralApplianceProfile'], ['getUserEmergencyContact', '_getUserEmergencyContact'],
  ['getUserAllergyProfile', '_getUserAllergyProfile'], ['getUserMedicationProfile', '_getUserMedicationProfile'],
  ['getUserDentalProcedureProfile', '_getUserDentalProcedureProfile'], ['getUserImmunizationProfile', '_getUserImmunizationProfile'],
  ['getUserOperationProfile', '_getUserOperationProfile'], ['getUserHospitalizationProfile', '_getUserHospitalizationProfile'],
  ['getUserMedicalHistory', '_getUserMedicalHistory'], ['getUserVisualAcuityProfile', '_getUserVisualAcuityProfile'],
];

test.each(patientRecordResolvers)('%s enforces patient scope, injects reviewable statuses, and handles empty results', async (resolverName, wrapperName) => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  Wrapper[wrapperName].mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1, status: 'Approved' }]);
  const context = { user: { id: 3 }, res: {} };
  await expect(Query[resolverName](null, { userId: 8, offset: 2 }, context)).resolves.toBeNull();
  await expect(Query[resolverName](null, { userId: 8, offset: 2 }, context)).resolves.toEqual([{ id: 1, status: 'Approved' }]);
  expect(Wrapper[wrapperName]).toHaveBeenLastCalledWith(null, expect.objectContaining({ userId: 8, offset: 2, statuses: expect.arrayContaining(['InProgress', 'Approved']) }), context);
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query[resolverName](null, { userId: 8 }, context)).rejects.toThrow('401:Unauthorized');
});

test('passes update tickets and user ticket IDs through only after scoped permission checks', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  Wrapper._getUserUpdateTicket.mockResolvedValueOnce({ id: 4 });
  const context = { user: { id: 3 }, res: {} };
  await expect(Query.getUserUpdateTicket(null, { userId: 8 }, context)).resolves.toEqual({ id: 4 });
  await expect(Query.getUserUpdateTicket(null, { userId: 8 }, context)).rejects.toThrow('401:Unauthorized');
  Wrapper._getUserTicketIds.mockResolvedValueOnce([1, 2]);
  await expect(Query.getUserTicketIds(null, { userId: 8 }, context)).resolves.toEqual([1, 2]);
  expect(Wrapper._getUserTicketIds).toHaveBeenCalledWith(null, { userId: 8, statuses: ['Approved'] }, context);
});

test('checks global permissions for ticket-ID resolvers and returns wrapper records', async () => {
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Query.getTicketVitalSignsId(null, { id: 1 }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Query.getTicketDentalRecordId(null, { id: 2 }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true }).mockResolvedValueOnce({ permitted: true });
  Wrapper._getTicketVitalSignsId.mockResolvedValueOnce({ id: 1 });
  Wrapper._getTicketDentalRecordId.mockResolvedValueOnce({ id: 2 });
  await expect(Query.getTicketVitalSignsId(null, { id: 1 }, { user: { id: 3 }, res: {} })).resolves.toEqual({ id: 1 });
  await expect(Query.getTicketDentalRecordId(null, { id: 2 }, { user: { id: 3 }, res: {} })).resolves.toEqual({ id: 2 });
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query.getUserTicketIds(null, { userId: 8 }, { user: { id: 3 }, res: {} })).rejects.toThrow('401:Unauthorized');
});

test.each([
  ['getProcedureDomain', '_getProcedureDomain'], ['getDomainCatalogs', '_getDomainCatalogs'],
  ['getAllergenCatalogs', '_getAllergenCatalogs'], ['getOralApplianceCatalogs', '_getOralApplianceCatalogs'],
  ['searchDomainCatalogs', '_searchDomainCatalogs'], ['searchAllergenCatalogs', '_searchAllergenCatalogs'],
  ['searchOralApplianceCatalogs', '_searchOralApplianceCatalogs'], ['searchStudentProgram', '_searchStudentProgram'],
])('%s delegates to its wrapper', async (resolverName, wrapperName) => {
  const args = { search: 'pain', limit: 3 };
  const context = { user: { id: 2 }, res: {} };
  Wrapper[wrapperName].mockResolvedValueOnce(['result']);
  await expect(Query[resolverName](null, args, context)).resolves.toEqual(['result']);
  expect(Wrapper[wrapperName]).toHaveBeenCalledWith(null, resolverName === 'getProcedureDomain' ? {} : args, context);
});

test('clamps approval ticket branches to the permitted staff branch and requires approval permission', async () => {
  const context = { user: { id: 3 }, res: {} };
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Query.getStatusUpdateTickets(null, { branch: 'Both' }, context)).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'Manila' }).mockResolvedValueOnce({ permitted: true, branch: 'Both' });
  Wrapper._getStatusUpdateTickets.mockResolvedValueOnce(['manila']).mockResolvedValueOnce(['both']);
  await expect(Query.getStatusUpdateTickets(null, { branch: 'Both' }, context)).resolves.toEqual(['manila']);
  expect(Wrapper._getStatusUpdateTickets).toHaveBeenLastCalledWith(null, { branch: 'Manila' }, context);
  await expect(Query.getStatusUpdateTickets(null, {}, context)).resolves.toEqual(['both']);
  expect(Wrapper._getStatusUpdateTickets).toHaveBeenLastCalledWith(null, { branch: 'Both' }, context);
});

test('masks restricted Superior information, returns permitted details, and handles patient search rules', async () => {
  const context = { user: { id: 3 }, res: {} };
  const args = { userId: 9, branch: 'Manila' };
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.getPatientBasicInfo(null, args, context)).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValue(true);
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce(null);
  await expect(Query.getPatientBasicInfo(null, args, context)).resolves.toBeNull();
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce({ id: 1, profile_type: 'Student', sex: 'F' });
  await expect(Query.getPatientBasicInfo(null, args, context)).resolves.toMatchObject({ sex: 'F', access_denied: false });
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce({ id: 2, profile_type: 'Superior', sex: 'F', role: 'Doctor' });
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  const masked = await Query.getPatientBasicInfo(null, args, context);
  expect(masked).toMatchObject({ sex: null, role: null, access_denied: true });
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce({ id: 3, profile_type: 'Superior', sex: 'F' });
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true });
  await expect(Query.getPatientBasicInfo(null, args, context)).resolves.toMatchObject({ sex: 'F', access_denied: false });

  permit.isMedicalPermittedLocationBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.searchPatients(null, { searchTerm: 'Ada' }, context)).rejects.toThrow('401:Unauthorized');
  permit.isMedicalPermittedLocationBasedMulti.mockResolvedValue(true);
  await expect(Query.searchPatients(null, { searchTerm: ' a ' }, context)).resolves.toEqual([]);
  Wrapper._searchPatients.mockResolvedValueOnce([{ id: 4, profile_type: 'Superior' }, { id: 5, profile_type: 'Student' }]);
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
  await expect(Query.searchPatients(null, { searchTerm: 'Ada', branch: 'Both' }, context)).resolves.toMatchObject([
    { id: 4, access_denied: true, sex: null }, { id: 5, access_denied: false },
  ]);
  Wrapper._searchPatients.mockResolvedValueOnce([{ id: 6, profile_type: 'Superior' }]);
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true });
  await expect(Query.searchPatients(null, { searchTerm: 'Bea' }, context)).resolves.toMatchObject([{ id: 6, access_denied: false }]);
  Wrapper._searchPatients.mockResolvedValueOnce([null]);
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true });
  await expect(Query.searchPatients(null, { searchTerm: 'Cal' }, context)).resolves.toEqual([null]);
});

test('returns basic info rows and nulls for empty results', async () => {
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 8 });
  await expect(Query.getPatientBasicInfo(null, { userId: 8 }, { user: { id: 3 }, res: {} })).resolves.toBeNull();
  await expect(Query.getPatientBasicInfo(null, { userId: 8 }, { user: { id: 3 }, res: {} })).resolves.toMatchObject({ id: 8 });
});
