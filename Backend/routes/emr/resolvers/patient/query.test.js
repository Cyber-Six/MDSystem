jest.mock('../../wrapper/query.js', () => ({
  _getUserProfile: jest.fn(), _getUserUpdateTicket: jest.fn(), _getUserDentalPhotoRecord: jest.fn(),
  _getUserObgynHistory: jest.fn(), _getUserLifestyle: jest.fn(), _getUserDentalHistory: jest.fn(),
  _getUserOralApplianceProfile: jest.fn(), _getUserEmergencyContact: jest.fn(), _getUserAllergyProfile: jest.fn(),
  _getUserMedicationProfile: jest.fn(), _getUserDentalProcedureProfile: jest.fn(), _getUserImmunizationProfile: jest.fn(),
  _getUserOperationProfile: jest.fn(), _getUserHospitalizationProfile: jest.fn(), _getUserMedicalHistory: jest.fn(),
  _getUserVisualAcuityProfile: jest.fn(), _getProcedureDomain: jest.fn(), _getDomainCatalogs: jest.fn(),
  _getAllergenCatalogs: jest.fn(), _getOralApplianceCatalogs: jest.fn(), _searchDomainCatalogs: jest.fn(),
  _searchAllergenCatalogs: jest.fn(), _searchOralApplianceCatalogs: jest.fn(), _searchStudentProgram: jest.fn(),
  _getPatientBasicInfo: jest.fn(),
}));
jest.mock('../../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../../wrapper/query.js');
const Query = require('./query.js');

beforeEach(() => jest.clearAllMocks());

test('patient profile reads use the signed-in user and return the latest active or current record', async () => {
  Wrapper._getUserProfile.mockResolvedValueOnce([{ id: 1, status: 'InProgress' }]);
  await expect(Query.getProfile(null, {}, { user: { id: 5 }, res: {} })).resolves.toEqual({ id: 1, status: 'InProgress' });
  expect(Wrapper._getUserProfile).toHaveBeenCalledWith(null, { userId: 5, offset: 0, limit: 1, statuses: null }, { user: { id: 5 }, res: {} });
  Wrapper._getUserProfile.mockResolvedValueOnce([{ id: 2, status: 'Approved' }]);
  await expect(Query.getMyProfile(null, {}, { user: { id: 5 }, res: {} })).resolves.toEqual({ id: 2, status: 'Approved' });
  Wrapper._getUserProfile.mockResolvedValueOnce([]);
  await expect(Query.getProfile(null, {}, { user: { id: 5 }, res: {} })).resolves.toBeNull();
});

test('rejects a profile without an active patient ticket', async () => {
  Wrapper._getUserProfile.mockResolvedValueOnce([{ status: 'Approved' }]);
  await expect(Query.getProfile(null, {}, { user: { id: 5 }, res: {} })).rejects.toThrow('404:No active profile found.');
});

const activeProfileResolvers = [
  ['getProfile', '_getUserProfile'], ['getDentalPhotoRecord', '_getUserDentalPhotoRecord'],
  ['getObgynHistory', '_getUserObgynHistory'], ['getLifestyle', '_getUserLifestyle'],
  ['getDentalHistory', '_getUserDentalHistory'], ['getOralApplianceProfile', '_getUserOralApplianceProfile'],
  ['getAllergyProfile', '_getUserAllergyProfile'], ['getMedicationProfile', '_getUserMedicationProfile'],
  ['getDentalProcedureProfile', '_getUserDentalProcedureProfile'], ['getImmunizationProfile', '_getUserImmunizationProfile'],
  ['getOperationProfile', '_getUserOperationProfile'], ['getHospitalizationProfile', '_getUserHospitalizationProfile'],
  ['getMedicalHistory', '_getUserMedicalHistory'], ['getVisualAcuityProfile', '_getUserVisualAcuityProfile'],
];

