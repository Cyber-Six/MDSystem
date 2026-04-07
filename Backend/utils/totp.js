/**
 * Shared TOTP helpers (RFC 6238) using Node.js native crypto.
 * No external library dependency.
 */
const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0, value = 0, output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return output;
}

function base32Decode(encoded) {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0, value = 0;
  const output = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpGenerateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpGetToken(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(counterBuf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, "0");
}

function totpVerify(token, secret, window = 1) {
  token = String(token);
  if (token.length !== 6) return false;
  const now = Date.now();
  const tokenBuf = Buffer.from(token);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(totpGetToken(secret, now + i * 30000));
    if (crypto.timingSafeEqual(expected, tokenBuf)) return true;
  }
  return false;
}

function totpKeyUri(account, secret, issuer = "MDSystem") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ========================================
// TOTP Secret Encryption (AES-256-GCM)
// Requires TOTP_ENCRYPTION_KEY env var: 64 hex chars (32 bytes)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ========================================
function _getEncryptionKey() {
  const keyHex = process.env.TOTP_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("TOTP_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes).");
  }
  return Buffer.from(keyHex, "hex");
}

function encryptTotpSecret(plaintext) {
  const key = _getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptTotpSecret(stored) {
  const key = _getEncryptionKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted TOTP secret format. Re-run TOTP setup to re-encrypt.");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { totpGenerateSecret, totpGetToken, totpVerify, totpKeyUri,
                   encryptTotpSecret, decryptTotpSecret };
