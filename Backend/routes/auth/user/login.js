const express = require("express");

const { isValidEmail } = require("../../../utils/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");

const {createVerificationSession, getVerificationSession, deleteVerificationSession } = require("../../../config/redis.js");

const { verifyRecaptcha } = require("../../../services/recaptcha.js");

const query = require("../../../config/query.js");
const { verifyPassword, generateRandomKey } = require("../../../utils/security.js");

const { detectPortalFromSubdomain } = require("../../../utils/portal.js");
const { findMedicalPermit, permissions: medicalPermissions } = require("../../../services/permit.js");
const AuthSession = require("../../../utils/authSession.js");
const router = express.Router();

const VERIFICATIONKEY_PURPOSE = "2fa";

router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  // ✅ Required fields
  if (!email || !password || !recaptchaToken) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email, password, and reCAPTCHA token are required."
    });
  }

  // ✅ Institutional email → detect role from email
  if (!isValidEmail(email)) {
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
    await query.recordLoginAttempt(email, false); // record failed attempt
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });
  }

  // ✅ Create login verification session (always the same purpose)
  const account_type = detectPortalFromSubdomain(req);
  const verificationKey = await createVerificationSession(email, VERIFICATIONKEY_PURPOSE, account_type);

  // ✅ If 2FA is disabled → mark validated inside Redis and return
  return res.status(200).json({
    ok: true,
    requires2FA: user.allow_email_2fa,
    LoginKey: verificationKey,
    });
  });



router.post("/complete", portalBasedIpRateLimiter(), async (req, res) => {
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

  deleteVerificationSession(verificationKey, VERIFICATIONKEY_PURPOSE);

  // ✅ Staff portal gate: only allow users with IS_STAFF permission to complete staff login
  const portal = detectPortalFromSubdomain(req);
  if (portal === "medical") {
    const identity = await query.getUserIdentity(session.user_id);
    if (identity !== "Medical") {
      const hasStaffRole = await findMedicalPermit(session.user_id, medicalPermissions.is_staff);
      if (hasStaffRole) {
        return res.status(403).json({
          error: "STAFF_ACCOUNT_SUSPENDED",
          message: "Your staff account is currently suspended. Contact your administrator.",
        });
      }
      return res.status(403).json({
        error: "STAFF_ACCOUNT_PENDING",
        message: "Your account does not yet have staff access. Ask your administrator to activate your account.",
      });
    }
  }

  // ✅ Create actual auth session (JWT, cookie, etc.)
  //const authToken = await query.createAuthToken(session.user_id);

  await query.recordLoginAttempt(session.email, true); // record successful login
  const tokens = await AuthSession.create(req, session.user_id);
  return res.status(200).json({
    ok: true,
    ...tokens,
    message: "Login successful.",
  });
});

module.exports = router;
