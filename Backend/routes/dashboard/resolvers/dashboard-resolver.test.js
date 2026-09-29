jest.mock('./wrapper', () => ({ Query: { _getDashboardStats: jest.fn(), _getPatientDashboardData: jest.fn() } }));
jest.mock('../../../services/permit', () => ({ isMedicalPermitted: jest.fn(), permissions: { is_staff: 'is_staff' } }));
const wrapper = require('./wrapper');
const permit = require('../../../services/permit');
const { Query } = require('./dashboard-resolver');
beforeEach(() => jest.resetAllMocks());
test.each(['getDashboardStats', 'getPatientDashboardData'])('rejects anonymous %s access', async method => {
  const res = { status: jest.fn().mockReturnThis() };
  await expect(Query[method](null, {}, { res })).rejects.toThrow('Unauthorized');
  expect(res.status).toHaveBeenCalledWith(401);
});
test('requires staff permission before resolving medical statistics', async () => {
  const context = { user: { id: 12 }, res: { status: jest.fn().mockReturnThis() } };
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false }).mockResolvedValueOnce({ permitted: true });
  await expect(Query.getDashboardStats(null, {}, context)).rejects.toThrow('Staff access required');
  expect(wrapper.Query._getDashboardStats).not.toHaveBeenCalled();
  wrapper.Query._getDashboardStats.mockResolvedValue({ total: 5 });
  await expect(Query.getDashboardStats(null, { branch: 'Manila' }, context)).resolves.toEqual({ total: 5 });
  expect(permit.isMedicalPermitted).toHaveBeenCalledWith(12, 'is_staff');
  expect(wrapper.Query._getDashboardStats).toHaveBeenCalledWith(null, { branch: 'Manila' }, context);
});
test('forwards authenticated patient context', async () => {
  const context = { user: { id: 12 } };
  wrapper.Query._getPatientDashboardData.mockResolvedValue({ appointments: [] });
  await expect(Query.getPatientDashboardData(null, {}, context)).resolves.toEqual({ appointments: [] });
  expect(wrapper.Query._getPatientDashboardData).toHaveBeenCalledWith(null, {}, context);
  expect(permit.isMedicalPermitted).not.toHaveBeenCalled();
});
