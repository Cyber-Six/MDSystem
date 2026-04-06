const express = require("express");
const router = express.Router();

const { ipRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const logger = require('../../../utils/logger.js');
const { isValidEmail } = require('../../../utils/validator.js');
const { detectPortalFromSubdomain } = require('../../../utils/portal.js');
const { rateLimitEmailCooldown, rateLimitEmailAttempts, rateLimitEmailCooldownTTL,
  getUserIdFromVerificationSession, deleteVerificationSession } = require('../../../config/redis.js');
const query = require('../../../config/query.js');

const { recordResetPwFailure, clearResetPwFailures, isResetPwLocked} = require('../../../config/redis.js');
const { rateLimitMatrix } = require('../../../config/data/matrix.js');
const { enqueueResetPassword } = require('../../../services/emailservice.js');
const { delayRandom } = require('../../../utils/security.js');

router.post("/forget-password", ipRateLimiter("strictLimiter"), async (req, res) => {
  const ip = req.ip;
  try {

    // ✅ 0. Check if this IP is locked from resetpw attempts
    if (await isResetPwLocked(ip)) {
      await delayRandom(200, 500);
      return res.status(429).set("Retry-After", 3).json({
        error: "LOCKED_OUT",
        message: "Too many invalid attempts. Try again later."
      });
    }

    const { email, recaptchaToken } = req.body;

    // ✅ 1. Required fields
    if (!email || !recaptchaToken) {
      await delayRandom(200, 500);
      await recordResetPwFailure(ip);
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email and reCAPTCHA token are required."
      });
    }

    // ✅ 2. Institutional email validation
    if (!isValidEmail(email)) {
      await delayRandom(200, 500);
      await recordResetPwFailure(ip);
      return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
      });
    }

    // ✅ 3. Verify reCAPTCHA
    const { verifyRecaptcha } = require('../../../services/recaptcha.js');
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      await delayRandom(200, 500);
      await recordResetPwFailure(ip);
      return res.status(400).json({
        error: "INVALID_RECAPTCHA",
        message: "reCAPTCHA verification failed."
      });
    }

    // ✅ 4. Rate limiting (simplified)
    const portal = detectPortalFromSubdomain(req);
    const profileName = portal === "patient" ? "PatientAuthentication" : "staffAuthentication";
    const profile = rateLimitMatrix[profileName];
    const purpose = "resetpw";

    const cooldownActive = await rateLimitEmailCooldown(email, portal, purpose, profile.emailCooldown_resetpw);
    if (cooldownActive) {
      const ttl = await rateLimitEmailCooldownTTL(email, portal, purpose);
      return res.status(429).json({
        error: "EMAIL_COOLDOWN_ACTIVE",
        message: `Too many attempts. Please try again in ${ttl} seconds.`,
        retryAfterSeconds: ttl
      });
    }

    const attemptsExceeded = await rateLimitEmailAttempts(
      email, portal, purpose,
      profile.emailAttemptMax_resetpw,
      profile.penaltyCooldown_resetpw );

    if (attemptsExceeded) {
      await delayRandom(200, 500);
      return res.status(429).json({
        error: "EMAIL_ATTEMPT_LIMIT_REACHED",
        message: "Too many attempts. Please try again later."
      });
    }

    // ✅ 5. Check if user exists
    await clearResetPwFailures(ip);

    const existing = await query.findUserByEmail(email);
    if (!existing) {
        logger.debug(`Cant send password reset, user not found: ${email}`);
        return res.status(200).json({
            ok: true,
            message: "OTP sent to your email for password change."
        });
    }
    logger.debug(`Enqueuing password reset for user: ${email}`);
    await enqueueResetPassword(email, portal);
    
    return res.status(200).json({
      ok: true,
      message: "OTP sent to your email for password change."
    });

  } catch (err) {
    logger.error("Password change request error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred."
    });
  }
});

router.post("/reset-password/:verificationKey", ipRateLimiter("strictLimiter"), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const verificationKey = req.params.verificationKey;
    const purpose = "resetpassword";
    const ip = req.ip;

    // ✅ 1. Required fields
    if (!verificationKey || !newPassword) {
      await delayRandom(200, 500);
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Verification key and new password are required."
      });
    }

    // ✅ 2. Check if IP is locked out
    if (await isResetPwLocked(ip)) {
      await delayRandom(200, 500);
      return res.status(429).json({
        error: "LOCKED_OUT",
        message: "Too many invalid attempts. Try again later."
      });
    }

    // ✅ 3. Fetch userId from verification session
    const userId = await getUserIdFromVerificationSession(verificationKey, purpose);

    if (!userId) {
      // ❗ Record failure for invalid or expired key
      await recordResetPwFailure(ip);
      await delayRandom(200, 500);
      return res.status(400).json({
        error: "INVALID_OR_EXPIRED_KEY",
        message: "The verification key is invalid or has expired."
      });
    }

    // ✅ 4. Update password in DB
    await query.updateUserPasswordById(userId, newPassword);

    // ✅ 5. Cleanup verification session
    await deleteVerificationSession(verificationKey, purpose);

    // ✅ 6. Clear IP failures on success
    await clearResetPwFailures(ip);

    return res.status(200).json({
      ok: true,
      message: "Password has been reset successfully."
    });

  } catch (err) {
    logger.error("Reset password verification error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred."
    });
  }
});



module.exports = router;
