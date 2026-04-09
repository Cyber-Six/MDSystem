// config/redis.js
const redis = require("redis");
const { hashOTP, generateRandomKey, delayRandom } = require("../utils/security.js");
const query = require("./query.js");
const { redis: redisConfig } = require('./config');
const logger = require("../utils/logger.js");

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let client;
async function initRedis(options = {}) {
  if (client) return client; // reuse if already initialized

  client = redis.createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
    },
    username: redisConfig.username,
    password: redisConfig.password,
    database: redisConfig.database,
    ...options, // allow overrides
  });

  client.on("connect", () => {
    logger.info("✅ Connected to Redis");
  });

  client.on("error", (err) => {
    logger.error(`Redis Client Error: ${err.message}`); 
  });

  await client.connect();
  return client;
}

// ------------------------------------------------
// Generic key helpers
async function setKey(key, value, expireSeconds) {
  if (!client) throw new Error("Redis client not initialized");

  const safeValue = String(value);

  if (expireSeconds) {
    await client.set(key, safeValue, { EX: expireSeconds });
  } else {
    await client.set(key, safeValue);
  }
}


async function getKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.get(key);
}

async function delKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  await client.del(key);
}

// --- Set key helpers (for socket tracking) ---

async function sAddKey(key, member, expireSeconds) {
  if (!client) throw new Error("Redis client not initialized");
  if (expireSeconds) {
    // Single round trip via pipeline
    await client.multi()
      .sAdd(key, member)
      .expire(key, expireSeconds)
      .exec();
  } else {
    await client.sAdd(key, member);
  }
}

async function sMembersKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.sMembers(key);
}

async function sRemKey(key, member) {
  if (!client) throw new Error("Redis client not initialized");
  await client.sRem(key, member);
}

async function sCardKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.sCard(key);
}

// --- List key helpers (for notification queuing) ---

async function rPushKey(key, value) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.rPush(key, value);
}

async function lRangeKey(key, start, stop) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.lRange(key, start, stop);
}

async function lTrimKey(key, start, stop) {
  if (!client) throw new Error("Redis client not initialized");
  await client.lTrim(key, start, stop);
}

async function lLenKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.lLen(key);
}

/**
 * Atomically read the entire list and delete it in a single MULTI/EXEC transaction.
 * Prevents double-delivery when two connections flush the same user simultaneously.
 *
 * @param {string} key
 * @returns {Promise<string[]>}
 */
async function lRangeDelKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  const results = await client.multi()
    .lRange(key, 0, -1)
    .del(key)
    .exec();
  return results[0] ?? [];
}

// ------------------------------------------------

async function rateLimitIP(ip, route = "", limit = 10, windowSeconds = 60) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${route}:ip:${ip}`; // rate-limit "route"
  // Atomically increment the counter
  const current = await client.incr(key);

  // If this is the first hit, set the expiration window
  if (current === 1) {
    await client.expire(key, windowSeconds);
  }

  // Return true if over the limit (meaning: BLOCK)
  return current > limit;
}

async function rateLimitIPCount(ip, route = "") {
  if (!client) throw new Error("Redis client not initialized");
  const key = `rl:${route}:ip:${ip}`;
  const val = await client.get(key);
  return val ? parseInt(val, 10) : 0;
}

async function getIPRateLimitTTL(ip, route = "") {
  if (!client) throw new Error("Redis client not initialized");
  const key = `rl:${route}:ip:${ip}`;
  const ttl = await client.ttl(key);
  return ttl > 0 ? ttl : 0;
}


async function rateLimitEmailCooldown(email, portal = "", route = "", cooldownSeconds = 30) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${portal}:${route}:ec:${email}`; // rate limit "email cooldown"
  const exists = await client.exists(key);
  if (exists) return true; // still in cooldown → block

  await client.set(key, "1", { EX: cooldownSeconds });
  return false; // allowed
}

async function rateLimitEmailCooldownTTL(email, portal = "", route = "") {
  if (!client) throw new Error("Redis client not initialized");
  const key = `rl:${portal}:${route}:ec:${email}`;
  const ttl = await client.ttl(key);

  return ttl > 0 ? ttl : 0;
}

