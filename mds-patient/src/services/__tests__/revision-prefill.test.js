import { createInitialEmployeeRecord, createInitialMedicalRecord, fetchRevisionPrefill, mapRevisionDataToFormData } from '../emr-service';
import { sendGraphQLRequest } from '../../utils/graphql-client';
import { axiosRequest } from '../../packages-core-adapter';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: jest.fn() }));
jest.mock('../../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));

it('restores Student revision notes saved on hospitalization and operation entries', () => {
  const { medicalBackground } = mapRevisionDataToFormData({}, {
    emrProfile: { program: 'BS Computer Science', year: 'Freshman' },
    hospitalizationProfile: { notes: null, hospitalizations: [{ conditionId: 1, notes: 'Admitted overnight' }] },
    operationProfile: { notes: null, operations: [{ procedureId: 2, notes: 'Outpatient surgery' }] },
  });
  expect(medicalBackground.hospitalizationNotes).toBe('Admitted overnight');
  expect(medicalBackground.operationNotes).toBe('Outpatient surgery');
});

it.each(['', '+', null])('restores an empty second Employee contact phone from %p', (storedPhone) => {
  const { personalInfo } = mapRevisionDataToFormData({}, {
    emergencyContact: {
      firstContact: { contactNumber: '+639171234567' },
      secondContact: { contactNumber: storedPhone },
    },
  });
  expect(personalInfo.emergencyContacts.map(contact => contact.contactNumber)).toEqual(['+639171234567', '']);
});

it.each([
  [createInitialMedicalRecord, { studentNumber: 'ST-1' }],
  [createInitialEmployeeRecord, { employeeId: 'EMP-1', department: 'Facilities', branch: 'Manila' }],
])('submits an existing initial revision without cancelling either log or creating a ticket', async (submit, personalInfo) => {
  sendGraphQLRequest.mockReset();
  sendGraphQLRequest.mockImplementation(async (document) => {
    if (document.includes('getUpdateTicket')) return { getUpdateTicket: { id: '42', status: 'Revision' } };
    if (document.includes('submitUpdateTicket')) return { submitTicket: 'RevisionSubmitted' };
    return {};
  });
  await expect(submit({
    personalInfo, medicalHistory: {}, medicalBackground: {}, dentalHistory: {},
  }, { isRevision: true })).resolves.toMatchObject({ success: true, data: { ticketId: '42', submitStatus: 'RevisionSubmitted' } });
  const mutations = sendGraphQLRequest.mock.calls.map(([document]) => document.match(/\bmutation\s+(\w+)/)?.[1]).filter(Boolean);
  expect(mutations).toEqual(['CreateInitialPersonalRecord', 'BatchCreateInitialRecords']);
});

it('loads saved dental photos as previews and keeps their IDs on resubmission', async () => {
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:prior-photo');
  try {
    axiosRequest.mockResolvedValue({ data: new Blob(['photo']) });
    sendGraphQLRequest.mockReset();
    sendGraphQLRequest.mockImplementation(async (document) => {
      if (document.includes('GetRevisionEMRData')) return { dentalPhotoRecord: { upperTeeth: 'prior-upper', lowerTeeth: 'prior-lower' } };
      if (document.includes('getUpdateTicket')) return { getUpdateTicket: { id: '42', status: 'Revision' } };
      if (document.includes('submitUpdateTicket')) return { submitTicket: 'RevisionSubmitted' };
      return {};
    });
    const formData = await fetchRevisionPrefill();
    expect(formData.dentalHistory.upperTeethPhoto).toEqual({ preview: 'blob:prior-photo', name: 'Upper Teeth (previous submission)' });
    await createInitialMedicalRecord(formData, { isRevision: true });
    const [, variables] = sendGraphQLRequest.mock.calls.find(([document]) => document.includes('BatchCreateInitialRecords'));
    expect(variables.dentalPhotoInput).toEqual({ upperTeeth: null, lowerTeeth: null });
  } finally {
    URL.createObjectURL = createObjectURL;
  }
});

it('keeps profile-level notes when present and restores the submitted Employee position', () => {
  const { personalInfo, medicalBackground } = mapRevisionDataToFormData({}, {
    emrProfile: { department: 'Facilities', role: 'Other', position: 'Consultant' },
    hospitalizationProfile: { notes: 'Overall history', hospitalizations: [{ conditionId: 1, notes: 'Entry note' }] },
  });
  expect(personalInfo.position).toBe('Consultant');
  expect(medicalBackground.hospitalizationNotes).toBe('Overall history');
  expect(medicalBackground.operationNotes).toBe('');
});
