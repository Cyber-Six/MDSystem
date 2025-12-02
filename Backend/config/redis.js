// config/redis.js
const redis = require("redis");
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");

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
// OTP functions
function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

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

  const config = OTPMatrix[code];
  if (!config) throw new Error(`Unknown OTP code type: ${code}`);

  const hashedOtp = hashOTP(otp);
  const key = `otp:${config.purpose}:${email}`;

  await client.set(key, hashedOtp, {
    EX: config.expiration,
  });
}


async function verifyOTP(email, otpInput) {
  if (!client) throw new Error("Redis client not initialized");

  const storedHashedOtp = await client.get(`otp:${email}`);
  if (!storedHashedOtp) return false; // expired or not found

  if (storedHashedOtp === hashOTP(otpInput)) {
    await client.del(`otp:${email}`); // delete OTP after successful verification
    return true;
  }

  return false;
}

async function deleteOTP(email) {
  if (!client) throw new Error("Redis client not initialized");
  await client.del(`otp:${email}`);
}

// ------------------------------------------------

module.exports = {
  connection,
  initRedis,
  setKey,
  getKey,
  delKey,
  setOTP,
  verifyOTP,
  deleteOTP,
};
