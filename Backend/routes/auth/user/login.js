const express = require("express");

const { isValidEmail } = require("../../../utils/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");

const {createVerificationSession, getVerificationSession, deleteVerificationSession,
        incrementLoginFailure, isLoginLocked, shouldRequireRecaptcha, resetLoginFailures } = require("../../../config/redis.js");

const query = require("../../../config/query.js");
const { verifyPassword, generateRandomKey } = require("../../../utils/security.js");
const { verifyRecaptcha } = require('../../../services/recaptcha.js');

const { detectPortalFromSubdomain } = require("../../../utils/portal.js");
const AuthSession = require("../../../utils/authSession.js");
const { DATA_CONSENT_REQUIRED, OUTDATED_CONSENT, getConsentGateError } = require("../../../utils/consent.js");
const logger = require("../../../utils/logger.js");
const router = express.Router();

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

router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
  try {
  const { email, password, recaptchaToken } = req.body;
  let account_type = detectPortalFromSubdomain(req);
  const auditMetadata = getRequestAuditMetadata(req);
  const recordAttempt = async (wasSuccessful, targetEmail = email, userId = null) => {
    try {
      await query.recordLoginAttempt({
        email: targetEmail || null,
        userId,
        wasSuccessful,
        userType: account_type,
        ipAddress: auditMetadata.ipAddress,
        userAgent: auditMetadata.userAgent,
      });
    } catch (auditErr) {
      logger.warn('[LOGIN] Failed to write login attempt audit record', {
        email: targetEmail || null,
        userId: userId || null,
        ipAddress: auditMetadata.ipAddress,
        error: auditErr?.message || 'Unknown audit write error',
      });
    }
  };

  // ✅ Required fields
  if (!email || !password) {
    await recordAttempt(false, email);
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email and password are required."
    });
  }

  account_type = account_type.toLowerCase();

  const loginTtl = await isLoginLocked(email, account_type);
  if (loginTtl > 0) {
    await recordAttempt(false, email);
    return res.status(403).json({
      error: "ACCOUNT_LOCKED",
      message: `Too many failed login attempts. Please try in ${loginTtl} seconds.`
    });
  }

  // ✅ Institutional email → detect role from email
  if (!isValidEmail(email)) {
    await recordAttempt(false, email);
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format."
    });
  }

  // ✅ Adaptive reCAPTCHA — required after threshold of failed attempts
  const captchaRequired = await shouldRequireRecaptcha(email, account_type);
  if (captchaRequired) {
    if (!recaptchaToken) {
      await recordAttempt(false, email);
      return res.status(400).json({
        error: "RECAPTCHA_REQUIRED",
        message: "Please complete the reCAPTCHA check.",
        requiresCaptcha: true,
      });
    }
    const captchaValid = await verifyRecaptcha(recaptchaToken);
    if (!captchaValid) {
      await recordAttempt(false, email);
      return res.status(400).json({
        error: "INVALID_RECAPTCHA",
        message: "reCAPTCHA verification failed. Please try again.",
        requiresCaptcha: true,
      });
    }
  }

  // ✅ Fetch user
  const user = await query.findUserByEmail(email);
  if (!user) {
    const count = await incrementLoginFailure(email, account_type);
    const nextRequiresCaptcha = await shouldRequireRecaptcha(email, account_type);
    await recordAttempt(false, email);
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`,
      requiresCaptcha: nextRequiresCaptcha,
    });
  }

  const lockState = {
    status: user.credentials_status,
  };

  // ✅ Check password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const count = await incrementLoginFailure(email, account_type);
    await recordAttempt(false, email, user.id);
    const nextRequiresCaptcha = await shouldRequireRecaptcha(email, account_type);
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`,
      requiresCaptcha: nextRequiresCaptcha,
    });
  }

  if (account_type === "patient") {
    if (isCredentialTemporarilyLocked(lockState)) {
      await recordAttempt(false, email, user.id);
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: 'This account is locked.',
      });
    }
  }
  // ✅ Check if account type matches portal
  else if (account_type === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(user.id);
    if (!isMedical) {
      const count = await incrementLoginFailure(email, account_type);
      const nextRequiresCaptcha = await shouldRequireRecaptcha(email, account_type);
      const isActive = await query.getMedicalPersonnelStatus(user.id);
      if (isActive === false) {
        await recordAttempt(false, email, user.id);
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account has been suspended.",
        });
      }
      await recordAttempt(false, email, user.id);
      return res.status(400).json({
        error: "INVALID_CREDENTIALS",
        message: `Email or password is incorrect. ${count} failed attempts.`,
        requiresCaptcha: nextRequiresCaptcha,
      });
    }
  }

  // ✅ Create login verification session (always the same purpose)
  const verificationKey = await createVerificationSession(email, VERIFICATIONKEY_PURPOSE, account_type);
  // Stage-1 login audit is recorded as non-success; full success is recorded at /complete.
  await recordAttempt(false, email, user.id);

  // ✅ Email OTP is always required; TOTP is the preferred alternative when enabled
  return res.status(200).json({
    ok: true,
    requires2FA: true,
    requiresTotp: user.totp_enabled || false,
    LoginKey: verificationKey,
    });
  } catch (err) {
    logger.error('[LOGIN] Unhandled error in POST /auth/login:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' });
  }
});



