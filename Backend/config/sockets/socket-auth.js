const jwt = require('jsonwebtoken');
const { getStaffAnchor } = require('../redis');
const logger = require('../../utils/logger');

/**
 * Creates a Socket.IO authentication middleware that verifies JWT tokens.
 * Mirrors the verification logic from jwtProtect.js middleware.
 *
 * On success, attaches to the socket object:
 *   - socket.userId   (string)
 *   - socket.userRole ('patient' | 'medical')
 *   - socket.sessionId (string | null)
 *
 * @returns {Function} Socket.IO middleware (socket, next)
 */
function createAuthMiddleware() {
  return async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('SOCKET_AUTH_FAILED: Token required'));
      }

      // Verify JWT with same params as jwtProtect.js
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        audience: 'mdsystem-app',
        issuer: 'mdsystem-auth',
      });

      const role = decoded.role?.toLowerCase();
      if (decoded.id === undefined || role === undefined) {
        return next(new Error('SOCKET_AUTH_FAILED: Incomplete token payload'));
      }

      // Medical role: validate session anchor
      if (role === 'medical') {
        if (!decoded.sid) {
          return next(new Error('SOCKET_AUTH_FAILED: Session anchor required'));
        }
        const activeSession = await getStaffAnchor(decoded.id);
        if (!activeSession || activeSession !== decoded.sid) {
          return next(new Error('SOCKET_AUTH_FAILED: Invalid or expired session'));
        }
      }

      // Attach verified identity to socket
      socket.userId = String(decoded.id);
      socket.userRole = role;
      socket.sessionId = decoded.sid || null;

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('SOCKET_AUTH_FAILED: Token expired'));
      }
      logger.error('[SOCKET_AUTH] JWT verification failed:', err.message);
      next(new Error('SOCKET_AUTH_FAILED'));
    }
  };
}

module.exports = { createAuthMiddleware };
