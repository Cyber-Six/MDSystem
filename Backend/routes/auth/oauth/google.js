const express = require("express");
const { isValidEmail } = require("../../../utils/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");
const { verifyRecaptcha } = require("../../../services/recaptcha.js");
const { verifyGoogleToken } = require("../../../services/google-oauth.js");
const { createVerificationSession, isLoginLocked } = require("../../../config/redis.js");
const query = require("../../../config/query.js");
const { detectPortalFromSubdomain } = require("../../../utils/portal.js");
const logger = require("../../../utils/logger.js");

const router = express.Router();

const VERIFICATIONKEY_PURPOSE = "2fa";

/**
 * POST /auth/oauth/google
 *
 * Google OAuth login endpoint.
 * Accepts a Google ID token + reCAPTCHA token, verifies both server-side,
 * then creates a verification session (same as password login).
 *
 * Security layers:
 *  1. IP rate limiting (portal-based)
 *  2. reCAPTCHA verification
 *  3. Google ID token verification (signature + audience + hd claim)
 *  4. @tip.edu.ph domain enforcement
 *  5. Existing user requirement (no auto-registration)
 *  6. Login lockout check
 *  7. Portal-based account type validation
 *
 * The session then follows the same 2FA → consent → /login/complete flow.
 */
router.post("/google", portalBasedIpRateLimiter(), async (req, res) => {
  const { credential, recaptchaToken } = req.body;
  const account_type = detectPortalFromSubdomain(req);

  // ✅ Required fields
  if (!credential || !recaptchaToken) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Google credential and reCAPTCHA token are required.",
    });
  }

  // ✅ Verify reCAPTCHA
  const recaptchaValid = await verifyRecaptcha(recaptchaToken);
  if (!recaptchaValid) {
    return res.status(400).json({
      error: "INVALID_RECAPTCHA",
      message: "reCAPTCHA verification failed.",
    });
  }

  // ✅ Verify Google ID token
  const googleUser = await verifyGoogleToken(credential);
  if (!googleUser) {
    return res.status(400).json({
      error: "INVALID_GOOGLE_TOKEN",
      message: "Google authentication failed. Ensure you are using a @tip.edu.ph account.",
    });
  }

  const email = googleUser.email;

  // ✅ Validate email format (defense-in-depth)
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format.",
    });
  }

  // ✅ Check login lockout
  const loginTtl = await isLoginLocked(email, account_type);
  if (loginTtl > 0) {
    return res.status(403).json({
      error: "ACCOUNT_LOCKED",
      message: `Too many failed login attempts. Please try in ${loginTtl} seconds.`,
    });
  }

  // ✅ User must already exist (no auto-registration via OAuth)
  const user = await query.findUserByEmail(email);
  if (!user) {
    return res.status(400).json({
      error: "ACCOUNT_NOT_FOUND",
      message: "No account found for this email. Please register first.",
    });
  }

  // ✅ Staff portal: must be active medical personnel
  if (account_type === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(user.id);
    if (!isMedical) {
      const isActive = await query.getMedicalPersonnelStatus(user.id);
      if (isActive === false) {
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account has been suspended.",
        });
      }
      return res.status(400).json({
        error: "INVALID_CREDENTIALS",
        message: "This account does not have staff access.",
      });
    }
  }

  // ✅ Create verification session — same as password login
  // Google OAuth proves identity, but 2FA + consent are still required.
  const verificationKey = await createVerificationSession(email, VERIFICATIONKEY_PURPOSE, account_type);

  // ✅ Determine 2FA requirements (same logic as password login)
  const requiresTotp = user.totp_enabled || false;

  logger.info(`Google OAuth login: session created for ${email} (portal=${account_type})`);

  return res.status(200).json({
    ok: true,
    requires2FA: true,
    requiresTotp,
    LoginKey: verificationKey,
  });
});

module.exports = router;
