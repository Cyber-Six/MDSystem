const { isValidUserId } = require('./access-token-session');

function parseRefreshToken(value) {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const parts = value.trim().split(':');
  if (parts.length !== 3) return null;
  const [userId, rawDeviceId, rawToken] = parts;
  const deviceId = rawDeviceId.trim();
  const token = rawToken.trim();
  if (!isValidUserId(userId) || !deviceId || !token || deviceId.length > 256 || token.length > 256) return null;
  return { userId: Number(userId), deviceId, token };
}

module.exports = { parseRefreshToken };
