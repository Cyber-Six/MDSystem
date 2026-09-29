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
});
