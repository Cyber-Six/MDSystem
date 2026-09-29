const mockQueryDelegates = {};
const mockMutationDelegates = {};
const proxy = delegates => new Proxy({}, { get(_target, name) { return delegates[name] ||= jest.fn(); } });
jest.mock('../wrapper/wrapper.js', () => ({ Query: proxy(mockQueryDelegates), Mutation: proxy(mockMutationDelegates) }));
jest.mock('../../../../../services/authorization/permit.js', () => ({ permissions: { consultation_allow_view: 'VIEW', consultation_allow_edit: 'EDIT' }, isMedicalPermittedPatientBased: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ getPatientIdFromConsultationId: jest.fn(), getPatientIdFromOutcomeId: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js'); const permit = require('../../../../../services/authorization/permit.js'); const helper = require('../wrapper/helper.js');
const { Query, Mutation } = require('./medical-resolver.js');
const ctx = (user = { id: 5 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
const args = { patientId: 9, consultationId: 3, outcomeId: 4, offset: 1, limit: 2, code: 'X', title: 'Y', id: 8, input: { patientId: 9, consultationId: 3 }, status: 'Open', notes: 'notes', followUpId: 7, remarks: 'remarks', complaints: [], peFindings: [], treatments: [], diagnoses: [] };
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermittedPatientBased.mockResolvedValue(true); helper.getPatientIdFromConsultationId.mockResolvedValue(9); helper.getPatientIdFromOutcomeId.mockResolvedValue(9); });

test('every consultation operation rejects callers without a medical user', async () => {
  for (const operation of [...Object.values(Query), ...Object.values(Mutation)]) await expect(operation(null, args, ctx(null))).rejects.toThrow('Unauthorized');
  expect(permit.isMedicalPermittedPatientBased).not.toHaveBeenCalled();
});

test('consultation queries authorize patient scope and delegate exact arguments', async () => {
  const context = ctx();
  for (const [name, operation] of Object.entries(Query)) {
    const delegate = Wrapper.Query[`_${name}`]; const result = { name }; delegate.mockResolvedValueOnce(result);
    expect(await operation(null, args, context)).toBe(result);
    const expectedArgs = name === 'getConsultations' ? { patientId: 9, offset: 1, limit: 2 }
      : name === 'getOutcomes' ? { consultationId: 3, offset: 1, limit: 2 }
      : ['getComplaints', 'getPEFindings', 'getTreatments', 'getDiagnoses'].includes(name) ? { outcomeId: 4, offset: 1, limit: 2 }
      : name === 'getIcdViaCode' ? { code: 'X' } : name === 'getIcdViaTitle' ? { title: 'Y' } : { id: 8 };
    expect(delegate).toHaveBeenLastCalledWith(null, expectedArgs, context);
  }
  expect(helper.getPatientIdFromConsultationId).toHaveBeenCalledWith(3);
  expect(helper.getPatientIdFromOutcomeId).toHaveBeenCalledWith(4);
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'VIEW', 9);
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'VIEW', 9, true);
});

test('view permission denial blocks every patient-backed query but not ICD lookup', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false); const context = ctx();
  for (const name of ['getConsultations', 'getOutcomes', 'getComplaints', 'getPEFindings', 'getTreatments', 'getDiagnoses']) {
    await expect(Query[name](null, args, context)).rejects.toThrow('Not permitted to access medical data');
    expect(Wrapper.Query[`_${name}`]).not.toHaveBeenCalled();
  }
  Wrapper.Query._getIcdViaCode.mockResolvedValueOnce('diagnosis');
  expect(await Query.getIcdViaCode(null, args, context)).toBe('diagnosis');
});

test('consultation mutations authorize the linked patient and delegate updates', async () => {
  const context = ctx();
  for (const [name, operation] of Object.entries(Mutation)) {
    const target = name === 'openConsultation' || name === 'reOpenConsultation' ? '_OpenConsultation' : `_${name}`;
    const delegate = Wrapper.Mutation[target]; const result = { name }; delegate.mockResolvedValueOnce(result);
    expect(await operation(null, args, context)).toBe(result);
    let expectedArgs;
    if (name === 'createConsultation') expectedArgs = { input: args.input };
    else if (name === 'openConsultation' || name === 'reOpenConsultation') expectedArgs = { input: args.input, _status: name === 'openConsultation' ? 'Open' : 'ReOpen' };
    else { const fields = { updateConsultationNotes: 'notes', updateConsultationFollowUpId: 'followUpId', updateOutcomeRemarks: 'remarks', updateComplaints: 'complaints', updatePEFindings: 'peFindings', updateTreatments: 'treatments', updateDiagnoses: 'diagnoses' }; const field = fields[name]; expectedArgs = { consultationId: 3, [field]: args[field] }; }
    if (name === 'submitConsultation') expectedArgs = { consultationId: 3, status: 'Open' };
    expect(delegate).toHaveBeenLastCalledWith(null, expectedArgs, context);
  }
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'EDIT', 9, true);
});

test('edit permission denial blocks every mutation', async () => {
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false); const context = ctx();
  for (const operation of Object.values(Mutation)) await expect(operation(null, args, context)).rejects.toThrow('Not permitted to modify medical data');
  expect(Wrapper.Mutation._createConsultation).not.toHaveBeenCalled();
  expect(Wrapper.Mutation._OpenConsultation).not.toHaveBeenCalled();
});
