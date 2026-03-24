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

function generateRandomKey() {
  return crypto.randomBytes(32).toString("hex"); // 64-char token
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

// anti timed based attack delay
function delayRandom(minMs = 1000, maxMs = 1500) {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { hashPassword, verifyPassword, hashOTP, generateOTP, generateRandomKey, delayRandom };
