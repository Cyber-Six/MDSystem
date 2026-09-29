jest.mock('../wrapper/wrapper', () => ({ Query: { _getAvailableMedicine: jest.fn(), _getPatientPrescriptions: jest.fn() }, Mutation: { _issuePrescription: jest.fn() } }));
jest.mock('../wrapper/helper', () => ({ validateBatchesWithQuantity: jest.fn() }));
jest.mock('../../../../../services/authorization/permit', () => ({ permissions: { inventory_allow_prescribe: 'prescribe' }, isMedicalPermitted: jest.fn(), isMedicalPermittedPatientBased: jest.fn() }));
jest.mock('../../../../../utils/logger', () => ({ warn: jest.fn() }));
const wrapper = require('../wrapper/wrapper');
const permit = require('../../../../../services/authorization/permit');
const helper = require('../wrapper/helper');
const { Query, Mutation } = require('./medical-resolver');
let context;
beforeEach(() => {
  jest.resetAllMocks();
  context = { user: { id: 9 }, res: { status: jest.fn().mockReturnThis() } };
  permit.isMedicalPermitted.mockResolvedValue({ permitted: true });
  permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
});
const cases = [
  ['getAvailableMedicine', Query, { location: 'Main', offset: 1, limit: 5 }, wrapper.Query._getAvailableMedicine],
  ['getPatientPrescriptions', Query, { patientId: 3, offset: 1, limit: 5 }, wrapper.Query._getPatientPrescriptions],
  ['issuePrescription', Mutation, { input: { patientId: 3, items: [] } }, wrapper.Mutation._issuePrescription],
];
test.each(cases)('%s rejects unauthenticated and unauthorized requests', async (name, resolvers, args, operation) => {
  await expect(resolvers[name](null, args, { res: context.res })).rejects.toThrow('Unauthorized');
  expect(permit.isMedicalPermitted).not.toHaveBeenCalled();
  expect(permit.isMedicalPermittedPatientBased).not.toHaveBeenCalled();
  permit.isMedicalPermitted.mockResolvedValue({ permitted: false });
  permit.isMedicalPermittedPatientBased.mockResolvedValue(false);
  await expect(resolvers[name](null, args, context)).rejects.toThrow('Unauthorized');
  expect(context.res.status).toHaveBeenCalledWith(401);
  expect(operation).not.toHaveBeenCalled();
});
test.each(cases)('%s forwards authorized input and propagates dependency failures', async (name, resolvers, args, operation) => {
  operation.mockResolvedValueOnce({ id: 17 }).mockRejectedValueOnce(new Error('database unavailable'));
  await expect(resolvers[name](null, args, context)).resolves.toEqual({ id: 17 });
  const forwarded = name === 'issuePrescription' ? { ...args, issuedBy: 9 } : args;
  expect(operation).toHaveBeenCalledWith(null, forwarded, context);
  if (name === 'getAvailableMedicine') expect(permit.isMedicalPermitted).toHaveBeenCalledWith(9, 'prescribe');
  else expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(9, 'prescribe', 3, false);
  await expect(resolvers[name](null, args, context)).rejects.toThrow('database unavailable');
});
test.each([null, { batchId: '1', quantity: 1 }, { batchId: 1, quantity: 1.5 }, { batchId: 1, quantity: 0 }, { batchId: 1, quantity: -2 }])('rejects malformed prescription item %j', async item => {
  await expect(Mutation.issuePrescription(null, { input: { patientId: 3, items: [item] } }, context)).rejects.toThrow('valid batchId and positive quantity');
  expect(context.res.status).toHaveBeenCalledWith(400);
  expect(helper.validateBatchesWithQuantity).not.toHaveBeenCalled();
  expect(wrapper.Mutation._issuePrescription).not.toHaveBeenCalled();
});
test('validates total quantities across duplicate batches before issuance', async () => {
  const input = { patientId: 3, items: [{ batchId: 2, quantity: 3 }, { batchId: 2, quantity: 4 }, { batchId: 5, quantity: 1 }] };
  await Mutation.issuePrescription(null, { input }, context);
  expect(helper.validateBatchesWithQuantity).toHaveBeenCalledWith([{ batchId: 2, quantity: 7 }, { batchId: 5, quantity: 1 }], context.res);
  expect(wrapper.Mutation._issuePrescription).toHaveBeenCalledWith(null, { input, issuedBy: 9 }, context);
  wrapper.Mutation._issuePrescription.mockClear();
  helper.validateBatchesWithQuantity.mockRejectedValueOnce(new Error('insufficient stock'));
  await expect(Mutation.issuePrescription(null, { input }, context)).rejects.toThrow('insufficient stock');
  expect(wrapper.Mutation._issuePrescription).not.toHaveBeenCalled();
});
