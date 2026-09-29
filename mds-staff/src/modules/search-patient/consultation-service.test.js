import { axiosRequest } from '../../packages-core-adapter';
import {
  DIAGNOSIS_TYPES,
  createVitalSignsForConsultation,
  getComplaints,
  getConsultations,
  getDiagnoses,
  getIcdViaCode,
  getIcdViaTitle,
  getOutcomes,
  getPEFindings,
  getTreatments,
  mapToBackendDiagnosis,
  openConsultation,
  createConsultation,
  reOpenConsultation,
  submitConsultation,
  updateComplaints,
  updateConsultationFollowUpId,
  updateConsultationNotes,
  updateDiagnoses,
  updateOutcomeRemarks,
  updatePEFindings,
  updateTreatments,
} from './consultation-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('staff consultation service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('maps diagnosis entries to valid backend values', () => {
    expect(DIAGNOSIS_TYPES).toContain('Primary');
    expect(mapToBackendDiagnosis({ id: '3', title: 'Flu', diagnosisType: 'Primary', notes: ' note ' })).toEqual({
      outcomeId: '0', diagnosisName: 'Flu', icdId: 3, diagnosisType: 'Primary', notes: 'note',
    });
    expect(mapToBackendDiagnosis({ icdId: 4, diagnosisName: 'Cold', type: 'Invalid' }).diagnosisType).toBe('Secondary');
  });

  it.each([
    ['getConsultations', getConsultations, 'getConsultations', [7, 1, 2]],
    ['getOutcomes', getOutcomes, 'getOutcomes', [7, 1, 2]],
    ['getComplaints', getComplaints, 'getComplaints', [7, 1, 2]],
    ['getPEFindings', getPEFindings, 'getPEFindings', [7, 1, 2]],
    ['getTreatments', getTreatments, 'getTreatments', [7, 1, 2]],
    ['getDiagnoses', getDiagnoses, 'getDiagnoses', [7, 1, 2]],
    ['getIcdViaCode', getIcdViaCode, 'getIcdViaCode', ['A01']],
    ['getIcdViaTitle', getIcdViaTitle, 'getIcdViaTitle', ['Flu']],
    ['createConsultation', createConsultation, 'createConsultation', [{ patientId: 'p1' }]],
    ['openConsultation', openConsultation, 'openConsultation', [{ consultationId: 'c1' }]],
    ['reOpenConsultation', reOpenConsultation, 'reOpenConsultation', [{ consultationId: 'c1' }]],
    ['submitConsultation', submitConsultation, 'submitConsultation', [7, 'Completed']],
    ['updateConsultationNotes', updateConsultationNotes, 'updateConsultationNotes', [7, 'note']],
    ['updateConsultationFollowUpId', updateConsultationFollowUpId, 'updateConsultationFollowUpId', [7, 8]],
    ['updateOutcomeRemarks', updateOutcomeRemarks, 'updateOutcomeRemarks', [7, 'remark']],
    ['updateComplaints', updateComplaints, 'updateComplaints', [7, ['pain']]],
    ['updatePEFindings', updatePEFindings, 'updatePEFindings', [7, ['fever']]],
    ['updateTreatments', updateTreatments, 'updateTreatments', [7, ['rest']]],
    ['updateDiagnoses', updateDiagnoses, 'updateDiagnoses', [7, [{ diagnosisName: 'Flu' }]]],
  ])('%s returns its GraphQL result', async (_name, method, field, args) => {
    const value = { field };
    axiosRequest.post.mockResolvedValue({ data: { data: { [field]: value } } });
    await expect(method(...args)).resolves.toBe(value);
    expect(axiosRequest.post).toHaveBeenCalledWith('/consultation', expect.objectContaining({
      query: expect.stringContaining(field), variables: expect.any(Object),
    }));
  });

  it('surfaces GraphQL errors with partial result data', async () => {
    axiosRequest.post.mockResolvedValue({ data: { errors: [{ message: 'Denied' }], data: { partial: true } } });
    await expect(getConsultations('p1')).rejects.toMatchObject({ message: 'Denied', data: { partial: true } });
  });

  it('creates vital signs through the EMR endpoint and reports errors', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { createVitalSigns: { id: 'v1' } } } });
    await expect(createVitalSignsForConsultation(5, { weight: 60 })).resolves.toEqual({ id: 'v1' });
    expect(axiosRequest.post).toHaveBeenCalledWith('/staff/emr', expect.objectContaining({
      variables: { patientId: '5', input: { weight: 60 } },
    }));
    axiosRequest.post.mockResolvedValueOnce({ data: { errors: [{ message: 'Invalid vital signs' }] } });
    await expect(createVitalSignsForConsultation(5, {})).rejects.toThrow('Invalid vital signs');
  });
});