async function deleteEmailCooldown(email, portal = "", route = "") {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${portal}:${route}:ec:${email}`;
  const deleted = await client.del(key);

  return deleted > 0; // true if key existed and was removed
}


async function rateLimitEmailAttempts(email, portal = "", route = "", limit = 5, windowSeconds = 300) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${portal}:${route}:ea:${email}`; // rate limit "email attempts"

  const current = await client.incr(key);

  if (current === 1) {
    await client.expire(key, windowSeconds);
  }

  return current > limit; // true = block
}

async function deleteEmailAttempts(email, portal = "", route = "") {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${portal}:${route}:ea:${email}`;
  const deleted = await client.del(key);

  return deleted > 0;
}


// ------------------------------------------------
// Validation OTP helpers 
// ------------------------------------------------

const OTPMatrix = {
  email2FA: {
    purpose: "email2FA",
    expiration: Number(process.env.EMAIL_2FA_EXPIRATION) || 300, // fallback
    },
  emailVerification: {
    purpose: "emailVerification",
    expiration: Number(process.env.EMAIL_VERIF_EXPIRATION) || 600, // fallback, // absolute one-time verification
    },
  settingsAction: {
    purpose: "settingsAction",
    expiration: Number(process.env.EMAIL_2FA_EXPIRATION) || 300, // same TTL as 2FA
    },
  };

async function setOTP(email, otp, code, portal) {
  if (!client) throw new Error("Redis client not initialized");
  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const hashedOtp = hashOTP(otp);
  const key = `otp:${portal}:${config.purpose}:${email}`;

  await client.set(key, hashedOtp, {
    EX: config.expiration,
  });
}


const DEBUG_BYPASS_OTP = process.env.DEBUG_BYPASS_OTP === "true";

async function verifyOTP(email, code, otpInput, portal) {
  if (!client) throw new Error("Redis client not initialized");

  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const purpose = config.purpose;

  // ✅ 1. Check lockout
  if (await isOTPLocked(email, purpose)) {
    return "LOCKED_OUT";
  }

  const key = `otp:${portal}:${purpose}:${email}`;
  const storedHashedOtp = await client.get(key);

  // ✅ 2. If OTP does not exist → count as failure
  if (!storedHashedOtp && !DEBUG_BYPASS_OTP) {
    const failures = await incrementOTPFailure(email, purpose);

    if (failures > OTP_GLOBAL_ATTEMPT_LIMIT) {
      await lockOTP(email, purpose);
      return "LOCKED_OUT";
    }

    // ✅ Progressive delay
    if (failures <= 3) await delayRandom(500, 1500,1, 0);
    else await delayRandom(500, 2500, failures, 0.5);

    return false;
  }

  // ✅ 3. Correct OTP
  if (storedHashedOtp === hashOTP(otpInput) || DEBUG_BYPASS_OTP) {
    if (DEBUG_BYPASS_OTP) {
      logger.warn(`⚠️ DEBUG_BYPASS_OTP is enabled - OTP verification bypassed for ${email}`);
      }
    await client.del(key); // delete OTP
    await client.del(`otp:fail:${purpose}:${email}`); // reset failures
    return true;
  }

  // ✅ 4. Wrong OTP → increment failure
  const failures = await incrementOTPFailure(email, purpose);

  if (failures > OTP_GLOBAL_ATTEMPT_LIMIT) {
    await lockOTP(email, purpose);
    return "LOCKED_OUT";
  }

  // ✅ Progressive delay
  if (failures <= 3) await new Promise(r => setTimeout(r, 1000));
  else await new Promise(r => setTimeout(r, 3000));

  return false;
}


async function deleteOTP(email, code, portal) {
  if (!client) throw new Error("Redis client not initialized");

  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const key = `otp:${portal}:${config.purpose}:${email}`;
  await client.del(key);
}

// ------------------------------------------------
// OTP Failure + Lockout System (Progressive Delay)
// ------------------------------------------------

const OTP_GLOBAL_ATTEMPT_LIMIT =
  Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT) || 5;

const OTP_GLOBAL_LOCKOUT_SECONDS =
  Number(process.env.OTP_GLOBAL_LOCKOUT_SECONDS) || 3600;

async function getOTPFailureCount(email, purpose) {
  const key = `otp:fail:${purpose}:${email}`;

  const count = await client.get(key);
  return Number(count) || 0;
}

async function incrementOTPFailure(email, purpose) {
  const key = `otp:fail:${purpose}:${email}`;
  const count = await client.incr(key);

  // Set TTL on first failure
  if (count === 1) {
    await client.expire(key, OTP_GLOBAL_LOCKOUT_SECONDS);
  }

  return count;
}

async function lockOTP(email, purpose) {
  const key = `otp:lock:${purpose}:${email}`;
  await client.set(key, "1", { EX: OTP_GLOBAL_LOCKOUT_SECONDS });
}

async function isOTPLocked(email, purpose) {
  const key = `otp:lock:${purpose}:${email}`;
  return (await client.exists(key)) === 1;
}

async function getOTPLockoutTTL(email, purpose) {
  const key = `otp:lock:${purpose}:${email}`;
  const ttl = await client.ttl(key);
  return ttl > 0 ? ttl : 0;
}


// ------------------------------------------------
// Verification session keys (post-OTP)
// ------------------------------------------------

// purpose [verification, 2fa, resetpasswd]
async function createVerificationSession(email, purpose, account_type = "patient") {
  if (!client) throw new Error("Redis client not initialized");

  const token = generateRandomKey();
  const key = `verify:${purpose}:${token}`;

  // ✅ Fetch user from DB (returns row OR null)
  const user = await query.getUserConsentStateByEmail(email);
  if (user) { // account do exist
    await client.hSet(key, {
      allow_email_2fa: user.allow_email_2fa ? "true" : "false",
      totp_enabled: user.totp_enabled ? "true" : "false",
      email_2fa_verified: "false",
      totp_2fa_verified: "false",
      user_exists: "true",
      user_id: user.id.toString(),       // ✅ internal only
      email,
      account_type,                      // ✅ NEW: store role for login/register flows
      data_consent: user.data_consent ? "true" : "false",
      data_consent_version: user.data_consent_version || "",
      data_consent_agreed: user.data_consent_agreed
        ? user.data_consent_agreed.toISOString()
        : "",
    });
  } else { // account doesnt exist
    await client.hSet(key, {
      user_exists: "false",
      user_id: "",                       // ✅ consistent field
      email,
      account_type,                              // ✅ still store role even if user doesn't exist
      data_consent: "false",
      data_consent_version: "",
      data_consent_agreed: "",
    });
  }

  await client.expire(
    key,
    Number(process.env.VERIFICATION_SESSION_EXPIRATION) || 900
  );

  return token; // ✅ safe to return to user
}


async function getVerificationSession(token, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;
  const session = await client.hGetAll(key);

  if (!session || !session.email) return null;

  return session;
  }


async function updateConsentInSession(token, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;

  const exists = await client.exists(key);
  if (!exists) return false;

  await client.hSet(key, {
    data_consent: "true",
    data_consent_version: process.env.DATA_CONSENT_VERSION,
    data_consent_timestamp: Date.now().toString(),
  });

  const userId = await getUserIdFromVerificationSession(token, purpose);
  if (userId) {
    await query.updateUserConsent(userId, {
      data_consent: true,
      data_consent_version: process.env.DATA_CONSENT_VERSION,
      data_consent_agreed: new Date().toISOString(),
    });
  }
  return true;
}
  
async function update2FAInSession(token, email, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;

  // ✅ 1. Check if session exists
  const exists = await client.exists(key);
  if (!exists) return false;

  // ✅ 2. Fetch stored email from Redis
  const storedEmail = await client.hGet(key, "email");
  if (!storedEmail || storedEmail.toLowerCase() !== email.toLowerCase()) {
    return false; // ❌ Email mismatch → invalid attempt
  }

  // ✅ 3. Mark 2FA as verified
  await client.hSet(key, {
    email_2fa_verified: "true"
  });

  return true;
}

async function updateTotp2FAInSession(token, email, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;

  const exists = await client.exists(key);
  if (!exists) return false;

  const storedEmail = await client.hGet(key, "email");
  if (!storedEmail || storedEmail.toLowerCase() !== email.toLowerCase()) {
    return false;
  }

  await client.hSet(key, {
    totp_2fa_verified: "true"
  });

  return true;
}


async function deleteVerificationSession(token, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;
  await client.del(key);

  return true;
}


async function getUserIdFromVerificationSession(token, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${token}`;

  const exists = await client.exists(key);
  if (!exists) return null;

  // ✅ Fetch only the user_id field
  const userId = await client.hGet(key, "user_id");

  // Normalize: empty string → null
  return userId || null;
}

