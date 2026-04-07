const express = require("express");
const router = express.Router();

const { jwtProtect } = require("../../config/middleware/jwtProtect.js");
const { ipRateLimiter } = require("../../config/middleware/ratelimiter.js");
const { findUserByEmail, findEmailByUserId, updateUserPasswordById } = require("../../config/query.js");
const { verifyPassword } = require("../../utils/security.js");
const { totpVerify, decryptTotpSecret } = require("../../utils/totp.js");
const query = require("../../config/query.js");
const logger = require("../../utils/logger.js");

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
        `SELECT password_hash, totp_enabled, totp_secret FROM "UserCredentials" WHERE id = $1`,
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
