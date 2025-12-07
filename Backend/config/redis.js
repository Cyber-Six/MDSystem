// config/redis.js
const redis = require("redis");
const path = require("path");
const dotenv = require("dotenv");
const { hashOTP, generateRandomKey, delayRandom } = require("./security.js");
const query = require("./query.js");

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
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
    },
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD || undefined,
    database: Number(process.env.REDIS_DB) || 0,
    ...options, // allow overrides
  });

  client.on("connect", () => {
    console.log("✅ Connected to Redis");
  });

  client.on("error", (err) => {
    console.error("Redis Client Error", err);
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

async function rateLimitEmailCooldown(email, route = "", cooldownSeconds = 30) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${route}:ec:${email}`; // rate limit "email cooldown"
  console.log("Cooldown Key:", key);
  const exists = await client.exists(key);
  if (exists) return true; // still in cooldown → block

  await client.set(key, "1", { EX: cooldownSeconds });
  return false; // allowed
}

async function rateLimitEmailAttempts(email, route = "", limit = 5, windowSeconds = 300) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `rl:${route}:ea:${email}`; // rate limit "email attempts"

  const current = await client.incr(key);

  if (current === 1) {
    await client.expire(key, windowSeconds);
  }

  return current > limit; // true = block
}

// ------------------------------------------------
// Validation OTP helpers 
// ------------------------------------------------

const OTPMatrix = {
  sendEmail2FA: {
    purpose: "2fa",
    expiration: Number(process.env.EMAIL_2FA_EXPIRATION) || 300, // fallback
    },
  emailVerification: {
    purpose: "emailVerification",
    expiration: Number(process.env.EMAIL_VERIF_EXPIRATION) || 600, // fallback, // absolute one-time verification
    },
  };

async function setOTP(email, otp, code) {
  if (!client) throw new Error("Redis client not initialized");
  console.log("Setting OTP for", email, "code:", code, "otp:", otp);
  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const hashedOtp = hashOTP(otp);
  const key = `otp:${config.purpose}:${email}`;

  await client.set(key, hashedOtp, {
    EX: config.expiration,
  });
}

async function verifyOTP(email, code, otpInput) {
  if (!client) throw new Error("Redis client not initialized");

  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const purpose = config.purpose;

  // ✅ 1. Check lockout
  if (await isOTPLocked(email, purpose)) {
    return "LOCKED_OUT";
  }

  const key = `otp:${purpose}:${email}`;
  const storedHashedOtp = await client.get(key);

  // ✅ 2. If OTP does not exist → count as failure
  if (!storedHashedOtp) {
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
  if (storedHashedOtp === hashOTP(otpInput)) {
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


async function deleteOTP(email, code) {
  if (!client) throw new Error("Redis client not initialized");

  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const key = `otp:${config.purpose}:${email}`;
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

  async function createVerificationSession(email, purpose) {
    if (!client) throw new Error("Redis client not initialized");

    const token = generateRandomKey();
    const key = `verify:${purpose}:${token}`;

    await client.hSet(key, {
      email,
      data_consent: "false",
      data_consent_version: "",
      created_at: Date.now().toString()
    });

    await client.expire(key, Number(process.env.VERIFICATION_SESSION_EXPIRATION) || 900);

    return token;
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

    return true;
  }
  
  async function validateVerificationSession(token, purpose) {
    if (!client) throw new Error("Redis client not initialized");

    const key = `verify:${purpose}:${token}`;
    const session = await client.hGetAll(key);

    if (!session || !session.email) return null;

    // ✅ Enforce: only delete if consent is true AND version matches
    const requiredVersion = process.env.DATA_CONSENT_VERSION;

    const consentValid =
      session.data_consent === "true" &&
      session.data_consent_version === requiredVersion;

    if (consentValid) {
      await client.del(key); // ✅ delete only when fully validated
    }

    return session;
  }

async function enrichVerificationSession(verificationKey, purpose) {
  if (!client) throw new Error("Redis client not initialized");

  const key = `verify:${purpose}:${verificationKey}`;

  // ✅ Load existing session
  const session = await client.hGetAll(key);
  if (!session || !session.email) return null;

  // ✅ Fetch user from DB (returns row OR null)
  const user = await query.getUserConsentStateByEmail(session.email);

  console.log("Enriching session for", session.email, "with user:", user);

  // ✅ If user exists, enrich Redis session with consent state
  if (user) {
    await client.hSet(key, {
      user_exists: "true",
      data_consent: user.data_consent ? "true" : "false",
      data_consent_version: user.data_consent_version || "",
      data_consent_agreed: user.data_consent_agreed
        ? user.data_consent_agreed.toISOString()
        : "",
    });
  } else {
    await client.hSet(key, { user_exists: "false" });
  }

  // ✅ Return updated session
  return await client.hGetAll(key);
}




// ------------------------------------------------

module.exports = {
  connection,
  initRedis,
  setKey,
  getKey,
  delKey,
  setOTP,
  rateLimitIP,
  rateLimitEmailCooldown,
  rateLimitEmailAttempts,
  verifyOTP,
  deleteOTP,

  getOTPFailureCount,
  getOTPLockoutTTL,
  
  createVerificationSession,
  getVerificationSession,
  updateConsentInSession,
  validateVerificationSession,
  enrichVerificationSession
};