// ------------------------------------------------
// Refresh Token Storage Helpers
// ------------------------------------------------

// You already have these:
async function saveRefreshSession(userId, deviceId, data, ttlSeconds) {
  if (!userId || !deviceId) {
    throw new Error("saveRefreshSession: userId and deviceId are required");
  }

  const key = `rt:${userId}:${deviceId}`;

  await setKey(
    key,
    JSON.stringify(data),
    ttlSeconds
  );

  return key;
}

const REFRESH_EXP = parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800;
async function saveStaffAnchor(userId, sessionId, ttlSeconds=REFRESH_EXP) {
  if (!userId || !sessionId) {
    throw new Error("saveStaffAnchor: userId and sessionId are required");
  }

  const key = `staff:anchor:${String(userId)}`;
  const value = String(sessionId);

  await setKey(key, value, ttlSeconds);

  return key;
}


async function getStaffAnchor(userId) {
  if (!userId) throw new Error("getStaffAnchor: userId is required");

  const key = `staff:anchor:${String(userId)}`;
  return await getKey(key); // string or null
}

/**
 * List all refresh sessions for a user (scans rt:${userId}:* keys)
 * @param {string|number} userId
 * @returns {Promise<Array>} Array of session objects with deviceId
 */
async function listUserSessions(userId) {
  if (!client) throw new Error("Redis client not initialized");
  if (!userId) throw new Error("listUserSessions: userId is required");

  const pattern = `rt:${userId}:*`;
  const sessions = [];

  // Use SCAN to find all matching keys
  for await (const key of client.scanIterator({ match: pattern, count: 100 })) {
    const raw = await client.get(key);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        sessions.push(session);
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  return sessions;
}

/**
 * Delete all refresh sessions for a user
 * @param {string|number} userId
 * @returns {Promise<number>} Number of sessions deleted
 */
async function deleteAllUserSessions(userId) {
  if (!client) throw new Error("Redis client not initialized");
  if (!userId) throw new Error("deleteAllUserSessions: userId is required");

  const pattern = `rt:${String(userId)}:*`;
  const keysToDelete = [];

  // Collect all keys matching the pattern
  for await (const key of client.scanIterator({ match: pattern, count: 100 })) {
    keysToDelete.push(key);
  }

  // Delete all keys if any found
  if (keysToDelete.length > 0) {
    await client.del(keysToDelete);
  }

  return keysToDelete.length;
}

/**
 * Delete the staff anchor (forces re-login for all devices)
 * @param {string|number} userId
 */
async function deleteStaffAnchor(userId) {
  if (!client) throw new Error("Redis client not initialized");
  if (!userId) throw new Error("deleteStaffAnchor: userId is required");

  const key = `staff:anchor:${String(userId)}`;
  await client.del(key);
}

/**
 * Scan ALL refresh sessions across all users (for system-wide queries)
 * @returns {Promise<Array>} Array of session objects with userId and deviceId
 */
async function scanAllRefreshSessions() {
  if (!client) throw new Error("Redis client not initialized");

  const pattern = `rt:*`;
  const sessions = [];
  const batchSize = 100; // how many keys to fetch per MGET

  let batch = [];

  for await (const key of client.scanIterator({ match: pattern, count: batchSize })) {
    // Skip non-session keys (e.g., rt:fail:*, rt:lock:*)
    const parts = key.split(':');
    if (parts.length !== 3) continue;

    batch.push(key);

    // When batch is full, fetch them all at once
    if (batch.length >= batchSize) {
      const rawValues = await client.mGet(batch);
      rawValues.forEach(raw => {
        if (raw) {
          try {
            const session = JSON.parse(raw);
            sessions.push(session);
          } catch {
            // Skip invalid JSON
          }
        }
      });
      batch = [];
    }
  }

  // Handle leftover keys in the last batch
  if (batch.length > 0) {
    const rawValues = await client.mGet(batch);
    rawValues.forEach(raw => {
      if (raw) {
        try {
          const session = JSON.parse(raw);
          sessions.push(session);
        } catch {
          // Skip invalid JSON
        }
      }
    });
  }

  return sessions;
}


// New: load refresh session
async function getRefreshSession(userId, deviceId) {
  if (!userId || !deviceId) {
    throw new Error("getRefreshSession: userId and deviceId are required");
  }

  const key = `rt:${userId}:${deviceId}`;
  const raw = await getKey(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

// -----------------------------------------------------//
// Generic Fail Limiter Helper 
// -----------------------------------------------------//


// ✅ Generic failure recorder
async function recordFailure(prefix, ip, failTtl, threshold, lockTtl) {
  const failKey = `${prefix}:fail:${ip}`;
  const attempts = await client.incr(failKey);

  if (attempts === 1) {
    await client.expire(failKey, failTtl);
  }

  if (attempts >= threshold) {
    const lockKey = `${prefix}:lock:${ip}`;
    await client.set(lockKey, "1", { EX: lockTtl });
  }

  return attempts;
}

async function getFailures(prefix, ip) {
  const failKey = `${prefix}:fail:${ip}`;
  const val = await client.get(failKey);
  return Number(val) || 0;
}

async function isLocked(prefix, ip) {
  const lockKey = `${prefix}:lock:${ip}`;
  return (await client.exists(lockKey)) === 1;
}

async function clearFailures(prefix, ip) {
  const failKey = `${prefix}:fail:${ip}`;
  const lockKey = `${prefix}:lock:${ip}`;

  await client.del(failKey);
  await client.del(lockKey);

  return true;
}

// 
// Implementation of generic fail limiter
//
async function recordResetPwFailure(ip) {
  const failTtl = Number(process.env.RESET_PW_FAIL_TTL) || 300;
  const threshold = Number(process.env.RESET_PW_LOCK_THRESHOLD) || 10;
  const lockTtl = Number(process.env.RESET_PW_LOCK_TTL) || 1800;

  return recordFailure("resetpw", ip, failTtl, threshold, lockTtl);
}


async function isResetPwLocked(ip) {
  return isLocked("resetpw", ip);
}

async function getResetPwFailures(ip) {
  return getFailures("resetpw", ip);
}

async function clearResetPwFailures(ip) {
  return clearFailures("resetpw", ip);
}

// ---------// 

async function recordRefreshTokenFailure(ip) {
  const failTtl = Number(process.env.RT_FAIL_TTL) || 300;
  const threshold = Number(process.env.RT_LOCK_THRESHOLD) || 10;
  const lockTtl = Number(process.env.RT_LOCK_TTL) || 1800;

  return recordFailure("rt", ip, failTtl, threshold, lockTtl);
}

async function isRefreshTokenLocked(ip) {
  return isLocked("rt", ip);
}

async function getRefreshTokenFailures(ip) {
  return getFailures("rt", ip);
}

async function clearRefreshTokenFailures(ip) {
  return clearFailures("rt", ip);
}

// Media staging limiter (per user, not IP-based)

async function incrementMediaStagingCount(userId) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `media:staging:${userId}`;
  const count = await client.incr(key);

  if (count === 1) {
    await client.expire(key, Number(process.env.MEDIA_MAX_FILES_STAGING_EXP));
  }

  const maxFiles = Number(process.env.MEDIA_MAX_FILES_STAGING);
  if (count > maxFiles) {
    logger.warn("Media staging limit exceeded", { userId, count, maxFiles });
    return false; // over limit
  }

  return true; // allowed
}

async function decrementMediaStagingCount(userId) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `media:staging:${userId}`;

  // Get current count
  const current = await client.get(key);
  const count = Number(current) || 0;

  if (count <= 1) {
    // If count is 1 or less, delete the key entirely
    await client.del(key);
    logger.info("Media staging counter reset", { userId });
    return 0;
  }

  // Otherwise, decrement
  const newCount = await client.decr(key);
  logger.info("Media staging counter decremented", { userId, newCount });
  return newCount;
}

// ------------------------------------------------
// Admin Transfer Token Management
// ------------------------------------------------

const ADMIN_TRANSFER_EXPIRATION = 600; // 10 minutes

async function createAdminTransferSession(oldAdminId, newAdminId, verificationToken) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `admin:transfer:${verificationToken}`;

  await client.hSet(key, {
    old_admin_id: oldAdminId.toString(),
    new_admin_id: newAdminId.toString(),
    created_at: Date.now().toString(),
  });

  await client.expire(key, ADMIN_TRANSFER_EXPIRATION);

  return verificationToken;
}

