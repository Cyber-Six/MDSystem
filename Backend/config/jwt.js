const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const client = require("./redis.js"); // assume you have a Redis client
const validator = require("./validator.js");
const { saveRefreshSession, getRefreshSession, 
        saveStaffAnchor, getStaffAnchor, } = require("./redis.js");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in environment variables");
  }

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_PATIENT_EXPIRATION = parseInt(process.env.JWT_PATIENT_ACCESS_EXPIRATION, 10);
const ACCESS_STAFF_EXPIRATION = parseInt(process.env.JWT_STAFF_ACCESS_EXPIRATION, 10);
const REFRESH_EXP = parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800; // default 7d

function isValidUserRole(role) {
  if (typeof role !== "string") return false;
  return ["patient", "medical"].includes(role.toLowerCase());
}

// Generate short-lived access token
function generateAccessToken(user, anchorSessionId = null) {
  // Validate user.id
  if (typeof user.id !== "string" && typeof user.id !== "number") {
    throw new Error("Invalid user.id");
  }

  // Validate user.role
  if (typeof user.role !== "string" || isValidUserRole(user.role) === false) {
    throw new Error("Invalid user.role");
  }

  const normalizedRole = user.role.toLowerCase();

  // Base payload for all users
  const payload = {
    id: user.id,
    role: normalizedRole, // store normalized role
    jti: crypto.randomUUID(),
  };

  // Only staff/medical roles get sid (anchor)
  if (normalizedRole === "medical") {
    payload.sid = anchorSessionId;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn:
      normalizedRole === "medical"
        ? ACCESS_STAFF_EXPIRATION
        : ACCESS_PATIENT_EXPIRATION,
    audience: "mdsystem-app",
    issuer: "mdsystem-auth",
  });
}

async function generateRefreshToken(user) {
  const deviceId = crypto.randomUUID();
  const refreshToken = crypto.randomUUID();

  const normalizedRole = user.role.toLowerCase();
  const isStaff = normalizedRole === "medical";

  // Load anchor for staff
  let sessionId = null;
  if (isStaff) {
    sessionId = await getStaffAnchor(user.id);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await saveStaffAnchor(user.id, sessionId, REFRESH_EXP);
    }
  }

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

  await saveRefreshSession(user.id, deviceId, sessionData, REFRESH_EXP);

  return `${user.id}:${deviceId}:${refreshToken}`;
}



// Verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
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
  const isStaff = session.role === "medical";

  session.suspiciousCount = (session.suspiciousCount || 0) + 1;

  console.log("[SECURITY]", {
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
    await saveStaffAnchor(userId, newAnchor, REFRESH_EXP);

    session.status = "cooldown";
    session.cooldownUntil = now + (ACCESS_STAFF_EXPIRATION * 1000);
    session.refreshToken = "";
    session.prevToken = null;

    await saveRefreshSession(userId, deviceId, session, REFRESH_EXP);
    return;
  }

  // Otherwise just persist suspiciousCount
  await saveRefreshSession(userId, deviceId, session, REFRESH_EXP);
}

async function handleRefresh({ userId, deviceId, providedToken }) {
  const now = Date.now();

  const session = await getRefreshSession(userId, deviceId);
  if (!session) throw new Error("Invalid session");

  const isStaff = session.role === "medical";

  // 1. Status checks
  if (session.status === "revoked") {
    throw new Error("Session revoked");
  }

  if (session.status === "cooldown") {
    if (!session.cooldownUntil || now > session.cooldownUntil) {
      throw new Error("Session requires re-login");
    }

    await handleSuspiciousRefresh({
      userId,
      deviceId,
      session,
      reason: "cooldown_violation",
      now
    });

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
    await handleSuspiciousRefresh({
      userId,
      deviceId,
      session,
      reason: "unknown_token",
      now
    });
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

  // 4. Valid refresh → rotate tokens
  const newRefreshToken = crypto.randomUUID();

  session.prevToken = session.refreshToken;
  session.refreshToken = newRefreshToken;
  session.suspiciousCount = Math.max(0, (session.suspiciousCount || 0) - 1);
  session.status = "active";
  session.cooldownUntil = null;

  await saveRefreshSession(userId, deviceId, session, REFRESH_EXP);

  // Generate new access token
  const accessToken = generateAccessToken(
    { id: userId, role: session.role },
    session.sessionId // anchor for medical
  );

  return { accessToken, refreshToken: newRefreshToken };
}

async function handleLogin({ userId, deviceId, role }) {
  const now = Date.now();
  const normalizedRole = role.toLowerCase();

  let session = await getRefreshSession(userId, deviceId);

  // If suspicious session exists → self-heal
  if (session && (session.suspiciousCount || 0) >= 1) {
    session.status = "revoked";
    session.refreshToken = "";
    session.prevToken = null;
    session.cooldownUntil = null;
    session.suspiciousCount = 0;

    await saveRefreshSession(userId, deviceId, session, REFRESH_EXP);

    console.log("[SECURITY] Suspicious session cleared on login", {
      userId,
      deviceId,
      role: normalizedRole,
      at: now
    });

    session = null;
  }

  // Create new session
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
    updatedAt: now
  };

  await saveRefreshSession(userId, deviceId, newSession, REFRESH_EXP);

  // Staff anchor update
  if (normalizedRole === "medical") {
    await saveStaffAnchor(userId, newSessionId, REFRESH_EXP);
  }

  const accessToken = generateAccessToken(
    { id: userId, role: normalizedRole },
    newSessionId
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
