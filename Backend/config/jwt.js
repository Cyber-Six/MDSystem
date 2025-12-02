const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const client = require("./redis.js"); // assume you have a Redis client
const validator = require("./validator.js");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in environment variables");
  }

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXP = parseInt(process.env.JWT_ACCESS_EXPIRATION, 10) || 900; // default 15m
const REFRESH_EXP = parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800; // default 7d

// Generate short-lived access token
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, jti: crypto.randomUUID() },
    JWT_SECRET,
    {
      expiresIn: ACCESS_EXP, // seconds from .env
      audience: "mdsystem-app",
      issuer: "mdsystem-auth",
    }
  );
}

// Generate long-lived refresh token (opaque, stored in Redis)
// Optional: add session anchor for high-privilege roles
async function generateRefreshToken(user) {
  const tokenId = crypto.randomUUID();
  const refreshToken = crypto.randomUUID(); // opaque string
  const key = `rt:${user.id}:${tokenId}`;

  // If staff/admin, generate anchor
  let sessionId = null;
  if (validator.isUserStaff(user.role)) {
    sessionId = crypto.randomUUID();
    // Store/update anchor for this user
    await client.setKey(
      `staff:anchor:${user.id}`,
      sessionId,
      REFRESH_EXP // anchor TTL same as refresh lifespan
    );
  }

  await client.setKey(
    key,
    JSON.stringify({
      refreshToken,
      status: "active",
      createdAt: Date.now(),
      exp: Date.now() + REFRESH_EXP * 1000, // ms
      sessionId, // null for patients, UUID for staff/admin
    }),
    REFRESH_EXP // seconds from .env
  );

  // Return token string; include sessionId only for staff/admin
  return sessionId
    ? `${user.id}:${tokenId}:${refreshToken}:${sessionId}`
    : `${user.id}:${tokenId}:${refreshToken}`;
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

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireRole,
};