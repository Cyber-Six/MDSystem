const express = require('express');

const { detectRoleFromEmail, isValidEmail, validatePassword, isStudentEmail } = require('../../../config/validator.js');
const { portalBasedIpRateLimiter, ipRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { getVerificationSession, deleteVerificationSession } = require('../../../config/redis.js');
const query = require('../../../config/query.js');
const AuthSession = require("../../utils/authSession.js");

const router = express.Router();


router.post('/', (req, res) => {
    const { email, password } = req.body;

    // ✅ 1. Required fields
    if (!email || !password ) {
        return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email, password are required."
        });
    }

    // ✅ 2. Institutional email + role detection
    if (!isValidEmail(email)) {
        return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
        });
    }

    // ✅ 3. Password validation
    if (!validatePassword(password)) {
    return res.status(400).json({
        error: "INVALID_PASSWORD",
        message: "Password must be between 8 and 64 characters."
    });
    }


    // ✅ SUCCESS — no DB checks, no reCAPTCHA, no enumeration
    return res.status(200).json({
        ok: true,
    });
});

router.post('/complete', ipRateLimiter("PatientAuthentication", "register"), async (req, res) => {
    const { verificationKey, email, password } = req.body;

    // ✅ 1. Required fields
    if (!verificationKey || !email || !password) {
        return res.status(400).json({
            error: "MISSING_FIELDS",
            message: "VerificationKey, email, password are required."
        });
    }

    // ✅ 2. Institutional email + role detection
    if (!isValidEmail(email)) {
        return res.status(400).json({
            error: "INVALID_INSTITUTION_EMAIL",
            message: "Email must follow TIP institutional format."
        });
    }

    // ✅ 3. Password validation
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: "INVALID_PASSWORD",
            message: "Password must be between 8 and 64 characters."
        });
    }
    const purpose = "verification";
    // ✅ 4. Validate verification session (anti-bypass)
    const session = await getVerificationSession(verificationKey, purpose);

    if (!session || session.email !== email) {
        return res.status(400).json({
            error: "INVALID_VERIFICATION_SESSION",
            message: "Email verification session is invalid or expired."
        });
    }

    // ✅ 5. Check consent from Redis (NOT from client)
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

    // ✅ 6. Check if user exists (safe now — ownership proven)
    const existing = await query.findUserByEmail(email);

    if (existing) {
        return res.status(200).json({
            ok: true,
            message: "Account already exists. You may now log in."
        });
    }

    // ✅ 7. Create user (ownership + consent proven)
    const user = await query.createUser({
        email,
        password, // hashing inside service layer
        role: isStudentEmail(email) ? "Student" : "Employee",
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
