const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { recordAccessToken, isValidUserId } = require("../utils/access-token-session");
const { getRefreshSession, getStaffAnchor, saveRotatedRefreshSession, saveLoginSession } = require("./redis.js");
const { assertAccountAllowed } = require("../utils/authentication-state");
const logger = require("../utils/logger.js");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in environment variables");
  }

const JWT_SECRET = process.env.JWT_SECRET;
function expirationSeconds(name, fallback) {
  const raw = process.env[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}
const ACCESS_PATIENT_EXPIRATION = expirationSeconds('JWT_PATIENT_ACCESS_EXPIRATION');
const ACCESS_STAFF_EXPIRATION = expirationSeconds('JWT_STAFF_ACCESS_EXPIRATION');
const REFRESH_EXP = expirationSeconds('JWT_REFRESH_EXPIRATION', 604800);

function getAccessTokenExpirationSeconds(role) {
  return role === "medical" ? ACCESS_STAFF_EXPIRATION : ACCESS_PATIENT_EXPIRATION;
}

function isValidUserRole(role) {
  if (typeof role !== "string") return false;
  return ["patient", "medical"].includes(role.toLowerCase());
}

// Generate short-lived access token
function generateAccessToken(user, anchorSessionId = null, tokenId = crypto.randomUUID()) {
  // Validate user.id
  if (!isValidUserId(user?.id)) {
    throw new Error("Invalid user.id");
  }

  // Validate user.role
  if (isValidUserRole(user.role) === false) {
    throw new Error("Invalid user.role");
  }

  const normalizedRole = user.role.toLowerCase();
  const accessTokenExpirationSeconds = getAccessTokenExpirationSeconds(normalizedRole);

  // Base payload for all users
  const payload = {
    id: user.id,
    role: normalizedRole, // store normalized role
    jti: tokenId // Stored with the refresh session for immediate revocation
  };

  // Only staff/medical roles get sid (anchor)
  if (normalizedRole === "medical") {
    payload.sid = anchorSessionId;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: accessTokenExpirationSeconds,
    algorithm: "HS256",
    audience: "mdsystem-app",
    issuer: "mdsystem-auth",
  });
}

async function generateRefreshToken(user) {
  if (!isValidUserId(user?.id) || !isValidUserRole(user?.role)) throw new Error("Invalid user identity");
  const deviceId = crypto.randomUUID();
  const refreshToken = crypto.randomUUID();

  const normalizedRole = user.role.toLowerCase();
  const isStaff = normalizedRole === "medical";

  const sessionId = isStaff ? crypto.randomUUID() : null;

  const now = Date.now();

  // ✅ FIXED: Full session shape
  const sessionData = {
    userId: user.id,
    deviceId,
    role: normalizedRole,
    refreshToken,
    prevToken: null,
    status: "active",
    cooldownUntil: null,
    suspiciousCount: 0,
    createdAt: now,
    updatedAt: now,
    exp: now + REFRESH_EXP * 1000,
    sessionId, // null for patients, anchor for medical
  };

  await saveLoginSession(user.id, deviceId, sessionData, REFRESH_EXP);

  return `${user.id}:${deviceId}:${refreshToken}`;
}



// Verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "mdsystem-app",
      issuer: "mdsystem-auth",
    });
  } catch {
    return null;
  }
}

// Role-based authorization
function requireRole(token, allowedRoles) {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (!allowedRoles.includes(decoded.role)) return null;
  return decoded;
}


async function handleSuspiciousRefresh({ userId, deviceId, session, reason, now }) {
  const expectedToken = session.refreshToken;
  const isStaff = session.role === "medical";

  session.suspiciousCount = (session.suspiciousCount || 0) + 1;

  logger.warn("[SECURITY]", {
    userId,
    deviceId,
    role: session.role,
    reason,
    suspiciousCount: session.suspiciousCount,
    at: now
  });

  // Staff escalation threshold
  if (isStaff && session.suspiciousCount >= 2) {
    const newAnchor = crypto.randomUUID();
    session.status = "cooldown";
    session.cooldownUntil = now + (ACCESS_STAFF_EXPIRATION * 1000);
    session.refreshToken = "";
    session.prevToken = null;

    await saveRotatedRefreshSession(userId, deviceId, expectedToken, session, REFRESH_EXP, newAnchor);
    return;
  }

  // Otherwise just persist suspiciousCount
  await saveRotatedRefreshSession(userId, deviceId, expectedToken, session, REFRESH_EXP);
}

