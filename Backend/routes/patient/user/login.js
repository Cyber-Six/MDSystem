const express = require("express");

const { detectRoleFromEmail, validatePassword } = require("../../../config/validator.js");
const { roleBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");

const {
  verifyOTP,
  getOTPFailureCount,
  getOTPLockoutTTL,
  createVerificationSession,
  validateVerificationSession,
  rateLimitEmailCooldown,
  rateLimitEmailAttempts
} = require("../../../config/redis.js");

const { mapRoleToProfile, rateLimitMatrix } = require("../../../config/data/matrix.js");
const { verifyRecaptcha } = require("../../../services/recaptcha.js");
const { enqueueLoginOTP } = require("../../../services/emailservice.js");

const query = require("../../../config/query.js");
const { verifyPassword } = require("../../../config/security.js");
const router = express.Router();

/*
|--------------------------------------------------------------------------
| STEP 1 — PASSWORD LOGIN (NO ENUMERATION)
|--------------------------------------------------------------------------
*/
router.post("/login", roleBasedIpRateLimiter(), async (req, res) => {
  const { email, password, role, recaptchaToken } = req.body;

  // ✅ Required fields
  if (!email || !password || !role || !recaptchaToken) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email, password, role, and reCAPTCHA token are required."
    });
  }

  // ✅ Basic email format
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(email)) {
    return res.status(400).json({
      error: "INVALID_EMAIL_FORMAT",
      message: "Email format is invalid."
    });
  }

  // ✅ Institutional email → detect role from email
  const declaredRole = detectRoleFromEmail(email);
  if (!declaredRole) {
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format."
    });
  }

  // ✅ Role mismatch (anti‑cross‑dashboard)
  if (role !== declaredRole) {
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });
  }

  // ✅ Verify reCAPTCHA
  const recaptchaValid = await verifyRecaptcha(recaptchaToken);
  if (!recaptchaValid) {
    return res.status(400).json({
      error: "INVALID_RECAPTCHA",
      message: "reCAPTCHA verification failed."
    });
  }

  // ✅ Fetch user
  const user = await query.findUserByEmail(email);
  if (!user) {
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });
  }

  // ✅ Password check
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });
  }

  // ✅ If 2FA is enabled → send OTP
  if (user.two_factor_enabled) {
    const profileName = mapRoleToProfile(user.role);
    const profile = rateLimitMatrix[profileName];

    const cooldownActive = await rateLimitEmailCooldown(email, "login2fa", profile.emailCooldown);
    if (cooldownActive) {
      return res.status(429).json({
        error: "EMAIL_COOLDOWN_ACTIVE",
        message: "Too many attempts. Please try again later."
      });
    }

    const attemptsExceeded = await rateLimitEmailAttempts(
      email,
      "login2fa",
      profile.emailMaxAttempts,
      profile.emailCooldown
    );

    if (attemptsExceeded) {
      return res.status(429).json({
        error: "EMAIL_ATTEMPT_LIMIT_REACHED",
        message: "Too many attempts. Please try again later."
      });
    }

    await enqueueLoginOTP(email);

    const pendingKey = await createVerificationSession(email, "login_pending");

    return res.status(200).json({
      ok: true,
      requires2FA: true,
      pendingKey,
      message: "2FA required. OTP sent to your email."
    });
  }

  // ✅ No 2FA → login immediately
  const loginKey = await createVerificationSession(email, "login");

  return res.status(200).json({
    ok: true,
    requires2FA: false,
    loginKey,
    message: "Login successful."
  });
});


/*
|--------------------------------------------------------------------------
| STEP 2 — VERIFY 2FA OTP
|--------------------------------------------------------------------------
*/
router.post("/verify-2fa", roleBasedIpRateLimiter(), async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email and OTP are required."
    });
  }

  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(email)) {
    return res.status(400).json({
      error: "INVALID_EMAIL_FORMAT",
      message: "Email format is invalid."
    });
  }

  const declaredRole = detectRoleFromEmail(email);
  if (!declaredRole) {
    return res.status(400).json({
      error: "INVALID_INSTITUTION_EMAIL",
      message: "Email must follow TIP institutional format."
    });
  }

  // ✅ Verify OTP
  const result = await verifyOTP(email, "login2fa", otp);

  if (result === "LOCKED_OUT") {
    const failures = await getOTPFailureCount(email, "login2fa");
    const ttl = await getOTPLockoutTTL(email, "login2fa");

    return res.status(429).json({
      error: "OTP_LOCKED_OUT",
      message: "Too many invalid attempts. Please try again later.",
      attempts: failures,
      attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT),
      retryAfterSeconds: ttl
    });
  }

  if (result === false) {
    const failures = await getOTPFailureCount(email, "login2fa");

    return res.status(400).json({
      error: "INVALID_OTP",
      message: "The OTP you entered is invalid or expired.",
      attempts: failures,
      attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT)
    });
  }

  // ✅ OTP valid → create login session
  const loginKey = await createVerificationSession(email, "login");

  return res.status(200).json({
    ok: true,
    message: "2FA verified successfully.",
    loginKey
  });
});

/*
|--------------------------------------------------------------------------
| STEP 3 — COMPLETE LOGIN (SESSION CREATION)
|--------------------------------------------------------------------------
*/
router.post("/complete", roleBasedIpRateLimiter(), async (req, res) => {
  const { loginKey } = req.body;

  if (!loginKey) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Login key is required."
    });
  }

  const session = await validateVerificationSession(loginKey, "login");

  if (!session || !session.email) {
    return res.status(400).json({
      error: "INVALID_LOGIN_SESSION",
      message: "Login session is invalid or expired."
    });
  }

  // ✅ Fetch user (safe now — ownership proven)
  const user = await query.findUserByEmail(session.email);

  if (!user) {
    return res.status(400).json({
      error: "INVALID_LOGIN_SESSION",
      message: "User no longer exists."
    });
  }

  // ✅ Create actual auth session (JWT, cookie, etc.)
  const authToken = await query.createAuthToken(user.id);

  return res.status(200).json({
    ok: true,
    message: "Login successful.",
    token: authToken
  });
});

module.exports = router;
