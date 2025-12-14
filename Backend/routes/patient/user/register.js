const express = require('express');

const { detectRoleFromEmail, validatePassword } = require('../../../config/validator.js');
const { portalBasedIpRateLimiter, ipRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { getVerificationSession, deleteVerificationSession } = require('../../../config/redis.js');
const { verifyRecaptcha } = require('../../../services/recaptcha.js');
const query = require('../../../config/query.js');
const AuthSession = require("../../utils/authSession.js");

const router = express.Router();


router.post('/', (req, res) => {
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

router.post('/complete', ipRateLimiter("PatientAuthentication", "register"), async (req, res) => {
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
    const purpose = "verification";
    // ✅ 5. Validate verification session (anti-bypass)
    const session = await getVerificationSession(verificationKey, purpose);

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

    await deleteVerificationSession(verificationKey, purpose);

    // ✅ 7. Check if user exists (safe now — ownership proven)
    const existing = await query.findUserByEmail(email);

    if (existing) {
        return res.status(200).json({
            ok: true,
            message: "Account already exists. You may now log in."
        });
    }

    // ✅ 8. Create user (ownership + consent proven)
    const user = await query.createUser({
        email,
        password, // hashing inside service layer
        role: declaredRole,
        data_consent_version: process.env.DATA_CONSENT_VERSION,
    });

    const tokens = await AuthSession.create(req, user.id);

    return res.status(201).json({
        ok: true,
        ...tokens,
        message: "Account created successfully."
    });
});


module.exports = router;
