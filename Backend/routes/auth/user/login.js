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
const logger = require("../../../utils/logger.js");
const router = express.Router();

const VERIFICATIONKEY_PURPOSE = "2fa";

router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
  try {
  const { email, password, recaptchaToken } = req.body;
  const account_type = detectPortalFromSubdomain(req);

  // ✅ Required fields
  if (!email || !password) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email and password are required."
    });
  }

  const loginTtl = await isLoginLocked(email, account_type);
  if (loginTtl > 0) {
    return res.status(403).json({
      error: "ACCOUNT_LOCKED",
      message: `Too many failed login attempts. Please try in ${loginTtl} seconds.`
    });
  }

  // ✅ Institutional email → detect role from email
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format."
    });
  }

  // ✅ Adaptive reCAPTCHA — required after threshold of failed attempts
  const captchaRequired = await shouldRequireRecaptcha(email, account_type);
  if (captchaRequired) {
    if (!recaptchaToken) {
      return res.status(400).json({
        error: "RECAPTCHA_REQUIRED",
        message: "Please complete the reCAPTCHA check.",
        requiresCaptcha: true,
      });
    }
    const captchaValid = await verifyRecaptcha(recaptchaToken);
    if (!captchaValid) {
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
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`,
      requiresCaptcha: nextRequiresCaptcha,
    });
  }

  // ✅ Check password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const count = await incrementLoginFailure(email, account_type);
    await query.recordLoginAttempt(email, false);
    const nextRequiresCaptcha = await shouldRequireRecaptcha(email, account_type);
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`,
      requiresCaptcha: nextRequiresCaptcha,
    });
  }

  // ✅ Check if account type matches portal
  if (account_type === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(user.id);
    if (!isMedical) {
      const count = await incrementLoginFailure(email, account_type);
      const nextRequiresCaptcha = await shouldRequireRecaptcha(email, account_type);
      const isActive = await query.getMedicalPersonnelStatus(user.id);
      if (isActive === false) {
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account has been suspended.",
        });
      }
      return res.status(400).json({
        error: "INVALID_CREDENTIALS",
        message: `Email or password is incorrect. ${count} failed attempts.`,
        requiresCaptcha: nextRequiresCaptcha,
      });
    }
  }

  // ✅ Create login verification session (always the same purpose)
  const verificationKey = await createVerificationSession(email, VERIFICATIONKEY_PURPOSE, account_type);

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

  if (!verificationKey) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Login key is required."
    });
  }

  const session = await getVerificationSession(verificationKey, VERIFICATIONKEY_PURPOSE);

  if (!session || !session.email || session.user_exists !== "true" || session.user_id === "") {
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
    return res.status(400).json({
      error: "2FA_NOT_VERIFIED",
      message: "Two-factor authentication has not been completed."
    });
  }


  if (session.data_consent !== "true") {
      return res.status(400).json({
          error: "DATA_CONSENT_REQUIRED",
          message: "You must agree to the data consent policy to login."
      });
  }

  if (session.data_consent_version !== process.env.DATA_CONSENT_VERSION) {
      return res.status(400).json({
          error: "OUTDATED_CONSENT",
          message: "You must agree to the latest data consent policy."
      });
  }

  await deleteVerificationSession(verificationKey, VERIFICATIONKEY_PURPOSE);

  // ✅ Staff portal gate: only allow users with IS_STAFF permission to complete staff login
  const portal = detectPortalFromSubdomain(req);
  if (portal === "medical") {
    const credentialsStatus = await query.getUserCredentialStatus(session.user_id);
    switch (credentialsStatus) {
      case "Unverified":
        return res.status(403).json({
          error: "STAFF_ACCOUNT_NOT_VERIFIED",
          message: "Please ask your admin to verify your account first.",
        });
      case "Locked":
        return res.status(403).json({
          error: "STAFF_ACCOUNT_LOCKED",
          message: "Your staff account is currently locked. Contact your administrator.",
        });
      case "Inactive":
        return res.status(403).json({
          error: "STAFF_ACCOUNT_INACTIVE",
          message: "Your account does not yet have staff access. Ask your administrator to activate your account.",
        });
      case "Active":
        break; // continue with login
      default:
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account is currently suspended. Contact your administrator.",
        });
    } 
  }

  // ✅ Create actual auth session (JWT, cookie, etc.)
  //const authToken = await query.createAuthToken(session.user_id);

  await query.recordLoginAttempt(session.email, true); // record successful login
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
