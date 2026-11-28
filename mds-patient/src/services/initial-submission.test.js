import { createInitialMedicalRecord, createInitialEmployeeRecord } from './emr-service';
import { sendGraphQLRequest } from '../utils/graphql-client';
import { axiosRequest } from '../packages-core-adapter';

jest.mock('../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));
jest.mock('../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn(), delete: jest.fn() } }));

beforeEach(() => {
  jest.resetAllMocks();
  for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const form = () => ({
  personalInfo: { studentNumber: '700001', firstName: 'Synthetic', surname: 'Fixture', gender: 'Male' },
  medicalHistory: { self: { 3: true }, family: { 4: true }, familyWhoHasIt: { 4: 'Mother' } },
  medicalBackground: { immunizations: { 8: true }, immunizationDates: { 8: '2025-01-02' }, immunizationDoses: { 8: 2 }, medicationNotes: 'Keep medication notes' },
  dentalHistory: {},
});

it.each([createInitialMedicalRecord, createInitialEmployeeRecord])('stops before tickets, media, or EMR writes when personal setup fails', async submit => {
  const failure = new Error('Failed to create initial personal record. Please try again later.');
  sendGraphQLRequest.mockRejectedValueOnce(failure);
  await expect(submit(form())).rejects.toBe(failure);
  expect(sendGraphQLRequest).toHaveBeenCalledTimes(1);
  expect(sendGraphQLRequest).toHaveBeenCalledWith(expect.stringContaining('createInitialPersonalRecord'),
    expect.any(Object), { endpoint: '/profile/patient' });
  expect(axiosRequest.post).not.toHaveBeenCalled();
});

it.each([
  ['student initial', createInitialMedicalRecord, false],
  ['employee initial', createInitialEmployeeRecord, false],
  ['student revision', createInitialMedicalRecord, true],
  ['employee revision', createInitialEmployeeRecord, true],
])('ignores retired OB-GYN values from a legacy draft during %s submission', async (_, submit, isRevision) => {
  sendGraphQLRequest.mockImplementation(async document => {
    if (document.includes('GetCurrentUpdateTicket')) return { getUpdateTicket: { id: '12', status: isRevision ? 'Revision' : 'InProgress' } };
    return {};
  });
  const fixture = form();
  fixture.personalInfo.gender = 'Female';
  fixture.obgyne = { lastMenstrualPeriod: '2026-11-12', menstruationDuration: '5', dysmenorrhea: 'Yes', menarcheYearAge: '12', padsPerDay: '3' };
  await expect(submit(fixture, { isRevision })).resolves.toMatchObject({ success: true });
  const [, variables] = sendGraphQLRequest.mock.calls.find(([document]) => document.includes('BatchCreateInitialRecords'));
  expect(variables.obgynInput).toEqual({ lastMenstrualPeriod: '2026-11-12', hasDysmenorrhea: true, notes: 'Duration: 5 days' });
});

it('sends child records without retired notes, then submits last and cleans up after batch failure', async () => {
  const failure = new Error('synthetic batch failure');
  sendGraphQLRequest.mockImplementation(async (document, variables) => {
    if (document.includes('BatchCreateInitialRecords')) {
      expect(variables.medHistInput).toEqual({ conditions: [
        { conditionId: '3', diagnosedDate: null, relationship: null, description: null },
        { conditionId: '4', diagnosedDate: null, relationship: 'Mother', description: null },
      ] });
      expect(variables.immuInput).toEqual({ immunizations: [{ vaccineTypeId: '8', immunizationDate: '2025-01-02', doseNumber: 2 }] });
      expect(document.indexOf('submitTicket: submitUpdateTicket')).toBeGreaterThan(document.indexOf('createImmunizationProfile'));
      throw failure;
    }
    if (document.includes('FetchAllCatalogs')) return { immunizationCatalog: [{ id: '8' }] };
    if (document.includes('GetCurrentUpdateTicket')) return { getUpdateTicket: { id: '12', status: 'InProgress' } };
    return {};
  });
  await expect(createInitialMedicalRecord(form())).rejects.toBe(failure);
  const operations = sendGraphQLRequest.mock.calls.map(([document]) => document);
  expect(operations[0]).toContain('createInitialPersonalRecord');
  expect(operations.at(-2)).toContain('cancelUpdateTicket');
  expect(operations.at(-1)).toContain('cancelPersonalRecordLog');
});
