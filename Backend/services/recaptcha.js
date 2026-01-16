const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const logger = require('../utils/logger.js');

async function verifyRecaptcha(token) {
    try {
        const secret = process.env.RECAPTCHA_SECRET_KEY;

        // `node-fetch` is an ES module in recent versions. Dynamically import it
        // so this CommonJS file can use it without ERR_REQUIRE_ESM.
        const { default: fetch } = await import('node-fetch');

        if (!secret) {
            logger.error("Missing RECAPTCHA_SECRET_KEY in environment");
            return false;
        }

        const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${secret}&response=${token}`
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

