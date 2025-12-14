const express = require("express");
const router = express.Router();

// POST /forget-password/request - Request OTP for password change (forget password)
router.post("/request", async (req, res) => {
  try {
    const { email, recaptchaToken } = req.body;

    // ✅ 1. Required fields
    if (!email || !recaptchaToken) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email and reCAPTCHA token are required."
      });
    }

    // ✅ 2. Basic email format
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email)) {
      return res.status(400).json({
        error: "INVALID_EMAIL_FORMAT",
        message: "Email format is invalid."
      });
    }

    // ✅ 3. Institutional email validation
    const { detectRoleFromEmail } = require('../../config/validator.js');
    const declaredRole = detectRoleFromEmail(email);
    if (!declaredRole) {
      return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
      });
    }

    // ✅ 4. Verify reCAPTCHA
    const { verifyRecaptcha } = require('../../services/recaptcha.js');
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      return res.status(400).json({
        error: "INVALID_RECAPTCHA",
        message: "reCAPTCHA verification failed."
      });
    }

    // ✅ 5. Check if user exists
    const { detectPortalFromSubdomain } = require('../utils/portal.js');
    const portal = detectPortalFromSubdomain(req);
    const pool = require('../../config/db.js');
    const tableName = portal === "patient" ? "patients" : "staff";
    const userQuery = `SELECT id FROM ${tableName} WHERE email = $1`;
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "No account found with this email address."
      });
    }

    // ✅ 6. Rate limiting (simplified)
    const { rateLimitEmailCooldown, rateLimitEmailAttempts } = require('../../config/redis.js');
    const { rateLimitMatrix } = require('../../config/data/matrix.js');
    const profileName = portal === "patient" ? "PatientAuthentication" : "staffAuthentication";
    const profile = rateLimitMatrix[profileName];
    const purpose = "passwordChange";

    const cooldownActive = await rateLimitEmailCooldown(email, portal, purpose, profile.emailCooldown_emailv);
    if (cooldownActive) {
      return res.status(429).json({
        error: "EMAIL_COOLDOWN_ACTIVE",
        message: "Too many attempts. Please try again later."
      });
    }

    const attemptsExceeded = await rateLimitEmailAttempts(
      email, portal, purpose, profile.emailAttemptMax_emailv, profile.emailCooldown_emailv
    );
    if (attemptsExceeded) {
      return res.status(429).json({
        error: "EMAIL_ATTEMPT_LIMIT_REACHED",
        message: "Too many attempts. Please try again later."
      });
    }

    // ✅ 7. Send password change OTP email
    const { enqueuePasswordChangeOTP } = require('../../services/emailservice.js');
    await enqueuePasswordChangeOTP(email, portal);

    return res.status(200).json({
      ok: true,
      message: "OTP sent to your email for password change."
    });

  } catch (err) {
    console.error("Password change request error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred."
    });
  }
});

// POST /forget-password - Change password with OTP verification (for forget password)
router.post("/", async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;

    // ✅ 1. Required fields
    if (!email || !newPassword || !otp) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email, new password, and OTP are required."
      });
    }

    // ✅ 2. Basic email format
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email)) {
      return res.status(400).json({
        error: "INVALID_EMAIL_FORMAT",
        message: "Email format is invalid."
      });
    }

    // ✅ 3. Institutional email validation
    const { detectRoleFromEmail } = require('../../config/validator.js');
    const declaredRole = detectRoleFromEmail(email);
    if (!declaredRole) {
      return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
      });
    }

    // ✅ 4. Password validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "INVALID_PASSWORD",
        message: "Password must be at least 8 characters long."
      });
    }

    // ✅ 5. Verify OTP
    const { detectPortalFromSubdomain } = require('../utils/portal.js');
    const { verifyOTP } = require('../../config/redis.js');
    const portal = detectPortalFromSubdomain(req);
    const code = "passwordChange";

    const result = await verifyOTP(email, code, otp, portal);

    if (result === "LOCKED_OUT") {
      return res.status(429).json({
        error: "OTP_LOCKED_OUT",
        message: "Too many invalid attempts. Please try again later."
      });
    }

    if (result === false) {
      return res.status(400).json({
        error: "INVALID_OTP",
        message: "The OTP you entered is invalid or expired."
      });
    }

    // ✅ 6. Check if user exists
    const pool = require('../../config/db.js');
    const tableName = portal === "patient" ? "patients" : "staff";
    const userQuery = `SELECT id FROM ${tableName} WHERE email = $1`;
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "No account found with this email address."
      });
    }

    // ✅ 7. Hash and update password
    const { hashPassword } = require('../../config/security.js');
    const hashedPassword = await hashPassword(newPassword);

    const updateQuery = `UPDATE ${tableName} SET password = $1 WHERE email = $2`;
    await pool.query(updateQuery, [hashedPassword, email]);

    // ✅ 8. Send confirmation email
    const { enqueuePasswordChangeEmail } = require('../../services/emailservice.js');
    await enqueuePasswordChangeEmail(email, portal);

    return res.status(200).json({
      ok: true,
      message: "Password changed successfully. A confirmation email has been sent."
    });

  } catch (err) {
    console.error("Password change error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred."
    });
  }
});

module.exports = router;
