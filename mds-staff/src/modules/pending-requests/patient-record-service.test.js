import { axiosRequest } from '../../packages-core-adapter';
import * as service from './patient-record-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('patient record service fetchers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => console.warn.mockRestore());

  it.each([
    ['getPatientBasicInfo', 'getPatientBasicInfo'],
    ['getUserProfile', 'getUserProfile'],
    ['getUserEmergencyContact', 'getUserEmergencyContact'],
    ['getUserMedicalHistory', 'getUserMedicalHistory'],
    ['getUserLifestyle', 'getUserLifestyle'],
    ['getUserAllergyProfile', 'getUserAllergyProfile'],
    ['getUserMedicationProfile', 'getUserMedicationProfile'],
    ['getUserImmunizationProfile', 'getUserImmunizationProfile'],
    ['getUserHospitalizationProfile', 'getUserHospitalizationProfile'],
    ['getUserOperationProfile', 'getUserOperationProfile'],
    ['getUserVisualAcuityProfile', 'getUserVisualAcuityProfile'],
    ['getUserObgynHistory', 'getUserObgynHistory'],
    ['getUserDentalHistory', 'getUserDentalHistory'],
    ['getUserDentalProcedureProfile', 'getUserDentalProcedureProfile'],
    ['getUserOralApplianceProfile', 'getUserOralApplianceProfile'],
    ['getUserDentalPhotoRecord', 'getUserDentalPhotoRecord'],
  ])('%s returns its GraphQL field with graceful null defaults', async (method, field) => {
    const value = { id: field };
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { [field]: value } } });
    await expect(service[method]('patient-1')).resolves.toBe(value);
    expect(axiosRequest.post).toHaveBeenCalledWith('/emr/medical', expect.objectContaining({
      query: expect.stringContaining(field), variables: { userId: 'patient-1' },
    }));

    axiosRequest.post.mockResolvedValueOnce({ data: { data: {} } });
    await expect(service[method]('patient-1')).resolves.toEqual(method === 'getPatientBasicInfo' ? null : []);
  });

  it('uses the staff EMR endpoint for vital signs', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { getPatientVitalSigns: [{ id: 'v1' }] } } });
    await expect(service.getUserVitalSigns('patient-1')).resolves.toEqual([{ id: 'v1' }]);
    expect(axiosRequest.post).toHaveBeenCalledWith('/staff/emr', expect.objectContaining({
      query: expect.stringContaining('GetPatientVitalSigns'), variables: { patientId: 'patient-1' },
    }));
  });

  it.each(['getUserMedicalHistory', 'getUserImmunizationProfile'])('%s reads child details without retired notes', async method => {
    axiosRequest.post.mockResolvedValue({ data: { data: {} } });
    await service[method]('synthetic');
    expect(axiosRequest.post.mock.lastCall[1].query).not.toMatch(/\bnotes\b/);
  });

  it('ignores stale history note edits and still saves lifestyle notes', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: {} } });
    await service.submitStaffEdits('synthetic', { medicalHistory: { notes: 'retired' } }, {});
    expect(axiosRequest.post).not.toHaveBeenCalled();
    await service.submitStaffEdits('synthetic', { medicalBackground: { lifestyleNotes: 'Keep this note' } }, {});
    expect(axiosRequest.post.mock.lastCall[1].variables.input.notes).toBe('Keep this note');
  });

  it('batches patient records with stable aliases, partial data, and empty input', async () => {
    await expect(service.getPatientBasicInfoBatch([])).resolves.toEqual(new Map());
    axiosRequest.post.mockResolvedValue({ data: { errors: [{ message: 'partial' }], data: { u_a_b: { id: 'a/b' } } } });
    await expect(service.getPatientBasicInfoBatch(['a/b', 2])).resolves.toEqual(new Map([
      ['a/b', { id: 'a/b' }], ['2', null],
    ]));
    expect(axiosRequest.post).toHaveBeenCalledWith('/emr/medical', expect.objectContaining({
      query: expect.stringContaining('u_a_b'),
    }));
  });

  it('returns null-filled batch results after a request failure', async () => {
    axiosRequest.post.mockRejectedValue(new Error('offline'));
    await expect(service.getPatientBasicInfoBatch(['a', 'b'])).resolves.toEqual(new Map([['a', null], ['b', null]]));
  });

  it('selects the exact ticket, includes submitted custom fields, and resolves later unapproved catalog pages', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: String(index + 1), name: `Condition ${index}` }));
    axiosRequest.post.mockImplementation(async (endpoint, { query, variables }) => {
      if (endpoint === '/profile/medical') return { data: { data: { logs: [{ first_name: 'Original', present_address: 'Line one\nLine two' }] } } };
      if (endpoint === '/staff/emr') return { data: { data: { getPatientVitalSigns: [] } } };
      if (query.includes('ReviewCatalogPage')) {
        expect(variables.offset).toBe(200);
        expect(query).not.toContain('filterIsValid');
        return { data: { data: { rows: [{ id: '201', name: 'QA Pending Custom Condition' }] } } };
      }
      for (const field of ['employmentCategoryOther', 'address', 'yearsVaping', 'otherDescription', 'otherArch']) expect(query).toContain(field);
      expect(query).not.toContain('filterIsValid: true');
      return { data: { data: { reviewTicket: { id: 'selected' }, basicInfo: { id: 'patient', profile_type: 'Employee' },
        profile: [{ id: 'newer', department: 'Wrong' }, { id: 'selected', department: 'Correct', employmentCategoryOther: 'Research QA' }],
        medicalHistory: [{ id: 'newer' }, { id: 'selected', conditions: [{ conditionId: '201' }] }],
        oralApplianceProfile: [{ id: 'selected', otherDescription: 'QA Other Appliance', otherArch: 'Upper' }], medicalConditionCatalog: firstPage,
      } } };
    });
    const record = await service.fetchPatientRecordForReview('patient', 'Both', 'Female', 'selected');
    expect(record.profile.department).toBe('Correct');
    expect(record.basicInfo.present_address).toBe('Line one\nLine two');
    expect(record.medicalHistory.id).toBe('selected');
    expect(record.oralApplianceProfile.otherDescription).toBe('QA Other Appliance');
    expect(record.catalogs.medicalConditionCatalog).toHaveLength(201);
    expect(record.catalogs.medicalConditionCatalog[200].name).toBe('QA Pending Custom Condition');
  });

  it('does not replace a missing selected section with another ticket', async () => {
    axiosRequest.post.mockImplementation(async endpoint => ({ data: { data: endpoint === '/emr/medical'
      ? { reviewTicket: { id: 'selected' }, basicInfo: { id: 'p' }, medicalHistory: [{ id: 'wrong' }] } : {} } }));
    const record = await service.fetchPatientRecordForReview('p', 'Medical', null, 'selected');
    expect(record.medicalHistory).toBeNull();
  });

  it('reads ticket-linked profiles and contacts without fetching account details for updates', async () => {
    const profile = { id: 'ticket', __typename: 'StudentProfile', program: 'QA Program' };
    const emergencyContact = { id: 'ticket', firstContact: { contactName: 'QA Contact' } };
    axiosRequest.post.mockResolvedValue({
      data: { data: { reviewTicket: { id: 'ticket' }, profile: [{ id: 'other' }, profile], emergencyContact: [emergencyContact] } },
    });
    const record = await service.fetchPatientRecordForReview('patient', 'Dental', null, 'ticket', false);
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
    const [endpoint, { query, variables }] = axiosRequest.post.mock.calls[0];
    expect(endpoint).toBe('/emr/medical');
    expect(query).not.toContain('getPatientBasicInfo');
    expect(query).toContain('getUserProfile(userId: $userId, ticketId: $ticketId, limit: 1)');
    expect(query).not.toContain('getUserMedicalHistory');
    expect(variables).toEqual({ userId: 'patient', ticketId: 'ticket' });
    expect(record.basicInfo).toBeNull();
    expect(record.profile).toEqual(profile);
    expect(record.emergencyContact).toEqual(emergencyContact);
  });

  it('loads vital signs using the chosen ticket link, independent of the ticket ID', async () => {
    const vitalSigns = { id: 'measurement', patientId: 'patient', heart_rate: 70, notes: 'Synthetic note' };
    axiosRequest.post
      .mockResolvedValueOnce({ data: { data: { reviewTicket: { id: 'ticket', vitalSignsId: vitalSigns.id } } } })
      .mockResolvedValueOnce({ data: { data: { record: vitalSigns } } });

    const record = await service.fetchPatientRecordForReview('patient', 'Medical', null, 'ticket', false);
    expect(axiosRequest.post).toHaveBeenLastCalledWith('/staff/emr', expect.objectContaining({
      query: expect.stringContaining('getVitalSignsById'),
      variables: { id: 'measurement' },
    }));
    expect(record.vitalSigns).toEqual(vitalSigns);
  });

  it('rejects a missing selected ticket before a review decision is possible', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { reviewTicket: null } } });
    await expect(service.fetchPatientRecordForReview('patient', 'Medical', null, 'missing', false))
      .rejects.toThrow('The selected ticket could not be loaded for this patient.');
  });

  it('surfaces GraphQL read failures so staff cannot approve an apparently empty record', async () => {
    axiosRequest.post.mockImplementation(async endpoint => ({ data: endpoint === '/emr/medical'
      ? { errors: [{ message: 'Missing record column' }] } : { data: {} } }));
    await expect(service.fetchPatientRecordForReview('p')).rejects.toThrow('Missing record column');
  });
});
