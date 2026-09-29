jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../redis', () => ({ getStaffAnchor: jest.fn() }));
jest.mock('../../utils/logger', () => ({ error: jest.fn() }));
const jwt = require('jsonwebtoken');
const { getStaffAnchor } = require('../redis');
const { createAuthMiddleware } = require('./socket-auth');

beforeEach(() => jest.resetAllMocks());
async function authenticate(decoded, auth = { token: 'signed-token' }) {
  jwt.verify.mockReturnValue(decoded);
  const socket = { handshake: { auth } };
  const next = jest.fn();
  await createAuthMiddleware()(socket, next);
  return { socket, next };
}
test.each([undefined, {}, { token: '' }])('rejects missing credentials: %j', async auth => {
  const socket = { handshake: { auth } };
  const next = jest.fn();
  await createAuthMiddleware()(socket, next);
  expect(next).toHaveBeenCalledWith(new Error('SOCKET_AUTH_FAILED: Token required'));
  expect(jwt.verify).not.toHaveBeenCalled();
});
test.each([{ role: 'patient' }, { id: 4 }, { id: 4, role: null }])('rejects incomplete identity %j', async identity => {
  const { next } = await authenticate(identity);
  expect(next).toHaveBeenCalledWith(new Error('SOCKET_AUTH_FAILED: Incomplete token payload'));
});
test('attaches a normalized patient identity without checking a staff anchor', async () => {
  const { socket, next } = await authenticate({ id: 0, role: 'PATIENT' });
  expect(socket).toMatchObject({ userId: '0', userRole: 'patient', sessionId: null });
  expect(next).toHaveBeenCalledWith();
  expect(getStaffAnchor).not.toHaveBeenCalled();
  expect(jwt.verify).toHaveBeenCalledWith('signed-token', process.env.JWT_SECRET, { audience: 'mdsystem-app', issuer: 'mdsystem-auth' });
});
test('rejects medical identity without a session anchor', async () => {
  const { next } = await authenticate({ id: 1, role: 'medical' });
  expect(next).toHaveBeenCalledWith(new Error('SOCKET_AUTH_FAILED: Session anchor required'));
});
test.each([null, 'different'])('rejects inactive anchor %j', async anchor => {
  getStaffAnchor.mockResolvedValue(anchor);
  const { next } = await authenticate({ id: 1, role: 'medical', sid: 'active' });
  expect(next).toHaveBeenCalledWith(new Error('SOCKET_AUTH_FAILED: Invalid or expired session'));
});
test('accepts medical identity with its current anchor', async () => {
  getStaffAnchor.mockResolvedValue('active');
  const { socket, next } = await authenticate({ id: 1, role: 'Medical', sid: 'active' });
  expect(socket).toMatchObject({ userId: '1', userRole: 'medical', sessionId: 'active' });
  expect(next).toHaveBeenCalledWith();
});
test.each(['TokenExpiredError', 'JsonWebTokenError'])('handles %s without leaking verifier details', async name => {
  jwt.verify.mockImplementation(() => { throw Object.assign(new Error('private detail'), { name }); });
  const next = jest.fn();
  await createAuthMiddleware()({ handshake: { auth: { token: 'bad' } } }, next);
  expect(next).toHaveBeenCalledWith(new Error(name === 'TokenExpiredError' ? 'SOCKET_AUTH_FAILED: Token expired' : 'SOCKET_AUTH_FAILED'));
});
