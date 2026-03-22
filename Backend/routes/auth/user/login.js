const express = require("express");

const { isValidEmail } = require("../../../utils/validator.js");
const { portalBasedIpRateLimiter } = require("../../../config/middleware/ratelimiter.js");

const {createVerificationSession, getVerificationSession, deleteVerificationSession,
        incrementLoginFailure, isLoginLocked } = require("../../../config/redis.js");

const { verifyRecaptcha } = require("../../../services/recaptcha.js");

const query = require("../../../config/query.js");
const { verifyPassword, generateRandomKey } = require("../../../utils/security.js");

const { detectPortalFromSubdomain } = require("../../../utils/portal.js");
const AuthSession = require("../../../utils/authSession.js");
const router = express.Router();

const VERIFICATIONKEY_PURPOSE = "2fa";

router.post("/", portalBasedIpRateLimiter(), async (req, res) => {
  const { email, password, recaptchaToken } = req.body;
  const account_type = detectPortalFromSubdomain(req);

  // ✅ Required fields
  if (!email || !password || !recaptchaToken) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "Email, password, and reCAPTCHA token are required."
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
    const count = await incrementLoginFailure(email, account_type);
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`
    });
  }

  // ✅ Check if account type matches portal
  if (account_type === "medical") {
    const isMedical = await query.isActiveMedicalPersonnel(user.id);
    if (!isMedical) {
      const count = await incrementLoginFailure(email, account_type);
      return res.status(400).json({
        error: "INVALID_CREDENTIALS",
        message: `Email or password is incorrect. ${count} failed attempts.`
      });
      }
  }

  // ✅ Check password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const count = await incrementLoginFailure(email, account_type);
    await query.recordLoginAttempt(email, false); // record failed attempt
    return res.status(400).json({
      error: "INVALID_CREDENTIALS",
      message: `Email or password is incorrect. ${count} failed attempts.`
    });
  }

  // ✅ Create login verification session (always the same purpose)
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
  const tokens = await AuthSession.create(req, session.user_id);
  return res.status(200).json({
    ok: true,
    ...tokens,
    message: "Login successful.",
  });
});

module.exports = router;
