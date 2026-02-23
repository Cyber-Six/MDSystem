// config/redis.js
const redis = require("redis");
const path = require("path");
const dotenv = require("dotenv");
const { hashOTP, generateRandomKey, delayRandom } = require("../utils/security.js");
const query = require("./query.js");
const { redis: redisConfig } = require('./config');
const logger = require("../utils/logger.js");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let client;

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || 'mdsadmin', // ACL user
  password: process.env.REDIS_PASSWORD,               // ACL password
  };
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

  if (expireSeconds) {
    await client.set(key, value, { EX: expireSeconds });
  } else {
    await client.set(key, value);
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

async function rateLimitEmailCooldown(email, portal = "", route = "", cooldownSeconds = 30) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${portal}:${route}:ec:${email}`; // rate limit "email cooldown"
  const exists = await client.exists(key);
  if (exists) return true; // still in cooldown → block

  await client.set(key, "1", { EX: cooldownSeconds });
  return false; // allowed
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
    if (failures <= 3) await delayRandom(500, 1500);
    else await delayRandom(2000, (failures+2)*1000);

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
      email_2fa_verified: "false",
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
    data_consent_timestamp: Date.now().toString()
    });
  
  const userId = await getUserIdFromVerificationSession(token, purpose);
  if (userId) {
    await query.updateUserConsent(userId, {
      data_consent: true,
      data_consent_version: process.env.DATA_CONSENT_VERSION,
      data_consent_agreed: new Date().toISOString()
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

async function saveStaffAnchor(userId, sessionId, ttlSeconds) {
  if (!userId || !sessionId) {
    throw new Error("saveStaffAnchor: userId and sessionId are required");
  }

  const key = `staff:anchor:${userId}`;

  await setKey(
    key,
    sessionId,
    ttlSeconds
  );

  return key;
}

async function getStaffAnchor(userId) {
  if (!userId) throw new Error("getStaffAnchor: userId is required");

  const key = `staff:anchor:${userId}`;
  return await getKey(key); // string or null
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

// ------------------------------------------------

module.exports = {
  connection,
  redisConfig,
  initRedis,
  setKey,
  getKey,
  delKey,
  setOTP,
  verifyOTP,
  deleteOTP,
  rateLimitIP,
  rateLimitEmailCooldown,
  deleteEmailCooldown,
  rateLimitEmailAttempts,
  deleteEmailAttempts,
  getOTPFailureCount,
  getOTPLockoutTTL,
  
  createVerificationSession,
  getVerificationSession,
  updateConsentInSession,
  update2FAInSession,
  deleteVerificationSession,
  getUserIdFromVerificationSession,

  saveRefreshSession,
  getRefreshSession, 
  saveStaffAnchor,
  getStaffAnchor,

  recordResetPwFailure,
  getResetPwFailures,
  isResetPwLocked,
  clearResetPwFailures,

  recordRefreshTokenFailure,
  getRefreshTokenFailures,
  isRefreshTokenLocked,
  clearRefreshTokenFailures,
};
