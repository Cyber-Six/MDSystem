jest.mock('../../config/jwt.js', () => ({ handleLogin: jest.fn() }));
jest.mock('../security.js', () => ({ generateRandomKey: jest.fn() }));
jest.mock('../portal.js', () => ({ detectPortalFromSubdomain: jest.fn() }));

const { handleLogin } = require('../../config/jwt.js');
const { generateRandomKey } = require('../security.js');
const { detectPortalFromSubdomain } = require('../portal.js');
const AuthSession = require('../authSession');

describe('AuthSession.create', () => {
  test('creates a role-specific session token bundle', async () => {
    generateRandomKey.mockReturnValue('device-key');
    detectPortalFromSubdomain.mockReturnValue('Medical');
    handleLogin.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

    await expect(AuthSession.create({ headers: { host: 'staff.test' } }, 'user-1')).resolves.toEqual({
      accessToken: 'access', refreshToken: 'user-1:device-key:refresh',
    });
    expect(handleLogin).toHaveBeenCalledWith({ userId: 'user-1', deviceId: 'device-key', role: 'medical' });
  });
});
