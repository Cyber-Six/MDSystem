import { axiosRequest } from '../../../../packages-core-adapter';
import { createImmunizationProfile, fetchUpdateRecordPrefill, getUpdateTicketStatus, mapRevisionDataToFormData, submitDentalUpdate, submitUpdateRecord } from '../update-record-service';
import fs from 'fs';
import path from 'path';

const { buildSchema, parse, validate } = require('../../../../../../Backend/node_modules/graphql');
const emrSchema = buildSchema(fs.readFileSync(path.resolve(__dirname, '../../../../../../Backend/routes/emr/schema.graphql'), 'utf8'));

it('sends medical update profiles in one serial GraphQL request before final submission', async () => {
  axiosRequest.mockReset().mockImplementation(async config => {
    const query = config.data.query;
    if (query.includes('GetUpdateTicketStatus')) return { data: { data: { getUpdateTicket: null } } };
    if (query.includes('CreateUpdateTicket')) return { data: { data: { createUpdateTicket: '42' } } };
    if (query.includes('SaveRecordUpdate')) return { data: { data: {} } };
    if (query.includes('SubmitUpdateTicket')) return { data: { data: { submitUpdateTicket: 'Pending' } } };
    throw new Error('Unexpected request');
  });
  const result = await submitUpdateRecord({ sex: 'Male' }, 'medical', { skipPersonalUpdate: true });
  const queries = axiosRequest.mock.calls.map(([config]) => config.data.query);
  expect(queries).toHaveLength(4);
  expect(validate(emrSchema, parse(queries[2]))).toEqual([]);
  expect(queries[2]).toContain('createMedicalHistory');
  expect(queries[2]).toContain('createMedicationProfile');
  expect(queries[3]).toContain('submitUpdateTicket');
  expect(result.finalStatus).toBe('Pending');
});

it('does not submit the ticket when a profile in the update batch fails', async () => {
  axiosRequest.mockReset().mockImplementation(async config => {
    const query = config.data.query;
    if (query.includes('GetUpdateTicketStatus')) return { data: { data: { getUpdateTicket: { id: '42', status: 'Revision', scope: 'Medical' } } } };
    if (query.includes('SaveRecordUpdate')) return { data: { data: { createMedicalHistory: null }, errors: [{ message: 'Synthetic failure' }] } };
    throw new Error('Unexpected request');
  });
  await expect(submitUpdateRecord({ sex: 'Male' }, 'medical', { skipPersonalUpdate: true, revisionTicketId: '42' })).rejects.toThrow('Stored records could not be loaded');
  expect(axiosRequest.mock.calls.some(([config]) => config.data.query.includes('SubmitUpdateTicket'))).toBe(false);
});

it.each([
  ['dental', 'Student', 'Female', false],
  ['both', 'Employee', 'Female', false],
  ['both', 'Student', 'Female', true],
])('batches %s for %s including revision=%s', async (scope, profileType, sex, revision) => {
  const expectedScope = scope === 'both' ? 'Both' : 'Dental';
  axiosRequest.mockReset().mockImplementation(async config => {
    const query = config.data.query;
    if (query.includes('GetUpdateTicketStatus')) return { data: { data: { getUpdateTicket: revision ? { id: '42', status: 'Revision', scope: expectedScope } : null } } };
    if (query.includes('CreateUpdateTicket')) return { data: { data: { createUpdateTicket: '42' } } };
    if (query.includes('SaveRecordUpdate')) return { data: { data: {} } };
    if (query.includes('SubmitUpdateTicket')) return { data: { data: { submitUpdateTicket: revision ? 'RevisionSubmitted' : 'Pending' } } };
    throw new Error('Unexpected request');
  });
  const result = await submitUpdateRecord({ profileType, sex }, scope, { skipPersonalUpdate: true, revisionTicketId: revision ? '42' : null });
  const queries = axiosRequest.mock.calls.map(([config]) => config.data.query);
  const batch = queries.find(query => query.includes('SaveRecordUpdate'));
  expect(queries).toHaveLength(revision ? 3 : 4);
  expect(validate(emrSchema, parse(batch))).toEqual([]);
  expect(batch).toContain('createDentalPhotoRecord');
  expect(batch.includes('createMedicalHistory')).toBe(scope === 'both');
  expect(batch.includes('createObgynHistory')).toBe(scope === 'both');
  expect(result.finalStatus).toBe(revision ? 'RevisionSubmitted' : 'Pending');
});

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

it.each(['Student', 'Employee'])('restages saved photo IDs on every %s revision attempt', async profileType => {
  let saveAttempts = 0;
  axiosRequest.mockReset().mockImplementation(async config => {
    if (config.method === 'GET') return { data: new Blob(['synthetic photo'], { type: 'image/png' }) };
    const query = config.data.query;
    if (query.includes('GetUpdateTicketStatus')) return { data: { data: { getUpdateTicket: { id: '42', status: 'Revision', scope: 'Dental' } } } };
    if (query.includes('SaveRecordUpdate')) {
      saveAttempts += 1;
      if (saveAttempts === 1) return { data: { data: { createDentalPhotoRecord: null }, errors: [{ message: 'FILE_NOT_FOUND' }] } };
      return { data: { data: {} } };
    }
    if (query.includes('SubmitUpdateTicket')) return { data: { data: { submitUpdateTicket: 'RevisionSubmitted' } } };
    throw new Error('Unexpected request');
  });
  axiosRequest.post.mockReset()
    .mockResolvedValueOnce({ data: { fileId: 'staged-upper-1' } })
    .mockResolvedValueOnce({ data: { fileId: 'staged-lower-1' } })
    .mockResolvedValueOnce({ data: { fileId: 'staged-upper-2' } })
    .mockResolvedValueOnce({ data: { fileId: 'staged-lower-2' } });
  const form = { profileType, upperTeethPhoto: { id: 'saved-upper' }, lowerTeethPhoto: { id: 'saved-lower' } };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const submission = submitUpdateRecord(form, 'dental', { skipPersonalUpdate: true, revisionTicketId: '42' });
    if (attempt === 1) {
      await expect(submission).rejects.toThrow();
      expect(axiosRequest.mock.calls.some(([config]) => config.data?.query.includes('SubmitUpdateTicket'))).toBe(false);
    } else {
      await expect(submission).resolves.toMatchObject({ finalStatus: 'RevisionSubmitted' });
    }
    const batch = axiosRequest.mock.calls.filter(([config]) => config.data?.query.includes('SaveRecordUpdate')).at(-1)[0];
    const photoInput = Object.values(batch.data.variables).find(input => Object.hasOwn(input, 'upperTeeth'));
    expect(photoInput).toEqual({ upperTeeth: `staged-upper-${attempt}`, lowerTeeth: `staged-lower-${attempt}` });
  }
  expect(form.upperTeethPhoto.id).toBe('saved-upper');
  expect(axiosRequest.mock.calls.filter(([config]) => config.method === 'GET')).toHaveLength(4);
});

it('stops before record writes when a saved photo is unavailable', async () => {
  axiosRequest.mockReset().mockRejectedValue(new Error('Synthetic missing file'));
  axiosRequest.post.mockClear();
  await expect(submitDentalUpdate({ upperTeethPhoto: { id: 'missing-photo' } })).rejects.toThrow('Please upload both teeth photos again');
  expect(axiosRequest.post).not.toHaveBeenCalled();
  expect(axiosRequest.mock.calls.every(([config]) => config.method === 'GET')).toBe(true);
});
