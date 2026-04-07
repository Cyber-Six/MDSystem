const express = require("express");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");

const { jwtProtect } = require("../../config/middleware/jwtProtect.js");
const query = require("../../config/query.js");
const { verifyPassword } = require("../../utils/security.js");
const logger = require("../../utils/logger.js");

const router = express.Router();

const TOTP_ISSUER = "MDSystem";

// ========================================
// Auto-create TOTP columns if missing
// ========================================
async function ensureTotpColumns() {
  try {
    await query.query(`
      ALTER TABLE "UserCredentials"
        ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false
    `);
    logger.info("[TOTP] TOTP columns ready");
  } catch (err) {
    logger.error("[TOTP] Failed to ensure TOTP columns:", err.message);
  }
}
ensureTotpColumns();

// ========================================
// GET /settings/totp/status
// Returns current TOTP 2FA status
// ========================================
router.get("/status", jwtProtect("medical"), async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query.query(
      `SELECT totp_enabled, allow_email_2fa FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found." });
    }

    const { totp_enabled, allow_email_2fa } = result.rows[0];

    return res.status(200).json({
      ok: true,
      totpEnabled: totp_enabled || false,
      emailTwoFactorEnabled: allow_email_2fa || false,
    });
  } catch (err) {
    logger.error(`[TOTP] Status error userId=${userId}:`, err);
    return res.status(500).json({ error: "TOTP_STATUS_FAILED", message: "Failed to fetch 2FA status." });
  }
});

// ========================================
// POST /settings/totp/setup
// Generate a new TOTP secret + QR code
// Does NOT enable TOTP yet — user must verify first
// ========================================
router.post("/setup", jwtProtect("medical"), async (req, res) => {
  const userId = req.user.id;

  try {
    // Check if TOTP is already enabled
    const existing = await query.query(
      `SELECT totp_enabled, email FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found." });
    }

    if (existing.rows[0].totp_enabled) {
      return res.status(400).json({
        error: "TOTP_ALREADY_ENABLED",
        message: "TOTP 2FA is already enabled. Disable it first to set up a new one.",
      });
    }

    const email = existing.rows[0].email;

    // Generate new secret
    const secret = authenticator.generateSecret();

    // Store secret in DB (not yet enabled — user must verify first)
    await query.query(
      `UPDATE "UserCredentials" SET totp_secret = $1, totp_enabled = false WHERE id = $2`,
      [secret, userId]
    );

    // Build otpauth URI
    const otpauthUrl = authenticator.keyuri(email, TOTP_ISSUER, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    logger.info(`[TOTP] Setup initiated userId=${userId}`);

    return res.status(200).json({
      ok: true,
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
      message: "Scan the QR code with your authenticator app, then verify with a code.",
    });
  } catch (err) {
    logger.error(`[TOTP] Setup error userId=${userId}:`, err);
    return res.status(500).json({ error: "TOTP_SETUP_FAILED", message: "Failed to set up TOTP." });
  }
});

