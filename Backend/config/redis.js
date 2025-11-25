// redisClient.js
const redis = require("redis");
const crypto = require("crypto");

let client;

/**
 * Initialize Redis client
 * @param {Object} options - optional config { url, password }
 */
async function initRedis(options = {}) {
  client = redis.createClient(options);

  client.on("error", (err) => {
    console.error("Redis Client Error", err);
  });

  client.on("connect", () => {
    console.log("✅ Connected to Redis");
  });

  await client.connect();
  return client;
}

/**
 * Set a key with optional expiration
 * @param {string} key 
 * @param {string|number} value 
 * @param {number} expireSeconds - optional expiration in seconds
 */
async function setKey(key, value, expireSeconds) {
  if (!client) throw new Error("Redis client not initialized");

  if (expireSeconds) {
    await client.set(key, value, { EX: expireSeconds });
  } else {
    await client.set(key, value);
  }
}

/**
 * Get a key
 * @param {string} key 
 */
async function getKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  return await client.get(key);
}

/**
 * Delete a key
 * @param {string} key 
 */
async function delKey(key) {
  if (!client) throw new Error("Redis client not initialized");
  await client.del(key);
  }


function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
  }

async function setOTP(email, otp, expireSeconds = 300) {
  if (!client) throw new Error("Redis client not initialized");

  const hashedOtp = hashOTP(otp);
  await client.set(`otp:${email}`, hashedOtp, { EX: expireSeconds });
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

module.exports = {
  initRedis,
  setKey,
  getKey,
  delKey,
  setOTP,
  verifyOTP,
  deleteOTP
};
