const express = require("express");
const router = express.Router();

const { getVerificationSession, updateConsentInSession, enrichVerificationSession } = require('../../../config/redis.js');

// ✅ Load T&C consent state
router.get("/", async (req, res) => {
  const { verificationKey } = req.query;

  if (!verificationKey) {
    return res.status(400).json({
      error: "MISSING_VERIFICATION_KEY",
      message: "Verification key is required."
    });
  }
  console.log("Verification Key:", verificationKey);
  // ✅ Enrich session with DB consent state (non-destructive)
  await enrichVerificationSession(verificationKey, "emailVerification");

  // ✅ Reload session AFTER enrichment
  const session = await getVerificationSession(verificationKey, "emailVerification");

  if (!session) {
    return res.status(400).json({
      error: "INVALID_OR_EXPIRED_SESSION",
      message: "Your verification session is invalid or has expired."
    });
  }

  return res.status(200).json({
    ok: true,
    email: session.email,
    data_consent: session.data_consent === "true",
    data_consent_version: session.data_consent_version,
    required_version: process.env.DATA_CONSENT_VERSION,
    consent_text: process.env.DATA_CONSENT_TEXT || "Default consent text here."
  });
});


// ✅ Record consent
router.post("/", async (req, res) => {
    const { verificationKey } = req.body;

    if (!verificationKey) {
        return res.status(400).json({
            error: "MISSING_VERIFICATION_KEY",
            message: "Verification key is required."
        });
    }

    // ✅ Update consent in Redis
    const updated = await updateConsentInSession(verificationKey, "emailVerification");

    if (!updated) {
        return res.status(400).json({
            error: "INVALID_OR_EXPIRED_SESSION",
            message: "Your verification session is invalid or has expired."
        });
    }

    return res.status(200).json({
        ok: true,
        message: "Consent recorded successfully.",
        version: process.env.DATA_CONSENT_VERSION
    });
});

module.exports = router;
