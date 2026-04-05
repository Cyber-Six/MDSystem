// security.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 10 rounds ≈ ~65ms on RPi5 vs ~260ms at 12.
// OWASP/NIST consider 10 rounds adequate for bcrypt.
const SALT_ROUNDS = 10;

// Password functions
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateRandomKey(length=32) {
  return crypto.randomBytes(length).toString("hex"); // 64-char token
  }

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// OTP functions
function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

/**
 * Randomized delay with min/max bounds, feed bias, blend shaping,
 * cryptographic randomness, and capped feed effect.
 *
 * @param {number} minMs - Minimum delay in ms (absolute floor).
 * @param {number} maxMs - Maximum delay in ms (absolute ceiling).
 * @param {number} feed - Hook factor (e.g. failures count).
 * @param {number} blend - Curve blend between linear (0) and log (1).
 * @param {number} maxFeed - Cap for feed effect (default 10).
 * @returns {Promise<void>}
 */
function delayRandom(minMs = 500, maxMs = 2500, feed = 1, blend = 0.5, maxFeed = 10) {
    if (minMs > maxMs) {
        throw new Error("minMs must be <= maxMs");
    }

    // Cap feed so it doesn't explode
    const effectiveFeed = Math.min(feed, maxFeed);

    // Cryptographically strong random in [0,1]
    const randArray = new Uint32Array(1);
    crypto.getRandomValues(randArray);
    let rand = randArray[0] / 2**32;

    // Linear component
    const linear = rand;

    // Logarithmic component (skew toward lower values)
    const log = Math.log1p(rand * (Math.E - 1)) / Math.log(Math.E);

    // Blend between linear and log
    let shaped = (1 - blend) * linear + blend * log;

    // Bias upward as feed increases (higher feed → closer to max)
    shaped = Math.pow(shaped, 1 / effectiveFeed);

    // Clamp
    shaped = Math.min(Math.max(shaped, 0), 1);

    // Map into [min, max]
    const ms = Math.floor(shaped * (maxMs - minMs)) + minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
}


function generateUUID() {
  return crypto.randomUUID();
}

module.exports = { 
  hashPassword, verifyPassword, hashOTP, generateOTP, 
  generateRandomKey, delayRandom, generateUUID 
};