async function getAdminTransferSession(verificationToken) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `admin:transfer:${verificationToken}`;
  const session = await client.hGetAll(key);

  if (!session || !session.old_admin_id) return null;

  return {
    oldAdminId: session.old_admin_id,
    newAdminId: session.new_admin_id,
    createdAt: parseInt(session.created_at, 10),
  };
}

async function deleteAdminTransferSession(verificationToken) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `admin:transfer:${verificationToken}`;
  await client.del(key);
  return true;
}

// ------------------------------------------------
// Admin Transfer Rate Limiting
// ------------------------------------------------

const ADMIN_TRANSFER_COOLDOWN = Number(process.env.ADMIN_TRANSFER_COOLDOWN) || 300; // 5-minute cooldown between initiation attempts
const ADMIN_TRANSFER_PASSWORD_FAIL_TTL = Number(process.env.ADMIN_TRANSFER_PASSWORD_FAIL_TTL) || 3600; // 1 hour window for failures
const ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD = Number(process.env.ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD) || 3; // 3 failures before lockout
const ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT = Number(process.env.ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT) || 1800; // 30-minute lockout

/**
 * Record admin transfer initiation attempt and check cooldown
 * @param {number} adminId
 * @returns {Promise<{allowed: boolean, retryAfterSeconds: number}>}
 */
