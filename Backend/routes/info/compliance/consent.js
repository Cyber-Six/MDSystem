const express = require("express");
const router = express.Router();

const { getVerificationSession, updateConsentInSession } = require('../../../config/redis.js');

function containLoginRegister(purpose) {
  return ["login", "register"].includes(purpose);
  }

function purposeLookup(purpose) {
  if (purpose === "login") return "2fa";
  if (purpose === "register") return "verification";
  }

// ✅ Load T&C consent state
router.get("/:purpose", async (req, res) => {
  const { verificationKey } = req.query;
  const purpose = req.params.purpose;

  if (!verificationKey) {
    return res.status(400).json({
      error: "MISSING_VERIFICATION_KEY",
      message: "Verification key is required."
    });
  }

  // ✅ Validate perform
  if (!containLoginRegister(purpose)) {
    return res.status(400).json({
      error: "INVALID_PERFORM_ACTION",
      message: "Perform must be either 'login' or 'register'."
    });
  }

  // ✅ Reload session AFTER enrichment
  const session = await getVerificationSession(verificationKey, purposeLookup(purpose));

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
router.post("/:purpose", async (req, res) => {
    const { verificationKey } = req.body;
    const purpose = req.params.purpose;

    if (!verificationKey) {
      return res.status(400).json({
        error: "MISSING_VERIFICATION_KEY",
        message: "Verification key is required."
      });
    }

    // ✅ Validate perform
    if (!containLoginRegister(purpose)) {
      return res.status(400).json({
        error: "INVALID_PERFORM_ACTION",
        message: "Perform must be either 'login' or 'register'."
      });
    }

    // ✅ Update consent in Redis
    const updated = await updateConsentInSession(verificationKey, purposeLookup(purpose));

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
