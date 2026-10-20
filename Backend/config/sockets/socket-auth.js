const jwt = require('jsonwebtoken');
const { getStaffAnchor, getSessionBlacklist } = require('../redis');
const { isValidUserId } = require('../../utils/access-token-session');
const { assertAccountAllowed } = require('../../utils/authentication-state');
const logger = require('../../utils/logger');

async function authorizeSocket(socket) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) throw new Error('SOCKET_AUTH_FAILED: Token required');
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'], audience: 'mdsystem-app', issuer: 'mdsystem-auth',
  });
  const role = typeof decoded.role === 'string' ? decoded.role.toLowerCase() : '';
  if (!isValidUserId(decoded.id) || !['patient', 'medical'].includes(role)) {
    throw new Error('SOCKET_AUTH_FAILED: Incomplete token payload');
  }
  if (decoded.jti && await getSessionBlacklist(decoded.jti)) throw new Error('SOCKET_AUTH_FAILED: Token revoked');
  if (role === 'medical') {
    if (!decoded.sid) throw new Error('SOCKET_AUTH_FAILED: Session anchor required');
    const activeSession = await getStaffAnchor(decoded.id);
    if (!activeSession || activeSession !== decoded.sid) {
      throw new Error('SOCKET_AUTH_FAILED: Invalid or expired session');
    }
  }
  await assertAccountAllowed(decoded.id, role);
  return { ...decoded, role };
}

function socketAuthError(error) {
  if (error.name === 'TokenExpiredError') return new Error('SOCKET_AUTH_FAILED: Token expired');
  if (error.message.startsWith('SOCKET_AUTH_FAILED:')) return error;
  logger.error('[SOCKET_AUTH] Authorization failed:', error.message);
  return new Error('SOCKET_AUTH_FAILED');
}

function createAuthMiddleware() {
  return async (socket, next) => {
    try {
      const decoded = await authorizeSocket(socket);
      socket.userId = String(decoded.id);
      socket.userRole = decoded.role;
      socket.sessionId = decoded.sid || null;
      socket.authTokenId = decoded.jti || null;
      socket.authExpiresAt = Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
      next();
    } catch (error) {
      next(socketAuthError(error));
    }
  };
}

// A connection is not a permanent authorization grant: expired/revoked tokens
// and removed staff membership must not continue sending privileged events.
function protectSocketSession(socket) {
  socket.use(async (_packet, next) => {
    try { await authorizeSocket(socket); next(); }
    catch (error) { next(socketAuthError(error)); socket.disconnect(true); }
  });
  let timer;
  const expire = () => {
    const remaining = socket.authExpiresAt - Date.now();
    if (remaining <= 0) return socket.disconnect(true);
    timer = setTimeout(expire, Math.min(remaining, 2147483647));
    timer.unref?.();
  };
  if (socket.authExpiresAt) expire();
  socket.on('disconnect', () => clearTimeout(timer));
}

module.exports = { createAuthMiddleware, authorizeSocket, protectSocketSession };
