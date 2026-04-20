const express = require('express');

const { isValidEmail } = require('../../../utils/validator.js');
const { portalBasedIpRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { verifyOTP, getOTPFailureCount, getOTPLockoutTTL,
        createVerificationSession,
        rateLimitEmailCooldown, rateLimitEmailAttempts, 
        deleteEmailCooldown, deleteEmailAttempts,
        update2FAInSession} = require('../../../config/redis.js');
const { rateLimitMatrix } = require('../../../config/data/matrix.js');
const { verifyRecaptcha } = require('../../../services/recaptcha.js');

const { enqueueEmailVerification, enqueueEmail2FA } = require('../../../services/emailservice.js');
const { detectPortalFromSubdomain } = require('../../../utils/portal.js');

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const recaptchaTestMode = process.env.RECAPTCHA_TEST_MODE === 'true';

const router = express.Router();

function isValidOtpPurpose(purpose) {
  return ["verification", "2fa"].includes(purpose);
  }

router.post("/:purpose", portalBasedIpRateLimiter(), async (req, res) => {
    const { email, recaptchaToken } = req.body;
    const purpose = req.params.purpose.toLowerCase();
    
    // ✅ Validate purpose
    if (!isValidOtpPurpose(purpose)) {
        return res.status(400).json({
        error: "INVALID_PERFORM_ACTION",
        message: "Purpose must be either 'verification' or '2fa'."
        });
    }

    // ✅ Required fields
    if (!email) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email is required."
      });
    }

    // For the login 2FA flow, reCAPTCHA was already verified at the login endpoint
    if (purpose !== '2fa' && !recaptchaToken && !recaptchaTestMode) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email and reCAPTCHA token are required."
      });
    }


    // ✅ Institutional email validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
      });
    }

    // ✅ Verify reCAPTCHA (not required for login 2FA, and skipped in test mode)
    if (purpose !== '2fa' && !recaptchaTestMode) {
      const recaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaValid) {
        return res.status(400).json({
          error: "INVALID_RECAPTCHA",
          message: "reCAPTCHA verification failed."
        });
      }
    }

    //add bearing for staff dashboard
    const portal = detectPortalFromSubdomain(req).toLowerCase();

    const profileName = portal.toLowerCase() === "patient" ? "PatientAuthentication" : "staffAuthentication";
    const profile = rateLimitMatrix[profileName];

    const emailCooldown = purpose === "2fa" ? profile.emailCooldown_2fa : profile.emailCooldown_emailv;
    const emailMaxAttempts = purpose === "2fa" ? profile.emailAttemptMax_2fa : profile.emailAttemptMax_emailv;
    const penaltyCooldown = profile.penaltyCooldown_resetpw;

    // ✅ Cooldown check (write)
    const cooldownActive = await rateLimitEmailCooldown(email, portal, purpose, emailCooldown);
    if (cooldownActive) {
      return res.status(429).json({
        error: "EMAIL_COOLDOWN_ACTIVE",
        message: "Too many attempts. Please try again later."
      });
    }

    // ✅ Attempt increment (write)
    const attemptsExceeded = await rateLimitEmailAttempts(
      email,
      portal,
      purpose,
      emailMaxAttempts,
      penaltyCooldown
    );

    if (attemptsExceeded) {
      return res.status(429).json({
        error: "EMAIL_ATTEMPT_LIMIT_REACHED",
        message: "Too many attempts. Please try again later."
      });
    }
    
    if (purpose === "verification") await enqueueEmailVerification(email);
    else if (purpose === "2fa") await enqueueEmail2FA(email, portal); 
        

    return res.status(200).json({
      ok: true,
      message: "OTP sent to your email."
    });
  }
);

router.post('/:purpose/verify', portalBasedIpRateLimiter(), async (req, res) => {
    const { email, otp, verificationKey } = req.body;
    const purpose = req.params.purpose.toLowerCase();

    // ✅ Validate perform
    if (!isValidOtpPurpose(purpose)) {
        return res.status(400).json({
        error: "INVALID_PERFORM_ACTION",
        message: "Purpose must be either 'verification' or '2fa'."
        });
    }

    if (!email || !otp) {
        return res.status(400).json({
            error: "MISSING_FIELDS",
            message: "Email and OTP are required."
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            error: "INVALID_INSTITUTION_EMAIL",
            message: "Email must follow TIP institutional format."
        });
    }

    if (purpose !== "verification" && !verificationKey) {
        return res.status(400).json({
            error: "MISSING_VERIFICATION_KEY",
            message: "Verification key is required for 2FA verification."
        });
    }

    const code = purpose === "verification" ? "emailVerification" : "email2FA";
    const portal = detectPortalFromSubdomain(req).toLowerCase();

    // ✅ Verify OTP using Redis (with lockout protection)
    const result = await verifyOTP(email, code, otp, portal);

    // ✅ If locked out, return TTL + failure count
    if (result === "LOCKED_OUT") {
        const failures = await getOTPFailureCount(email, code);
        const ttl = await getOTPLockoutTTL(email, code);

        return res.status(429).json({
            error: "OTP_LOCKED_OUT",
            message: `Too many invalid attempts. Please try again in ${ttl} seconds.`,
            attempts: failures,
            attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT),
            retryAfterSeconds: ttl
        });
    }

    // ✅ Wrong OTP (but not locked out)
    if (result === false) {
        const failures = await getOTPFailureCount(email, code);

        return res.status(400).json({
            error: "INVALID_OTP",
            message: "The OTP you entered is invalid or expired.",
            attempts: failures,
            attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT)
        });
    }

    // ✅ OTP is valid → create a short-lived verification session

    await deleteEmailCooldown(email, portal, purpose);
    await deleteEmailAttempts(email, portal, purpose);

    let finalVerificationKey;
    if (purpose === "verification"){
      const account_type = portal;
      finalVerificationKey = await createVerificationSession(email, purpose, account_type);
      }
    else if (purpose === "2fa"){
      await update2FAInSession(verificationKey, email, purpose);
      finalVerificationKey = verificationKey;
    }

    return res.status(200).json({
        ok: true,
        message: "Email verified successfully.",
        verificationKey: finalVerificationKey
    });
});


module.exports = router;
