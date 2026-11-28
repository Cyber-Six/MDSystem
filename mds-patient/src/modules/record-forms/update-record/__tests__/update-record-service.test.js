import { axiosRequest } from '../../../../packages-core-adapter';
import { createImmunizationProfile, fetchUpdateRecordPrefill, getUpdateTicketStatus, mapRevisionDataToFormData, submitDentalUpdate } from '../update-record-service';
import fs from 'fs';
import path from 'path';

const { buildSchema, parse, validate } = require('../../../../../../Backend/node_modules/graphql');
const emrSchema = buildSchema(fs.readFileSync(path.resolve(__dirname, '../../../../../../Backend/routes/emr/schema.graphql'), 'utf8'));

it('fails closed when the active ticket status read has GraphQL errors', async () => {
  axiosRequest.mockResolvedValue({ data: { data: { getUpdateTicket: null }, errors: [{ message: 'Synthetic failure' }] } });
  await expect(getUpdateTicketStatus({ strict: true })).rejects.toThrow('Stored records could not be loaded');
});

it.each(['medical', 'dental', 'both'])('loads approved records for %s updates', async scope => {
  axiosRequest.mockReset().mockResolvedValue({ data: { data: {
    emrProfile: { __typename: 'StudentProfile', programId: '4', program: 'Synthetic program', year: 'Junior' },
    emergencyContact: { firstContact: { contactName: 'Synthetic contact', contactNumber: '09170000000' } },
  } } });
  const form = await fetchUpdateRecordPrefill(scope);
  const query = axiosRequest.mock.calls[0][0].data.query;
  expect(validate(emrSchema, parse(query))).toEqual([]);
  expect(query).toContain('getProfile(approved: true)');
  expect(query).toContain('getEmergencyContact(approved: true)');
  expect(query.includes('getMedicalHistory(approved: true)')).toBe(scope !== 'dental');
  expect(query.includes('getDentalHistory(approved: true)')).toBe(scope !== 'medical');
  expect(form).toMatchObject({ profileType: 'Student', programId: '4', schoolYear: 'Junior', emergencyContact1Name: 'Synthetic contact' });
});

it('rejects partial GraphQL responses when loading approved records', async () => {
  axiosRequest.mockResolvedValue({ data: { data: { emrProfile: null }, errors: [{ message: 'Synthetic failure' }] } });
  await expect(fetchUpdateRecordPrefill('both')).rejects.toThrow('Stored records could not be loaded');
});

it('does not log approved patient records or contact details', async () => {
  const spies = ['log', 'warn', 'error'].map(method => jest.spyOn(console, method).mockImplementation(() => {}));
  axiosRequest.mockResolvedValue({ data: { data: { emrProfile: { __typename: 'EmployeeProfile', department: 'Sensitive synthetic department' }, emergencyContact: { firstContact: { contactName: 'Private synthetic contact' } } } } });
  try {
    await fetchUpdateRecordPrefill('medical');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }
});

jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: Object.assign(jest.fn(), { post: jest.fn() }) }));

it('loads stored clinical details and stages copies of approved dental photos on submission', async () => {
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:synthetic-preview');
  axiosRequest.mockImplementation(async config => {
    if (config.method === 'GET') return { data: new Blob(['synthetic photo'], { type: 'image/png' }) };
    return { data: { data: {} } };
  });
  axiosRequest.post.mockResolvedValueOnce({ data: { fileId: 'new-upper' } }).mockResolvedValueOnce({ data: { fileId: 'new-lower' } });
  try {
    const form = await mapRevisionDataToFormData({
      medicalHistory: { conditions: [{ conditionId: '3', relationship: null }, { conditionId: '4', relationship: 'Mother' }] },
      hospitalizationProfile: { hospitalizations: [{ conditionId: '5', admissionDate: '2026-01-02', dischargeDate: '2026-01-03' }] },
      dentalHistory: { seenByDentist: false, lastVisitDate: '2026-02-01', lastDentalCleaning: '7-12' },
      dentalPhotoRecord: { upperTeeth: 'approved-upper', lowerTeeth: 'approved-lower' },
      oralApplianceProfile: { appliances: [{ tagId: '6', status: 'Active', arch: 'Upper' }] },
    }, { stageExistingPhotos: true });
    expect(form).toMatchObject({
      selfConditions: { 3: true }, familyConditions: { 4: { checked: true, relationship: 'Mother' } },
      hospitalizationDates: { 5: { admissionDate: '2026-01-02', dischargeDate: '2026-01-03' } },
      seenByDentist: false, lastVisitDate: '2026-02', hasOralAppliances: true,
    });
    expect(form.upperTeethPhoto.file).toBeInstanceOf(File);
    expect(form.upperTeethPhoto).not.toHaveProperty('id');
    await submitDentalUpdate(form);
    const photoWrite = axiosRequest.mock.calls.find(([config]) => config.data?.query.includes('mutation CreateDentalPhotoRecord'));
    expect(photoWrite[0].data.variables.input).toEqual({ upperTeeth: 'new-upper', lowerTeeth: 'new-lower' });
  } finally {
    URL.createObjectURL = createObjectURL;
  }
});

it.each(['Follow up in June\nBring vaccine card', null])('round-trips vaccine details without retired profile notes (%s)', async notes => {
  const immunizations = [{ vaccineTypeId: 8, doseNumber: 2, immunizationDate: '2025-01-02' }];
  const form = await mapRevisionDataToFormData({ immunizationProfile: { immunizations, notes } });
  expect(form).not.toHaveProperty('immunizationNotes');
  axiosRequest.mockResolvedValue({ data: { data: { createImmunizationProfile: { id: 12 } } } });
  await createImmunizationProfile(form);
  expect(axiosRequest.mock.lastCall[0].data.variables.input).toEqual({ immunizations });
});

it('restores saved negative dental answers during revision', async () => {
  const form = await mapRevisionDataToFormData({
    dentalProcedureProfile: { procedures: [] },
    oralApplianceProfile: { appliances: [] },
  });
  expect(form).toMatchObject({ hasDentalProcedures: false, hasOralAppliances: false });
});
