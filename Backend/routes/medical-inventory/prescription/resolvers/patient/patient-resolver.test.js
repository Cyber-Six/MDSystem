jest.mock('../wrapper/wrapper', () => ({ Query: { _getPatientPrescriptions: jest.fn() } }));
const wrapper = require('../wrapper/wrapper');
const { Query, Mutation } = require('./patient-resolver');
test('rejects unauthenticated access and scopes prescriptions to the authenticated patient', async () => {
  const res = { status: jest.fn().mockReturnThis() };
  await expect(Query.getMyPrescriptions(null, {}, { res })).rejects.toThrow('Unauthorized');
  expect(res.status).toHaveBeenCalledWith(401);
  expect(wrapper.Query._getPatientPrescriptions).not.toHaveBeenCalled();
  const user = { id: 12 };
  wrapper.Query._getPatientPrescriptions.mockResolvedValue([{ id: 4 }]);
  await expect(Query.getMyPrescriptions(null, { offset: 2, limit: 10 }, { user, res })).resolves.toEqual([{ id: 4 }]);
  expect(wrapper.Query._getPatientPrescriptions).toHaveBeenCalledWith(null, { patientId: 12, offset: 2, limit: 10 }, { user, res });
  expect(Mutation).toEqual({});
});
