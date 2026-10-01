const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const logger = require('../../utils/logger.js');

// Mobile native apps cannot render reCAPTCHA v2 checkbox widgets.
// They send a hashed shared secret instead. The backend validates this
// secret server-side rather than forwarding to Google's siteverify API.
const MOBILE_APP_SECRET = process.env.RECAPTCHA_MOBILE_SECRET;

function timingSafeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

async function verifyRecaptcha(token) {
    try {
        // ── Mobile native app bypass ──────────────────────────────────────────
        // Mobile clients (iOS/Android) cannot complete a reCAPTCHA v2 checkbox.
        // They present a server-side shared secret. Validate it here.
        if (MOBILE_APP_SECRET && timingSafeCompare(token, MOBILE_APP_SECRET)) {
            return true;
        }

        const secret = process.env.RECAPTCHA_SECRET_KEY;

        if (!secret) {
            logger.error("Missing RECAPTCHA_SECRET_KEY in environment");
            return false;
        }

        // The backend pins node-fetch 2.x, which is CommonJS-compatible and
        // keeps this service usable under Jest and the production Node runner.
        const fetchModule = require('node-fetch');
        const fetch = fetchModule.default || fetchModule;

        const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${secret}&response=${encodeURIComponent(token)}`
        });

        const data = await response.json();

        return data.success === true;
    } catch (err) {
        logger.error("reCAPTCHA verification error:", err);
        return false;
    }
}

async function verifyRecaptcha_demo(token) {
    // ✅ TEST MODE — always return true
    // This lets you develop without needing a real Google key.
    logger.warn("⚠️  reCAPTCHA TEST MODE: always returning true");
    return true;
    }

module.exports = {
    verifyRecaptcha: process.env.RECAPTCHA_TEST_MODE === "true"
        ? verifyRecaptcha_demo
        : verifyRecaptcha
    };

