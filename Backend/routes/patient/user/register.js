const express = require('express');

const { detectRoleFromEmail, validatePassword } = require('../../../config/validator.js');
const { roleBasedIpRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { verifyOTP, getOTPFailureCount, getOTPLockoutTTL,
        createVerificationSession, validateVerificationSession,
        rateLimitEmailCooldown, rateLimitEmailAttempts } = require('../../../config/redis.js');
const { mapRoleToProfile, rateLimitMatrix } = require('../../../config/data/matrix.js');
const { verifyRecaptcha } = require('../../../services/recaptcha.js');
const query = require('../../../config/query.js');

const { enqueueEmailVerification } = require('../../../services/emailservice.js');

const router = express.Router();


router.post('/validate', (req, res) => {
    const { email, password, role } = req.body;

    // ✅ 1. Required fields
    if (!email || !password || !role) {
        return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email, password and role are required."
        });
    }

    // ✅ 2. Basic email format check (anti-garbage)
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email)) {
        return res.status(400).json({
        error: "INVALID_EMAIL_FORMAT",
        message: "Email format is invalid."
        });
    }

    // ✅ 3. Institutional email + role detection
    const declaredRole = detectRoleFromEmail(email);

    if (!declaredRole) {
        return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
        });
    }

    // ✅ 4. Role mismatch check
    if (role !== declaredRole) {
        return res.status(403).json({
            error: "ROLE_MISMATCH",
            message: "You are trying to access the wrong dashboard."
        });
    }

    // ✅ 5. Password validation
    if (!validatePassword(password)) {
    return res.status(400).json({
        error: "INVALID_PASSWORD",
        message: "Password must be between 8 and 64 characters."
    });
    }


    // ✅ SUCCESS — no DB checks, no reCAPTCHA, no enumeration
    return res.status(200).json({
        ok: true,
        declaredRole
    });
});

router.post("/email-verification", roleBasedIpRateLimiter(), async (req, res) => {
    const { email, recaptchaToken } = req.body;

    // ✅ Required fields
    if (!email || !recaptchaToken) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email and reCAPTCHA token are required."
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

    // ✅ Institutional email validation
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

    // ✅ Rate limit profile
    const profileName = mapRoleToProfile(declaredRole);
    const profile = rateLimitMatrix[profileName];

    // ✅ Cooldown check (write)
    const cooldownActive = await rateLimitEmailCooldown(email, "rev", profile.emailCooldown);
    if (cooldownActive) {
      return res.status(429).json({
        error: "EMAIL_COOLDOWN_ACTIVE",
        message: "Too many attempts. Please try again later."
      });
    }

    // ✅ Attempt increment (write)
    const attemptsExceeded = await rateLimitEmailAttempts(
      email,
      "rev",
      profile.emailMaxAttempts,
      profile.emailCooldown
    );

    if (attemptsExceeded) {
      return res.status(429).json({
        error: "EMAIL_ATTEMPT_LIMIT_REACHED",
        message: "Too many attempts. Please try again later."
      });
    }

    /*
    // ✅ Check if user exists
    const existing = await query.countUserByEmail(email);

    if (!existing) {
      await enqueueEmailVerification(email);
    }
    */
    
    await enqueueEmailVerification(email);
    
    return res.status(200).json({
      ok: true,
      message: "OTP sent to your email."
    });
  }
);


router.post('/email-verification/verify', roleBasedIpRateLimiter(), async (req, res) => {
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

    // ✅ Verify OTP using Redis (with lockout protection)
    const result = await verifyOTP(email, "emailVerification", otp);

    // ✅ If locked out, return TTL + failure count
    if (result === "LOCKED_OUT") {
        const failures = await getOTPFailureCount(email, "emailVerification");
        const ttl = await getOTPLockoutTTL(email, "emailVerification");

        return res.status(429).json({
            error: "OTP_LOCKED_OUT",
            message: "Too many invalid attempts. Please try again later.",
            attempts: failures,
            attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT),
            retryAfterSeconds: ttl
        });
    }

    // ✅ Wrong OTP (but not locked out)
    if (result === false) {
        const failures = await getOTPFailureCount(email, "emailVerification");

        return res.status(400).json({
            error: "INVALID_OTP",
            message: "The OTP you entered is invalid or expired.",
            attempts: failures,
            attemptLimit: Number(process.env.OTP_GLOBAL_ATTEMPT_LIMIT)
        });
    }

    // ✅ OTP is valid → create a short-lived verification session
    const verificationKey = await createVerificationSession(email, "emailVerification");

    return res.status(200).json({
        ok: true,
        message: "Email verified successfully.",
        verificationKey
    });
});

router.post('/complete', roleBasedIpRateLimiter(), async (req, res) => {
    const { verificationKey, email, password, role } = req.body;

    // ✅ 1. Required fields
    if (!verificationKey || !email || !password || !role) {
        return res.status(400).json({
            error: "MISSING_FIELDS",
            message: "Verification key, email, password, and role are required."
        });
    }

    // ✅ 2. Basic email format
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email)) {
        return res.status(400).json({
            error: "INVALID_EMAIL_FORMAT",
            message: "Email format is invalid."
        });
    }

    // ✅ 3. Institutional email + role detection
    const declaredRole = detectRoleFromEmail(email);
    if (!declaredRole) {
        return res.status(400).json({
            error: "INVALID_INSTITUTION_EMAIL",
            message: "Email must follow TIP institutional format."
        });
    }

    if (role !== declaredRole) {
        return res.status(403).json({
            error: "ROLE_MISMATCH",
            message: "You are trying to access the wrong dashboard."
        });
    }

    // ✅ 4. Password validation
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: "INVALID_PASSWORD",
            message: "Password must be between 8 and 64 characters."
        });
    }

    // ✅ 5. Validate verification session (anti-bypass)
    const session = await validateVerificationSession(verificationKey, "emailVerification");

    if (!session || session.email !== email) {
        return res.status(400).json({
            error: "INVALID_VERIFICATION_SESSION",
            message: "Email verification session is invalid or expired."
        });
    }

    // ✅ 6. Check consent from Redis (NOT from client)
    if (session.data_consent !== "true") {
        return res.status(400).json({
            error: "DATA_CONSENT_REQUIRED",
            message: "You must agree to the data consent policy to register."
        });
    }

    if (session.data_consent_version !== process.env.DATA_CONSENT_VERSION) {
        return res.status(400).json({
            error: "OUTDATED_CONSENT",
            message: "You must agree to the latest data consent policy."
        });
    }

    // ✅ 7. Check if user exists (safe now — ownership proven)
    const existing = await query.findUserByEmail(email);

    if (existing) {
        return res.status(200).json({
            ok: true,
            message: "Account already exists. You may now log in."
        });
    }

    // ✅ 8. Create user (ownership + consent proven)
    await query.createUser({
        email,
        password, // hashing inside service layer
        role: declaredRole,
        data_consent_version: process.env.DATA_CONSENT_VERSION,
    });

    return res.status(201).json({
        ok: true,
        message: "Account created successfully."
    });
});


module.exports = router;