async function recordAdminTransferAttempt(adminId) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `admin:transfer:attempt:${adminId}`;
  const lastAttempt = await client.get(key);

  if (lastAttempt) {
    // Still in cooldown
    const ttl = await client.ttl(key);
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : ADMIN_TRANSFER_COOLDOWN,
    };
  }

  // Set cooldown for next attempt
  await client.set(key, Date.now().toString(), { EX: ADMIN_TRANSFER_COOLDOWN });

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Check if admin has an active pending transfer
 * Since the system enforces only ONE admin at a time, we only need to check
 * if ANY pending transfer exists (there can be at most one)
 * @param {number} adminId
 * @returns {Promise<{hasPending: boolean, tokenPrefix: string | null}>}
 */
async function getAdminActivePendingTransfer(adminId) {
  if (!client) throw new Error("Redis client not initialized");

  // Use KEYS for simple pattern match (safe here - max 1 key expected)
  // Since there's only ONE admin in the system, there can only be ONE pending transfer
  const pattern = `admin:transfer:*`;
  const keys = await client.keys(pattern);

  if (keys.length === 0) {
    return { hasPending: false, tokenPrefix: null };
  }

  // Find the transfer session hash (not attempt/pw keys)
  // Transfer sessions don't have colons after "admin:transfer:", but attempt/pw keys do
  for (const key of keys) {
    // Skip attempt and password-related keys
    if (key.includes(':attempt') || key.includes(':pw:')) {
      continue;
    }

    const session = await client.hGetAll(key);

    // Verify it belongs to this admin
    if (session && session.old_admin_id === adminId.toString()) {
      const token = key.replace('admin:transfer:', '');
      const tokenPrefix = token.substring(0, 8) + '...';
      return { hasPending: true, tokenPrefix };
    }
  }

  return { hasPending: false, tokenPrefix: null };
}

