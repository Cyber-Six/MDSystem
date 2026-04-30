const express = require("express");
const router = express.Router();

const { jwtProtect } = require("../../config/middleware/jwtProtect.js");
const { ipRateLimiter } = require("../../config/middleware/ratelimiter.js");
const { findUserByEmail, findEmailByUserId, updateUserPasswordById } = require("../../config/query.js");
const { verifyPassword } = require("../../utils/security.js");
const { totpVerify, decryptTotpSecret } = require("../../utils/totp.js");
const { verifyOTP, getOTPFailureCount, getOTPLockoutTTL,
        rateLimitEmailCooldown, rateLimitEmailAttempts,
        deleteEmailCooldown, deleteEmailAttempts } = require("../../config/redis.js");
const { detectPortalFromSubdomain } = require("../../utils/portal.js");
const { enqueueSettingsOTP } = require("../../services/emailservice.js");
const query = require("../../config/query.js");
const logger = require("../../utils/logger.js");

// ========================================
// POST /settings/password/change/otp/send
// Send email OTP to authorize a password change
// ========================================
router.post(
  "/change/otp/send",
  jwtProtect("all"),
  ipRateLimiter("strictLimiter"),
  async (req, res) => {
    const userId = req.user.id;
    const portal = detectPortalFromSubdomain(req).toLowerCase();

    try {
      const email = await findEmailByUserId(userId);
      if (!email) {
        return res.status(404).json({ ok: false, error: "USER_NOT_FOUND", message: "User not found." });
      }

      const { rateLimitMatrix } = require("../../config/data/matrix.js");
      const profileName = portal === "patient" ? "PatientAuthentication" : "staffAuthentication";
      const profile = rateLimitMatrix[profileName];
      const cooldownSec = profile?.emailCooldown_2fa ?? 60;
      const maxAttempts = profile?.emailAttemptMax_2fa ?? 5;
      const penaltyCooldown = profile?.penaltyCooldown_resetpw ?? 900;

      const cooldownActive = await rateLimitEmailCooldown(email, portal, "settingsAction", cooldownSec);
      if (cooldownActive) {
        return res.status(429).json({ ok: false, error: "EMAIL_COOLDOWN_ACTIVE", message: "Please wait before requesting another code." });
      }

      const attemptsExceeded = await rateLimitEmailAttempts(email, portal, "settingsAction", maxAttempts, penaltyCooldown);
      if (attemptsExceeded) {
        return res.status(429).json({ ok: false, error: "EMAIL_ATTEMPT_LIMIT_REACHED", message: "Too many attempts. Please try again later." });
      }

      await enqueueSettingsOTP(email, portal);

      return res.status(200).json({ ok: true, message: "OTP sent to your email." });
    } catch (err) {
      logger.error(`[SETTINGS] OTP send error userId=${userId}:`, err);
      return res.status(500).json({ ok: false, error: "OTP_SEND_FAILED", message: "Failed to send OTP. Please try again." });
    }
  }
);

