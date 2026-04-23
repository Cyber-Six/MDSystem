const express = require('express');

const { isValidEmail, validatePassword, PatientRoleFromEmail } = require('../../../utils/validator.js');
const { portalBasedIpRateLimiter, ipRateLimiter } = require('../../../config/middleware/ratelimiter.js');
const { getVerificationSession, deleteVerificationSession } = require('../../../config/redis.js');
const query = require('../../../config/query.js');
const AuthSession = require("../../../utils/authSession.js");
const { DATA_CONSENT_REQUIRED, OUTDATED_CONSENT, getConsentGateError } = require('../../../utils/consent.js');
const logger = require('../../../utils/logger.js');

const router = express.Router();

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

router.post('/', async (req, res) => {
    const { email, password } = req.body;
    const auditMetadata = getRequestAuditMetadata(req);
    const recordAttempt = async (wasSuccessful, targetEmail = email, userId = null) => {
        try {
            await query.recordLoginAttempt({
                email: targetEmail || null,
                userId,
                wasSuccessful,
                ipAddress: auditMetadata.ipAddress,
                userAgent: auditMetadata.userAgent,
            });
        } catch (auditErr) {
            logger.warn('[REGISTER] Failed to write registration audit record', {
                email: targetEmail || null,
                userId: userId || null,
                ipAddress: auditMetadata.ipAddress,
                error: auditErr?.message || 'Unknown audit write error',
            });
        }
    };

    // ✅ 1. Required fields
    if (!email || !password ) {
        await recordAttempt(false, email);
        return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email, password are required."
        });
    }

    // ✅ 2. Institutional email + role detection
    if (!isValidEmail(email)) {
        await recordAttempt(false, email);
        return res.status(400).json({
        error: "INVALID_INSTITUTION_EMAIL",
        message: "Email must follow TIP institutional format."
        });
    }

    // ✅ 3. Password validation
    if (!validatePassword(password)) {
    await recordAttempt(false, email);
    return res.status(400).json({
        error: "INVALID_PASSWORD",
        message: "Password must be between 8 and 64 characters."
    });
    }

    // ✅ 4. Check if user already exists
    const existingCount = await query.countUserByEmail(email);
    if (existingCount > 0) {
        const existing = await query.findUserByEmail(email);
        await recordAttempt(false, email, existing?.id || null);
        return res.status(200).json({
            ok: true,
            userExists: true,
            message: "Account already exists. You may now log in."
        });
    }

    // ✅ SUCCESS
    // Pre-check endpoint audit is non-successful; final success is recorded at /complete.
    await recordAttempt(false, email);
    return res.status(200).json({
        ok: true,
    });
});

router.post('/complete', ipRateLimiter("PatientAuthentication", "register"), async (req, res) => {
    const { verificationKey, email, password } = req.body;
    const auditMetadata = getRequestAuditMetadata(req);
    const recordAttempt = async (wasSuccessful, targetEmail = email, userId = null) => {
        try {
            await query.recordLoginAttempt({
                email: targetEmail || null,
                userId,
                wasSuccessful,
                ipAddress: auditMetadata.ipAddress,
                userAgent: auditMetadata.userAgent,
            });
        } catch (auditErr) {
            logger.warn('[REGISTER_COMPLETE] Failed to write registration audit record', {
                email: targetEmail || null,
                userId: userId || null,
                ipAddress: auditMetadata.ipAddress,
                error: auditErr?.message || 'Unknown audit write error',
            });
        }
    };

    // ✅ 1. Required fields
    if (!verificationKey || !email || !password) {
        await recordAttempt(false, email);
        return res.status(400).json({
            error: "MISSING_FIELDS",
            message: "VerificationKey, email, password are required."
        });
    }

    // ✅ 2. Institutional email + role detection
    if (!isValidEmail(email)) {
        await recordAttempt(false, email);
        return res.status(400).json({
            error: "INVALID_INSTITUTION_EMAIL",
            message: "Email must follow TIP institutional format."
        });
    }

    // ✅ 3. Password validation
    if (!validatePassword(password)) {
        await recordAttempt(false, email);
        return res.status(400).json({
            error: "INVALID_PASSWORD",
            message: "Password must be between 8 and 64 characters."
        });
    }
    const purpose = "verification";
    // ✅ 4. Validate verification session (anti-bypass)
    const session = await getVerificationSession(verificationKey, purpose);

    if (!session || session.email !== email) {
        await recordAttempt(false, email);
        return res.status(400).json({
            error: "INVALID_VERIFICATION_SESSION",
            message: "Email verification session is invalid or expired."
        });
    }

    // ✅ 5. Check consent from Redis (NOT from client)
    const consentError = getConsentGateError(session, process.env.DATA_CONSENT_VERSION);
    if (consentError === DATA_CONSENT_REQUIRED) {
        await recordAttempt(false, email, session?.user_id || null);
        return res.status(400).json({
            error: DATA_CONSENT_REQUIRED,
            message: "You must agree to the data consent policy to register."
        });
    }

    if (consentError === OUTDATED_CONSENT) {
        await recordAttempt(false, email, session?.user_id || null);
        return res.status(400).json({
            error: OUTDATED_CONSENT,
            message: "You must agree to the latest data consent policy."
        });
    }

    await deleteVerificationSession(verificationKey, purpose);

    // ✅ 6. Check if user exists (safe now — ownership proven)
    const existing = await query.findUserByEmail(email);

    if (existing) {
        await recordAttempt(false, email, existing.id);
        return res.status(200).json({
            ok: true,
            message: "Account already exists. You may now log in."
        });
    }

    // ✅ 7. Create user (ownership + consent proven)
    const user = await query.createUser({
        email,
        password, // hashing inside service layer
        role: PatientRoleFromEmail(email),
        data_consent_version: process.env.DATA_CONSENT_VERSION,
    });

    const createPatient = await query.createPatient({
        id: user.id,
        email: email,
    });
    const tokens = await AuthSession.create(req, user.id);
    await recordAttempt(true, email, user.id);
    return res.status(201).json({
        ok: true,
        ...tokens,
        message: "Account created successfully."
    });
});


module.exports = router;