/**
 * Record admin transfer password failure attempt
 * @param {number} adminId
 * @returns {Promise<{failures: number, locked: boolean, lockoutTTL: number}>}
 */
async function recordAdminTransferPasswordFailure(adminId) {
  if (!client) throw new Error("Redis client not initialized");

  const failKey = `admin:transfer:pw:fail:${adminId}`;
  const lockKey = `admin:transfer:pw:lock:${adminId}`;

  // Check if already locked out
  const locked = await client.exists(lockKey);
  if (locked) {
    const ttl = await client.ttl(lockKey);
    return {
      failures: ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD,
      locked: true,
      lockoutTTL: ttl > 0 ? ttl : ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT,
    };
  }

  // Increment failure count
  const failures = await client.incr(failKey);

  if (failures === 1) {
    // Set TTL on first failure
    await client.expire(failKey, ADMIN_TRANSFER_PASSWORD_FAIL_TTL);
  }

  // Lock if threshold reached
  if (failures >= ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD) {
    await client.set(lockKey, '1', { EX: ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT });
    return {
      failures,
      locked: true,
      lockoutTTL: ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT,
    };
  }

  return {
    failures,
    locked: false,
    lockoutTTL: 0,
  };
}

/**
 * Check if admin is locked out from transfer password attempts
 * @param {number} adminId
 * @returns {Promise<{locked: boolean, ttl: number}>}
 */
