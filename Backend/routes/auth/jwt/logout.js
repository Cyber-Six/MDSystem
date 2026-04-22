const express = require('express');

const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const { portalBasedIpRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { getRefreshSession, saveRefreshSession } = require('../../../config/redis.js');
const logger = require('../../../utils/logger.js');

const router = express.Router();
const REFRESH_EXP = parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800;
const LOGOUT_OK_RESPONSE = Object.freeze({ ok: true });

function parseRefreshToken(refreshToken) {
  if (typeof refreshToken !== 'string') return null;

  const parts = refreshToken.trim().split(':');
  if (parts.length !== 3) return null;

  const [userIdRaw, deviceIdRaw, tokenRaw] = parts;
  const deviceId = deviceIdRaw ? deviceIdRaw.trim() : '';
  const token = tokenRaw ? tokenRaw.trim() : '';

  if (!/^\d+$/.test(userIdRaw)) return null;
  const userId = Number(userIdRaw);

  if (!Number.isSafeInteger(userId) || userId <= 0 || !deviceId || !token) return null;

  return {
    userId,
    deviceId,
    token,
  };
}

// POST /auth/logout
// Revokes a single refresh-token session so future refresh attempts fail.
router.post('/', jwtProtect('all'), portalBasedIpRateLimiter('r'), async (req, res) => {
  try {
    const parsed = parseRefreshToken(req.body?.refreshToken);
    if (!parsed) {
      return res.status(400).json({
        error: 'MISSING_OR_INVALID_REFRESH_TOKEN',
        message: 'A valid refresh token is required.',
      });
    }

    const { userId, deviceId, token } = parsed;
    const authenticatedUserId = Number(req.user?.id);

    if (!Number.isSafeInteger(authenticatedUserId) || authenticatedUserId !== userId) {
      logger.warn('[AUTH][LOGOUT] User mismatch during logout', {
        requestedUserId: userId,
        authUserId: authenticatedUserId,
        deviceId,
      });
      return res.status(200).json(LOGOUT_OK_RESPONSE);
    }

    const session = await getRefreshSession(userId, deviceId);

    // Keep logout idempotent and avoid leaking whether a session exists.
    if (!session || typeof session !== 'object') {
      return res.status(200).json(LOGOUT_OK_RESPONSE);
    }

    const activeToken = typeof session.refreshToken === 'string' ? session.refreshToken.trim() : '';
    const previousToken = typeof session.prevToken === 'string' ? session.prevToken.trim() : '';

    if (token !== activeToken && token !== previousToken) {
      logger.warn('[AUTH][LOGOUT] Refresh token mismatch during logout', {
        userId,
        deviceId,
      });
      return res.status(200).json(LOGOUT_OK_RESPONSE);
    }

    const revokedSession = {
      ...session,
      status: 'revoked',
      refreshToken: '',
      prevToken: null,
      cooldownUntil: null,
      suspiciousCount: 0,
      updatedAt: Date.now(),
    };

    await saveRefreshSession(userId, deviceId, revokedSession, REFRESH_EXP);

    return res.status(200).json(LOGOUT_OK_RESPONSE);
  } catch (error) {
    logger.error('[AUTH][LOGOUT] Failed to revoke refresh session', {
      error: error.message,
    });
    return res.status(500).json({
      error: 'LOGOUT_FAILED',
      message: 'Could not complete logout.',
    });
  }
});

module.exports = router;