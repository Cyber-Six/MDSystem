// authSession.js
const { handleLogin } = require("./../config/jwt.js");
const { generateRandomKey } = require("./security.js");
const { detectPortalFromSubdomain } = require("./portal.js");

class AuthSession {
  static async create(req, userId) {
    const deviceId = generateRandomKey();
    const role = detectPortalFromSubdomain(req).toLowerCase(); // "patient" or "medical"

    // Call your session-layer function
    const { accessToken, refreshToken: rawRefreshToken } = await handleLogin({
      userId,
      deviceId,
      role
    });

    // Build the final refresh token format
    const finalRefreshToken = `${userId}:${deviceId}:${rawRefreshToken}`;

    return {
      accessToken,
      refreshToken: finalRefreshToken,
    };
  }
}

module.exports = AuthSession;
