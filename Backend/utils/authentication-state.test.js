jest.mock('../config/query', () => ({ getCredentialLockStateByUserId: jest.fn(), isActiveMedicalPersonnel: jest.fn() }));
const db = require('../config/query');
const { assertAccountAllowed } = require('./authentication-state');
beforeEach(() => jest.resetAllMocks());
test.each([null, { status: 'Locked' }, { status: 'locked' }])('rejects unavailable or locked accounts %j', async account => {
  db.getCredentialLockStateByUserId.mockResolvedValue(account);
  await expect(assertAccountAllowed(12, 'patient')).rejects.toThrow(account ? 'Account locked' : 'Account unavailable');
});
test.each(['Active', 'Unverified', 'Inactive'])('preserves patient registration access for status %s', async status => {
  db.getCredentialLockStateByUserId.mockResolvedValue({ status });
  await expect(assertAccountAllowed(12, 'patient')).resolves.toBeUndefined();
});
test('rechecks current staff membership before accepting a medical session', async () => {
  db.getCredentialLockStateByUserId.mockResolvedValue({ status: 'Active' });
  db.isActiveMedicalPersonnel.mockResolvedValue(false);
  await expect(assertAccountAllowed(12, 'medical')).rejects.toThrow('Staff session invalidated');
});
