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
      return { data: { data: { basicInfo: { id: 'patient', profile_type: 'Employee' },
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
      ? { basicInfo: { id: 'p' }, medicalHistory: [{ id: 'wrong' }] } : {} } }));
    const record = await service.fetchPatientRecordForReview('p', 'Medical', null, 'selected');
    expect(record.medicalHistory).toBeNull();
  });

  it('surfaces GraphQL read failures so staff cannot approve an apparently empty record', async () => {
    axiosRequest.post.mockImplementation(async endpoint => ({ data: endpoint === '/emr/medical'
      ? { errors: [{ message: 'Missing record column' }] } : { data: {} } }));
    await expect(service.fetchPatientRecordForReview('p')).rejects.toThrow('Missing record column');
  });
});
