const express = require('express');

const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const { portalBasedIpRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { revokeRefreshSession } = require('../../../config/redis.js');
const logger = require('../../../utils/logger.js');

const router = express.Router();
const { parseRefreshToken } = require('../../../utils/refresh-token');
const LOGOUT_OK_RESPONSE = Object.freeze({ ok: true });

// POST /auth/logout
// Atomically revoke the device refresh session and every tracked access token.
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

    // Token matching happens inside the same Redis operation as revocation.
    // Missing sessions and mismatches intentionally have the same response.
    await revokeRefreshSession(userId, deviceId, token);

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