test.each(activeProfileResolvers)('%s returns empty/current rows and rejects rows outside active statuses', async (resolverName, wrapperName) => {
  const context = { user: { id: 21 }, res: {} };
  Wrapper[wrapperName].mockResolvedValueOnce([]);
  await expect(Query[resolverName](null, {}, context)).resolves.toBeNull();
  for (const status of ['InProgress', 'Revision']) {
    const row = { id: status, status };
    Wrapper[wrapperName].mockResolvedValueOnce([row]);
    await expect(Query[resolverName](null, {}, context)).resolves.toEqual(row);
  }
  Wrapper[wrapperName].mockResolvedValueOnce([{ id: 'approved', status: 'Approved' }]);
  await expect(Query[resolverName](null, {}, context)).rejects.toThrow('404:No active profile found.');
  expect(Wrapper[wrapperName]).toHaveBeenLastCalledWith(null, { userId: 21, offset: 0, limit: 1, statuses: null }, context);
});

test('ticket, latest profile, and emergency contact branches preserve their special rules', async () => {
  Wrapper._getUserUpdateTicket.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 8, status: 'Expired' });
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 2 }, res: {} })).resolves.toBeNull();
  await expect(Query.getUpdateTicket(null, {}, { user: { id: 2 }, res: {} })).resolves.toEqual({ id: 8, status: 'Expired' });
  Wrapper._getUserProfile.mockResolvedValueOnce([]);
  await expect(Query.getMyProfile(null, {}, { user: { id: 2 }, res: {} })).resolves.toBeNull();

  Wrapper._getUserEmergencyContact.mockResolvedValueOnce([]);
  await expect(Query.getEmergencyContact(null, { approved: true }, { user: { id: 2 }, res: {} })).resolves.toBeNull();
  Wrapper._getUserEmergencyContact.mockResolvedValueOnce([{ status: 'Approved' }]);
  await expect(Query.getEmergencyContact(null, { approved: true }, { user: { id: 2 }, res: {} })).resolves.toEqual({ status: 'Approved' });
  expect(Wrapper._getUserEmergencyContact).toHaveBeenLastCalledWith(null, { userId: 2, offset: 0, limit: 1, statuses: ['Approved'] }, { user: { id: 2 }, res: {} });
  Wrapper._getUserEmergencyContact.mockResolvedValueOnce([{ status: 'Pending' }]);
  await expect(Query.getEmergencyContact(null, { approved: false }, { user: { id: 2 }, res: {} })).rejects.toThrow('404:No active profile found.');
});

test.each([
  ['getProcedureDomain', '_getProcedureDomain'], ['getDomainCatalogs', '_getDomainCatalogs'],
  ['getAllergenCatalogs', '_getAllergenCatalogs'], ['getOralApplianceCatalogs', '_getOralApplianceCatalogs'],
  ['searchDomainCatalogs', '_searchDomainCatalogs'], ['searchAllergenCatalogs', '_searchAllergenCatalogs'],
  ['searchOralApplianceCatalogs', '_searchOralApplianceCatalogs'], ['searchStudentProgram', '_searchStudentProgram'],
])('%s delegates catalog/search arguments to the wrapper', async (resolverName, wrapperName) => {
  const args = { search: 'tooth', offset: 1 };
  const context = { user: { id: 4 }, res: {} };
  Wrapper[wrapperName].mockResolvedValueOnce([{ id: 1 }]);
  await expect(Query[resolverName](null, args, context)).resolves.toEqual([{ id: 1 }]);
  expect(Wrapper[wrapperName]).toHaveBeenCalledWith(null, resolverName === 'getProcedureDomain' ? {} : args, context);
});

test('returns null for an absent patient basic-info row and returns the stored row otherwise', async () => {
  Wrapper._getPatientBasicInfo.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 7, name: 'Patient' });
  await expect(Query.getPatientBasicInfo(null, {}, { user: { id: 7 }, res: {} })).resolves.toBeNull();
  await expect(Query.getPatientBasicInfo(null, {}, { user: { id: 7 }, res: {} })).resolves.toEqual({ id: 7, name: 'Patient' });
});
