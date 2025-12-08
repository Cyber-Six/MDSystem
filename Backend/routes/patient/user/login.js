const express = require("express");

const { detectRoleFromEmail } = require("../../../config/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");

const {createVerificationSession, getVerificationSession, deleteVerificationSession } = require("../../../config/redis.js");

const { verifyRecaptcha } = require("../../../services/recaptcha.js");

const query = require("../../../config/query.js");
const { verifyPassword, generateRandomKey } = require("../../../config/security.js");

const { detectPortalFromSubdomain } = require("../../utils/portal.js");
const AuthSession = require("../../utils/authSession.js");
const router = express.Router();


router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
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

  // ✅ Create login verification session (always the same purpose)
  const account_type = detectPortalFromSubdomain(req);
  const verificationKey = await createVerificationSession(email, "login", account_type);

  // ✅ If 2FA is disabled → mark validated inside Redis and return
  return res.status(200).json({
    ok: true,
    requires2FA: user.allow_email_2fa,
    verificationKey,
    });
  });



router.post("/complete", portalBasedIpRateLimiter(), async (req, res) => {
  const { verificationKey } = req.body;

  if (!verificationKey) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Login key is required."
    });
  }

  const session = await getVerificationSession(verificationKey, "login");

  if (!session || !session.email || session.user_exists !== "true" || session.user_id === "") {
    return res.status(400).json({
      error: "INVALID_LOGIN_SESSION",
      message: "Login session is invalid or expired."
    });
  }

  if (session.allow_email_2fa === "true" && session.email_2fa_verified !== "true") {
    return res.status(400).json({
      error: "2FA_NOT_VERIFIED",
      message: "Email 2FA has not been verified."
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

  deleteVerificationSession(verificationKey, "login");
  // ✅ Create actual auth session (JWT, cookie, etc.)
  //const authToken = await query.createAuthToken(session.user_id);

  const tokens = await AuthSession.create(req, session.user_id);
  return res.status(200).json({
    ok: true,
    ...tokens,
    message: "Login successful.",
  });
});

module.exports = router;