async function isAdminTransferPasswordLocked(adminId) {
  if (!client) throw new Error("Redis client not initialized");

  const lockKey = `admin:transfer:pw:lock:${adminId}`;
  const exists = await client.exists(lockKey);

  if (!exists) {
    return { locked: false, ttl: 0 };
  }

  const ttl = await client.ttl(lockKey);
  return { locked: true, ttl: ttl > 0 ? ttl : ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT };
}

/**
 * Clear admin transfer password failures (after successful completion)
 * @param {number} adminId
 */
async function clearAdminTransferPasswordFailures(adminId) {
  if (!client) throw new Error("Redis client not initialized");

  const failKey = `admin:transfer:pw:fail:${adminId}`;
  const lockKey = `admin:transfer:pw:lock:${adminId}`;

  await client.del(failKey);
  await client.del(lockKey);
}

const LoginFailureMatrix = {
  patient: {
    prefix: "login:patient",
    failTtl: Number(process.env.PATIENT_LOGIN_FAIL_TTL) || 300,
    lockdownSeconds: Number(process.env.PATIENT_LOGIN_FAIL_LOCKDOWN_SECONDS) || 300,
    threshold: Number(process.env.PATIENT_FAILED_LOGIN_THRESHOLD) || 5,
  },
  medical: {
    prefix: "login:staff",
    failTtl: Number(process.env.STAFF_LOGIN_FAIL_TTL) || 300,
    lockdownSeconds: Number(process.env.STAFF_LOGIN_FAIL_LOCKDOWN_SECONDS) || 300,
    threshold: Number(process.env.STAFF_FAILED_LOGIN_THRESHOLD) || 5,
  },
};

async function incrementLoginFailure(email, portal) {
  if (!client) throw new Error("Redis client not initialized");
  if (!LoginFailureMatrix[portal]) throw new Error(`Unknown portal for login failure: ${portal}`);
  
  const prefix = LoginFailureMatrix[portal].prefix;
  const failKey = `${prefix}:fail:${email}`;
  const count = await client.incr(failKey);

  if (count === 1) { // first failure → set TTL
    await client.expire(failKey, LoginFailureMatrix[portal].failTtl);
  }

  const threshold = LoginFailureMatrix[portal].threshold;
  if (count >= threshold) {
    const lockdownSeconds = LoginFailureMatrix[portal].lockdownSeconds;
    await client.set(`${prefix}:lock:${email}`, "1", { EX: lockdownSeconds });
    logger.warn("Login failure threshold exceeded", { email, portal, count, threshold });
  }

  return count;
}

async function isLoginLocked(email, portal) {
  if (!client) throw new Error("Redis client not initialized");
  if (!LoginFailureMatrix[portal]) throw new Error(`Unknown portal for login lock: ${portal}`);
  const prefix = LoginFailureMatrix[portal].prefix;
  const lockKey = `${prefix}:lock:${email}`;

  const exists = await client.exists(lockKey);
  if (exists !== 1) return 0; // not locked

  const ttl = await client.ttl(lockKey);
  return ttl > 0 ? ttl : 0; // return remaining lockout time in seconds
}

// ── Adaptive reCAPTCHA ──────────────────────────────────────────────────
// Threshold at which the server starts requiring reCAPTCHA for an email.
// Below this, login requests are accepted without a captcha token.
const RECAPTCHA_FAIL_THRESHOLD = Number(process.env.RECAPTCHA_FAIL_ATTEMPT_THRESHOLD) || 3;

/**
 * Read the current consecutive-failure count for an email + portal.
 * Returns 0 when no failures are recorded (key absent or expired).
 */