// ========================================
// POST /settings/password/change
// Change password for authenticated user
//
// Body:
//   currentPassword  - user's existing password
//   newPassword      - desired new password (min 8 chars)
//   totpToken        - 6-digit TOTP code (when TOTP enabled and preferred)
//   emailOtp         - 6-digit email OTP (always accepted; required when TOTP not enabled)
// ========================================
router.post(
  "/change",
  jwtProtect("all"),
  ipRateLimiter("strictLimiter"),
  async (req, res) => {
    const userId = req.user.id;
    const portal = detectPortalFromSubdomain(req).toLowerCase();
    const { currentPassword, newPassword, totpToken, emailOtp } = req.body;

    // ── Input validation ──
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_FIELDS",
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "PASSWORD_TOO_SHORT",
        message: "New password must be at least 8 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        ok: false,
        error: "SAME_PASSWORD",
        message: "New password must be different from the current password.",
      });
    }

    try {
      // ── Fetch user credentials ──
      const credResult = await query.query(
        `SELECT password_hash, totp_enabled, totp_secret FROM active_user_credentials WHERE id = $1`,
        [userId]
      );

      if (credResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: "USER_NOT_FOUND", message: "User not found." });
      }

      const { password_hash, totp_enabled, totp_secret } = credResult.rows[0];

      // ── Verify current password ──
      const passwordValid = await verifyPassword(currentPassword, password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          ok: false,
          error: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect.",
        });
      }

      // ── 2FA verification: TOTP takes priority; email OTP is always acceptable ──
      if (totpToken) {
        // User submitted TOTP code
        if (!/^\d{6}$/.test(totpToken)) {
          return res.status(400).json({ ok: false, error: "TOTP_REQUIRED", message: "A 6-digit authenticator code is required." });
        }
        if (!totp_enabled) {
          return res.status(400).json({ ok: false, error: "TOTP_NOT_ENABLED", message: "Authenticator 2FA is not enabled on this account." });
        }
        const plainSecret = decryptTotpSecret(totp_secret);
        const tokenValid = totpVerify(totpToken, plainSecret);
        if (!tokenValid) {
          logger.warn(`[SETTINGS] Invalid TOTP for change-password userId=${userId}`);
          return res.status(400).json({ ok: false, error: "INVALID_TOTP_CODE", message: "Invalid authenticator code. Please try again." });
        }
      } else if (emailOtp) {
        // User submitted email OTP
        const email = await findEmailByUserId(userId);
        if (!email) {
          return res.status(404).json({ ok: false, error: "USER_NOT_FOUND", message: "User not found." });
        }
        const result = await verifyOTP(email, "settingsAction", emailOtp, portal);
        if (result === "LOCKED_OUT") {
          const ttl = await getOTPLockoutTTL(email, "settingsAction");
          return res.status(429).json({ ok: false, error: "OTP_LOCKED_OUT", message: `Too many invalid attempts. Please try again in ${ttl} seconds.`, retryAfterSeconds: ttl });
        }
        if (result === false) {
          const failures = await getOTPFailureCount(email, "settingsAction");
          return res.status(400).json({ ok: false, error: "INVALID_OTP", message: "The OTP you entered is invalid or expired.", attempts: failures });
        }
        // OTP valid — clean up rate limit state
        await deleteEmailCooldown(email, portal, "settingsAction");
        await deleteEmailAttempts(email, portal, "settingsAction");
      } else {
        // Neither TOTP nor email OTP provided
        return res.status(400).json({
          ok: false,
          error: "VERIFICATION_REQUIRED",
          message: totp_enabled
            ? "An authenticator code or email OTP is required to change your password."
            : "An email OTP is required to change your password.",
        });
      }

      // ── Update password ──
      await updateUserPasswordById(userId, newPassword);

      logger.info(`[SETTINGS] Password changed userId=${userId}`);
      return res.status(200).json({
        ok: true,
        message: "Password changed successfully.",
      });
    } catch (err) {
      logger.error(`[SETTINGS] Change password error userId=${userId}:`, err);
      return res.status(500).json({
        ok: false,
        error: "CHANGE_PASSWORD_FAILED",
        message: "Failed to change password. Please try again.",
      });
    }
  }
);

module.exports = router;


// ========================================
// POST /settings/password/change
// Change password for authenticated staff
//
// Body:
//   currentPassword  - user's existing password
//   newPassword      - desired new password (min 8 chars)
//   totpToken        - 6-digit TOTP code (required when TOTP is enabled)
// ========================================
router.post(
  "/change",
  jwtProtect("medical"),
  ipRateLimiter("strictLimiter"),
  async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword, totpToken } = req.body;

    // ── Input validation ──
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_FIELDS",
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "PASSWORD_TOO_SHORT",
        message: "New password must be at least 8 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        ok: false,
        error: "SAME_PASSWORD",
        message: "New password must be different from the current password.",
      });
    }

    try {
      // ── Fetch user credentials ──
      const credResult = await query.query(
        `SELECT password_hash, totp_enabled, totp_secret FROM active_user_credentials WHERE id = $1`,
        [userId]
      );

      if (credResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: "USER_NOT_FOUND", message: "User not found." });
      }

      const { password_hash, totp_enabled, totp_secret } = credResult.rows[0];

      // ── Verify current password ──
      const passwordValid = await verifyPassword(currentPassword, password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          ok: false,
          error: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect.",
        });
      }

      // ── TOTP check (required when enabled) ──
      if (totp_enabled) {
        if (!totpToken || !/^\d{6}$/.test(totpToken)) {
          return res.status(400).json({
            ok: false,
            error: "TOTP_REQUIRED",
            message: "A 6-digit authenticator code is required to change your password.",
          });
        }

        const plainSecret = decryptTotpSecret(totp_secret);
        const tokenValid = totpVerify(totpToken, plainSecret);

        if (!tokenValid) {
          logger.warn(`[SETTINGS] Invalid TOTP for change-password userId=${userId}`);
          return res.status(400).json({
            ok: false,
            error: "INVALID_TOTP_CODE",
            message: "Invalid authenticator code. Please try again.",
          });
        }
      }

      // ── Update password ──
      await updateUserPasswordById(userId, newPassword);

      logger.info(`[SETTINGS] Password changed userId=${userId}`);
      return res.status(200).json({
        ok: true,
        message: "Password changed successfully.",
      });
    } catch (err) {
      logger.error(`[SETTINGS] Change password error userId=${userId}:`, err);
      return res.status(500).json({
        ok: false,
        error: "CHANGE_PASSWORD_FAILED",
        message: "Failed to change password. Please try again.",
      });
    }
  }
);

module.exports = router;
