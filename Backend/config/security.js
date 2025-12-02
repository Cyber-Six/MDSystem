// security.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

// Password functions
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
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


module.exports = { hashPassword, verifyPassword, generateOTP };