async function getLoginFailureCount(email, portal) {
  if (!client) throw new Error("Redis client not initialized");
  if (!LoginFailureMatrix[portal]) throw new Error(`Unknown portal for failure count: ${portal}`);
  const prefix = LoginFailureMatrix[portal].prefix;
  const val = await client.get(`${prefix}:fail:${email}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Whether the current failure count means the next request must include a
 * valid reCAPTCHA token.  Used by the login routes to decide whether to
 * enforce the captcha check.
 */
async function shouldRequireRecaptcha(email, portal) {
  const count = await getLoginFailureCount(email, portal);
  return count >= RECAPTCHA_FAIL_THRESHOLD;
}

/**
 * Clear the failure counter after a fully-completed successful login.
 * Prevents stale counts from requiring captcha on the next login session.
 */
async function resetLoginFailures(email, portal) {
  if (!client) throw new Error("Redis client not initialized");
  if (!LoginFailureMatrix[portal]) return; // unknown portal — no-op
  const prefix = LoginFailureMatrix[portal].prefix;
  await client.del(`${prefix}:fail:${email}`);
}

async function triggerExpiredMedical(supply, batchId) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `medical:exp:${supply}:${batchId}`;

  // Try to set the key only if it doesn't exist, with 60s expiration
  const result = await client.set(key, "1", { NX: true, EX: 60 });

  // Redis returns "OK" if the key was set, null if it already existed
  return result === "OK"; // true if set, false if existed
}

// ------------------------------------------------

/**
 * Returns the raw node-redis client instance.
 * Useful for calling .duplicate() when creating dedicated pub/sub clients
 * (e.g., for @socket.io/redis-adapter).
 * Throws if called before initRedis().
 *
 * @returns {import('redis').RedisClientType}
 */
function getClient() {
  if (!client) throw new Error('Redis client not initialized. Call initRedis() first.');
  return client;
}

/**
 * Track TOTP failures per verification key to prevent per-key brute-forcing.
 * Uses a counter key with TTL matching the verification session (default 15 min).
 *
 * @param {string} verificationKey - The random session token
 * @param {string} purpose - e.g. "2fa", "resetpassword"
 * @param {number} maxAttempts - Lock after this many failures (default 5)
 * @returns {Promise<boolean>} true if the limit has been reached (caller should block)
 */
async function recordTotpFailureForKey(verificationKey, purpose, maxAttempts = 5) {
  if (!client) throw new Error("Redis client not initialized");
  const key = `totp_fail:${purpose}:${verificationKey}`;
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, Number(process.env.VERIFICATION_SESSION_EXPIRATION) || 900);
  }
  return count >= maxAttempts;
}

/**
 * Check if the per-key TOTP failure limit has already been reached.
 * @returns {Promise<boolean>} true if locked
 */
async function isTotpLockedForKey(verificationKey, purpose, maxAttempts = 5) {
  if (!client) throw new Error("Redis client not initialized");
  const key = `totp_fail:${purpose}:${verificationKey}`;
  const count = parseInt(await client.get(key) || "0", 10);
  return count >= maxAttempts;
}

module.exports = {
  redisConfig,
  initRedis,
  getClient,
  setKey,
  getKey,
  delKey,
  sAddKey,
  sMembersKey,
  sRemKey,
  sCardKey,
  rPushKey,
  lRangeKey,
  lTrimKey,
  lLenKey,
  lRangeDelKey,
  setOTP,
  verifyOTP,
  deleteOTP,
  rateLimitIP,
  rateLimitIPCount,
  getIPRateLimitTTL,
  rateLimitEmailCooldown,
  rateLimitEmailCooldownTTL,
  deleteEmailCooldown,
  rateLimitEmailAttempts,
  deleteEmailAttempts,
  getOTPFailureCount,
  getOTPLockoutTTL,
  incrementLoginFailure,
  isLoginLocked,
  getLoginFailureCount,
  shouldRequireRecaptcha,
  resetLoginFailures,

  createVerificationSession,
  getVerificationSession,
  updateConsentInSession,
  update2FAInSession,
  updateTotp2FAInSession,
  deleteVerificationSession,
  getUserIdFromVerificationSession,

  saveRefreshSession,
  getRefreshSession,
  saveStaffAnchor,
  getStaffAnchor,
  listUserSessions,
  scanAllRefreshSessions,
  deleteAllUserSessions,
  deleteStaffAnchor,

  recordResetPwFailure,
  getResetPwFailures,
  isResetPwLocked,
  clearResetPwFailures,

  recordRefreshTokenFailure,
  getRefreshTokenFailures,
  isRefreshTokenLocked,
  clearRefreshTokenFailures,

  incrementMediaStagingCount,
  decrementMediaStagingCount,

  createAdminTransferSession,
  getAdminTransferSession,
  deleteAdminTransferSession,

  recordAdminTransferAttempt,
  getAdminActivePendingTransfer,
  recordAdminTransferPasswordFailure,
  isAdminTransferPasswordLocked,
  clearAdminTransferPasswordFailures,

  recordTotpFailureForKey,
  isTotpLockedForKey,
};