async function handleRefresh({ userId, deviceId, providedToken }) {
  const now = Date.now();

  const session = await getRefreshSession(userId, deviceId);
  if (!session || !isValidUserRole(session.role) || !['active', 'revoked', 'cooldown'].includes(session.status)
      || (session.userId != null && String(session.userId) !== String(userId))
      || (session.deviceId != null && session.deviceId !== deviceId)) throw new Error("Invalid session");
  if (typeof providedToken !== 'string' || !providedToken) throw new Error("Invalid refresh token");

  const isStaff = session.role === "medical";

  // 1. Status checks
  if (session.status === "revoked") {
    throw new Error("Session revoked");
  }

  if (session.status === "cooldown") {
    if (!session.cooldownUntil || now > session.cooldownUntil) {
      throw new Error("Session requires re-login");
    }

    throw new Error("Session in cooldown");
  }

  // 2. Staff anchor check
  if (isStaff) {
    const anchor = await getStaffAnchor(userId);
    if (!anchor || anchor !== session.sessionId) {
      throw new Error("Staff session invalidated");
    }
  }

  // 3. Token matching (strict, no leeway)
  const { refreshToken, prevToken } = session;

  const isCurrent = providedToken === refreshToken;
  const isPrev = prevToken && providedToken === prevToken;

  if (!isCurrent && !isPrev) {
    throw new Error("Invalid refresh token");
  }

  if (isPrev) {
    await handleSuspiciousRefresh({
      userId,
      deviceId,
      session,
      reason: "prev_token_used",
      now
    });
    throw new Error("Expired refresh token");
  }

  await assertAccountAllowed(userId, session.role);

  // 4. Valid refresh → rotate tokens
  const newRefreshToken = crypto.randomUUID();
  const accessTokenExpirationSeconds = getAccessTokenExpirationSeconds(session.role);

  session.prevToken = session.refreshToken;
  session.refreshToken = newRefreshToken;
  session.suspiciousCount = Math.max(0, (session.suspiciousCount || 0) - 1);
  session.status = "active";
  session.cooldownUntil = null;

  recordAccessToken(session, accessTokenExpirationSeconds, now);
  const saved = await saveRotatedRefreshSession(userId, deviceId, providedToken, session, REFRESH_EXP);
  if (!saved) throw new Error("Session changed or revoked during refresh");

  // Generate new access token
  const accessToken = generateAccessToken(
    { id: userId, role: session.role },
    session.sessionId, // anchor for medical
    session.tokenId
  );

  return { accessToken, refreshToken: newRefreshToken };
}

async function handleLogin({ userId, deviceId, role }) {
  const now = Date.now();
  const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";

  if (!isValidUserId(userId) || !deviceId || !isValidUserRole(normalizedRole)) throw new Error('Invalid login identity');
  const newSessionId = crypto.randomUUID();
  const newRefreshToken = crypto.randomUUID();

  const newSession = {
    userId,
    deviceId,
    role: normalizedRole,
    refreshToken: newRefreshToken,
    prevToken: null,
    sessionId: newSessionId,
    status: "active",
    cooldownUntil: null,
    suspiciousCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  recordAccessToken(newSession, getAccessTokenExpirationSeconds(normalizedRole), now);
  const persistedSession = await saveLoginSession(userId, deviceId, newSession, REFRESH_EXP);

  const accessToken = generateAccessToken(
    { id: userId, role: normalizedRole },
    persistedSession.sessionId,
    newSession.tokenId
  );

  return { accessToken, refreshToken: newRefreshToken };
}



module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireRole,
  handleRefresh,
  handleLogin,
  handleSuspiciousRefresh,
};
