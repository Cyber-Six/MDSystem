const express = require("express");
const router = express.Router();

const { handleRefresh } = require('../../config/jwt.js');
const { portalBasedIpRateLimiter } = require('../../config/middleware/ratelimiter.js');
const { recordRefreshTokenFailure, clearRefreshTokenFailures, isRefreshTokenLocked} = require('../../config/redis.js');

// adjust path as needed

// POST /auth/refresh
router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
  const ip = req.ip;
  try {
    // ✅ 0. Check if this IP is locked from refresh attempts
    if (await isRefreshTokenLocked(ip)) {
      return res.status(429).json({
        error: "REFRESH_LOCKED",
        message: "Too many failed refresh attempts. Try again later."
      });
    }

    const { refreshToken } = req.body;
    // ✅ 1. Required field
    if (!refreshToken) {
      await recordRefreshTokenFailure(ip);
      return res.status(400).json({
        error: "MISSING_REFRESH_TOKEN",
        message: "Refresh token is required."
      });
    }

    // ✅ 2. Parse combined token: userId:deviceId:rawToken
    const parts = refreshToken.split(":");
    if (parts.length !== 3) {
      await recordRefreshTokenFailure(ip);
      return res.status(400).json({
        error: "INVALID_REFRESH_TOKEN_FORMAT",
        message: "Refresh token format is invalid."
      });
    }

    const [userIdStr, deviceId, rawToken] = parts;
    const userId = Number(userIdStr);

    if (!userId || !deviceId || !rawToken) {
      await recordRefreshTokenFailure(ip);
      return res.status(400).json({
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is malformed."
      });
    }

    // ✅ 3. Attempt refresh
    const result = await handleRefresh({
      userId,
      deviceId,
      providedToken: rawToken
    });

    // ✅ SUCCESS → clear failures
    await clearRefreshTokenFailures(ip);

    // ✅ 4. Recombine rotated refresh token
    const finalRefreshToken = `${userId}:${deviceId}:${result.refreshToken}`;

    return res.status(200).json({
      ok: true,
      accessToken: result.accessToken,
      refreshToken: finalRefreshToken
    });

  } catch (err) {
    const msg = err.message || "Refresh failed";

    await recordRefreshTokenFailure(ip);

    switch (msg) {
      case "Invalid session":
        return res.status(401).json({
          error: "INVALID_SESSION",
          message: "Refresh session is invalid or expired."
        });

      case "Session revoked":
        return res.status(403).json({
          error: "SESSION_REVOKED",
          message: "This session has been revoked."
        });

      case "Session requires re-login":
        return res.status(401).json({
          error: "RELOGIN_REQUIRED",
          message: "Please log in again."
        });

      case "Session in cooldown":
        return res.status(429).json({
          error: "SESSION_COOLDOWN",
          message: "Suspicious activity detected. Try again later."
        });

      case "Staff session invalidated":
        return res.status(403).json({
          error: "STAFF_SESSION_INVALID",
          message: "Your staff session was invalidated. Please log in again."
        });

      case "Invalid refresh token":
        return res.status(401).json({
          error: "INVALID_REFRESH_TOKEN",
          message: "Refresh token is invalid."
        });

      case "Expired refresh token":
        return res.status(401).json({
          error: "EXPIRED_REFRESH_TOKEN",
          message: "Refresh token has expired."
        });

      default:
        console.error("Refresh error:", err);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "An unexpected error occurred."
        });
    }
  }
});

module.exports = router;