// ========================================
// POST /settings/totp/verify
// Verify a TOTP code and enable 2FA
// Body: { token: "123456" }
// ========================================
router.post("/verify", jwtProtect("medical"), async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;

  if (!token || typeof token !== "string" || token.length !== 6) {
    return res.status(400).json({
      error: "INVALID_TOKEN",
      message: "A 6-digit verification code is required.",
    });
  }

  try {
    const result = await query.query(
      `SELECT totp_secret, totp_enabled FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found." });
    }

    const { totp_secret, totp_enabled } = result.rows[0];

    if (!totp_secret) {
      return res.status(400).json({
        error: "TOTP_NOT_SETUP",
        message: "TOTP has not been set up. Call /settings/totp/setup first.",
      });
    }

    if (totp_enabled) {
      return res.status(400).json({
        error: "TOTP_ALREADY_ENABLED",
        message: "TOTP 2FA is already enabled.",
      });
    }

    // Verify the token with a 1 step window (30s before + 30s after)
    const isValid = authenticator.check(token, totp_secret);

    if (!isValid) {
      logger.warn(`[TOTP] Invalid verification code userId=${userId}`);
      return res.status(400).json({
        error: "INVALID_TOTP_CODE",
        message: "Invalid verification code. Please try again.",
      });
    }

    // Enable TOTP
    await query.query(
      `UPDATE "UserCredentials" SET totp_enabled = true WHERE id = $1`,
      [userId]
    );

    logger.info(`[TOTP] 2FA enabled userId=${userId}`);

    return res.status(200).json({
      ok: true,
      message: "TOTP 2FA has been enabled successfully.",
    });
  } catch (err) {
    logger.error(`[TOTP] Verify error userId=${userId}:`, err);
    return res.status(500).json({ error: "TOTP_VERIFY_FAILED", message: "Failed to verify TOTP code." });
  }
});

// ========================================
// POST /settings/totp/disable
// Disable TOTP 2FA (requires password confirmation)
// Body: { password: "..." }
// ========================================
router.post("/disable", jwtProtect("medical"), async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      error: "MISSING_PASSWORD",
      message: "Password is required to disable 2FA.",
    });
  }

  try {
    const result = await query.query(
      `SELECT totp_enabled, password_hash FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found." });
    }

    const { totp_enabled, password_hash } = result.rows[0];

    if (!totp_enabled) {
      return res.status(400).json({
        error: "TOTP_NOT_ENABLED",
        message: "TOTP 2FA is not currently enabled.",
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, password_hash);
    if (!passwordValid) {
      logger.warn(`[TOTP] Invalid password for disable userId=${userId}`);
      return res.status(401).json({
        error: "INVALID_PASSWORD",
        message: "Incorrect password.",
      });
    }

    // Disable TOTP and clear secret
    await query.query(
      `UPDATE "UserCredentials" SET totp_enabled = false, totp_secret = NULL WHERE id = $1`,
      [userId]
    );

    logger.info(`[TOTP] 2FA disabled userId=${userId}`);

    return res.status(200).json({
      ok: true,
      message: "TOTP 2FA has been disabled.",
    });
  } catch (err) {
    logger.error(`[TOTP] Disable error userId=${userId}:`, err);
    return res.status(500).json({ error: "TOTP_DISABLE_FAILED", message: "Failed to disable TOTP." });
  }
});

// ========================================
// POST /settings/totp/validate
// Validate a TOTP code during login flow
// This is called from the login flow, not from settings
// Body: { token: "123456", verificationKey: "..." }
// ========================================
router.post("/validate", async (req, res) => {
  const { token, verificationKey, email } = req.body;

  if (!token || !verificationKey || !email) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Token, email, and verification key are required.",
    });
  }

  if (typeof token !== "string" || token.length !== 6) {
    return res.status(400).json({
      error: "INVALID_TOKEN",
      message: "A 6-digit verification code is required.",
    });
  }

  try {
    const { getVerificationSession } = require("../../config/redis.js");

    // Validate the verification session exists
    const session = await getVerificationSession(verificationKey, "2fa");
    if (!session || !session.email) {
      return res.status(400).json({
        error: "INVALID_SESSION",
        message: "Login session is invalid or expired.",
      });
    }

    // Verify the email matches the session
    if (session.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        error: "EMAIL_MISMATCH",
        message: "Email does not match the login session.",
      });
    }

    // Get user's TOTP secret
    const result = await query.query(
      `SELECT totp_secret, totp_enabled FROM "UserCredentials" WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "USER_NOT_FOUND", message: "User not found." });
    }

    const { totp_secret, totp_enabled } = result.rows[0];

    if (!totp_enabled || !totp_secret) {
      return res.status(400).json({
        error: "TOTP_NOT_ENABLED",
        message: "TOTP 2FA is not enabled for this account.",
      });
    }

    // Verify the TOTP code
    const isValid = authenticator.check(token, totp_secret);

    if (!isValid) {
      return res.status(400).json({
        error: "INVALID_TOTP_CODE",
        message: "Invalid authenticator code. Please try again.",
      });
    }

    // Mark 2FA as verified in the session
    const { updateTotp2FAInSession } = require("../../config/redis.js");
    await updateTotp2FAInSession(verificationKey, email, "2fa");

    logger.info(`[TOTP] Login TOTP validated for email=${email}`);

    return res.status(200).json({
      ok: true,
      verificationKey,
      message: "TOTP verification successful.",
    });
  } catch (err) {
    logger.error(`[TOTP] Validate error:`, err);
    return res.status(500).json({ error: "TOTP_VALIDATE_FAILED", message: "Failed to validate TOTP." });
  }
});

module.exports = router;