router.post("/complete", portalBasedIpRateLimiter(), async (req, res) => {
  try {
  const { LoginKey: verificationKey } = req.body;
  const portal = detectPortalFromSubdomain(req);
  const auditMetadata = getRequestAuditMetadata(req);
  const recordAttempt = async (wasSuccessful, targetEmail = null, userId = null) => {
    try {
      await query.recordLoginAttempt({
        email: targetEmail,
        userId,
        wasSuccessful,
        userType: portal,
        ipAddress: auditMetadata.ipAddress,
        userAgent: auditMetadata.userAgent,
      });
    } catch (auditErr) {
      logger.warn('[LOGIN_COMPLETE] Failed to write login attempt audit record', {
        email: targetEmail || null,
        userId: userId || null,
        ipAddress: auditMetadata.ipAddress,
        error: auditErr?.message || 'Unknown audit write error',
      });
    }
  };

  if (!verificationKey) {
    await recordAttempt(false, null, null);
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Login key is required."
    });
  }

  const session = await getVerificationSession(verificationKey, VERIFICATIONKEY_PURPOSE);

  if (!session || !session.email || session.user_exists !== "true" || session.user_id === "") {
    await recordAttempt(false, session?.email || null, session?.user_id || null);
    return res.status(400).json({
      error: "INVALID_LOGIN_SESSION",
      message: "Login session is invalid or expired."
    });
  }

  // Email OTP is always required; TOTP is accepted as an alternative.
  // At least one factor (email OTP or TOTP) must be verified.
  const emailVerified = session.email_2fa_verified === "true";
  const totpVerified = session.totp_2fa_verified === "true";
  if (!emailVerified && !totpVerified) {
    await recordAttempt(false, session.email, session.user_id);
    return res.status(400).json({
      error: "2FA_NOT_VERIFIED",
      message: "Two-factor authentication has not been completed."
    });
  }
  const consentError = getConsentGateError(session, process.env.DATA_CONSENT_VERSION);
  if (consentError) {
    await recordAttempt(false, session.email, session.user_id);

    if (consentError === DATA_CONSENT_REQUIRED) {
      return res.status(400).json({
        error: DATA_CONSENT_REQUIRED,
        message: "You must agree to the data consent policy to login.",
      });
    }

    return res.status(400).json({
      error: OUTDATED_CONSENT,
      message: "You must agree to the latest data consent policy.",
    });
  }

  await deleteVerificationSession(verificationKey, VERIFICATIONKEY_PURPOSE);

  const lockState = await query.getCredentialLockStateByUserId(session.user_id);
  if (portal === "patient") {
    if (isCredentialTemporarilyLocked(lockState)) {
      await recordAttempt(false, lockState?.email || session.email, session.user_id);
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: 'This account is locked.',
      });
    }
  }

  // ✅ Staff portal gate: only allow users with IS_STAFF permission to complete staff login
  else if (portal === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(session.user_id);
    if (!isMedical) {
      const isActive = await query.getMedicalPersonnelStatus(session.user_id);
      await recordAttempt(false, session.email, session.user_id);
      if (isActive === false) {
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account is currently suspended. Contact your administrator.",
        });
      }

      return res.status(403).json({
        error: 'STAFF_ACCOUNT_INACTIVE',
        message: 'Your account does not currently have active staff access.',
      });
    } 
  }

  // ✅ Create actual auth session (JWT, cookie, etc.)
  //const authToken = await query.createAuthToken(session.user_id);

  await recordAttempt(true, session.email, session.user_id);
  await resetLoginFailures(session.email, portal);     // clear failure count so next login starts fresh
  const tokens = await AuthSession.create(req, session.user_id);
  return res.status(200).json({
    ok: true,
    ...tokens,
    message: "Login successful.",
  });
  } catch (err) {
    logger.error('[LOGIN] Unhandled error in POST /auth/login/complete:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' });
  }
});

module.exports = router;
