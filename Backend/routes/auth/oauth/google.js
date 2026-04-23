const express = require("express");
const { isValidEmail } = require("../../../utils/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");
const { verifyGoogleToken } = require("../../../services/google-oauth.js");
const { createVerificationSession, isLoginLocked } = require("../../../config/redis.js");
const query = require("../../../config/query.js");
const { detectPortalFromSubdomain } = require("../../../utils/portal.js");
const logger = require("../../../utils/logger.js");

const router = express.Router();

const GOOGLE_OAUTH_ENABLED = process.env.GOOGLE_OAUTH_ENABLED !== 'false';
const VERIFICATIONKEY_PURPOSE = "2fa";

function getRequestAuditMetadata(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || '').split(',')[0];

  const ipAddress = String(
    forwardedIp || req.ip || req.socket?.remoteAddress || ''
  ).trim() || null;
  const userAgent = String(req.headers['user-agent'] || '').trim() || null;

  return { ipAddress, userAgent };
}

function isCredentialTemporarilyLocked(lockState) {
  if (!lockState) return false;

  const status = String(lockState.status || '').toLowerCase();
  return status === 'locked';
}

/**
 * POST /auth/oauth/google
 *
 * Google OAuth login endpoint.
 * Accepts a Google ID token + reCAPTCHA token, verifies both server-side,
 * then creates a verification session (same as password login).
 *
 * Security layers:
 *  1. IP rate limiting (portal-based)
 *  2. Google ID token verification (signature + audience + hd claim)
 *  3. @tip.edu.ph domain enforcement
 *  4. Existing user requirement (no auto-registration)
 *  5. Login lockout check
 *  6. Portal-based account type validation
 *
 * reCAPTCHA is no longer verified here. After OAuth credential verification
 * succeeds, the frontend presents the reCAPTCHA gate before allowing the user
 * to proceed to 2FA. Email OTP sending is gated server-side by reCAPTCHA in
 * the /auth/email/2fa endpoint.
 */
router.post("/google", portalBasedIpRateLimiter(), async (req, res) => {
  // ✅ Feature flag — set GOOGLE_OAUTH_ENABLED=false to disable
  if (!GOOGLE_OAUTH_ENABLED) {
    return res.status(503).json({
      error: "OAUTH_DISABLED",
      message: "Google OAuth is currently disabled.",
    });
  }

  const { credential } = req.body;
  let account_type = detectPortalFromSubdomain(req);
  const auditMetadata = getRequestAuditMetadata(req);
  const recordAttempt = async (wasSuccessful, targetEmail = null, userId = null) => {
    try {
      await query.recordLoginAttempt({
        email: targetEmail,
        userId,
        wasSuccessful,
        userType: account_type,
        ipAddress: auditMetadata.ipAddress,
        userAgent: auditMetadata.userAgent,
      });
    } catch (auditErr) {
      logger.warn('[GOOGLE_OAUTH] Failed to write login attempt audit record', {
        email: targetEmail || null,
        userId: userId || null,
        ipAddress: auditMetadata.ipAddress,
        error: auditErr?.message || 'Unknown audit write error',
      });
    }
  };

  account_type = account_type.toLowerCase();
  // ✅ Required fields
  if (!credential) {
    await recordAttempt(false, null, null);
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Google credential is required.",
    });
  }

  // ✅ Verify Google ID token
  const googleUser = await verifyGoogleToken(credential);
  if (!googleUser) {
    await recordAttempt(false, null, null);
    return res.status(400).json({
      error: "INVALID_GOOGLE_TOKEN",
      message: "Google authentication failed. Ensure you are using a @tip.edu.ph account.",
    });
  }

  const email = googleUser.email;

  // ✅ Validate email format (defense-in-depth)
  if (!isValidEmail(email)) {
    await recordAttempt(false, email, null);
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format.",
    });
  }

  // ✅ Check login lockout
  const loginTtl = await isLoginLocked(email, account_type);
  if (loginTtl > 0) {
    await recordAttempt(false, email, null);
    return res.status(403).json({
      error: "ACCOUNT_LOCKED",
      message: `Too many failed login attempts. Please try in ${loginTtl} seconds.`,
    });
  }

  // ✅ User must already exist (no auto-registration via OAuth)
  const user = await query.findUserByEmail(email);
  if (!user) {
    await recordAttempt(false, email, null);
    return res.status(400).json({
      error: "ACCOUNT_NOT_FOUND",
      message: "No account found for this email. Please register first.",
    });
  }

  const lockState = await query.getCredentialLockStateByEmail(email);
  if (isCredentialTemporarilyLocked(lockState)) {
    await recordAttempt(false, email, user.id);
    return res.status(403).json({
      error: 'ACCOUNT_LOCKED',
      message: 'This account is locked.',
    });
  }

  // ✅ Staff portal: must be active medical personnel
  if (account_type === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(user.id);
    if (!isMedical) {
      const isActive = await query.getMedicalPersonnelStatus(user.id);
      await recordAttempt(false, email, user.id);
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
  // Stage-1 OAuth login audit is non-successful; full success is recorded at /complete.
  await recordAttempt(false, email, user.id);

  // ✅ Determine 2FA requirements (same logic as password login)
  const requiresTotp = user.totp_enabled || false;

  logger.info(`Google OAuth login: session created for ${email} (portal=${account_type})`);

  return res.status(200).json({
    ok: true,
    email,
    requires2FA: true,
    requiresTotp,
    LoginKey: verificationKey,
  });
});

module.exports = router;
