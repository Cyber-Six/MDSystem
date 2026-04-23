const DATA_CONSENT_REQUIRED = "DATA_CONSENT_REQUIRED";
const OUTDATED_CONSENT = "OUTDATED_CONSENT";

function normalizeConsentFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value || "").trim().toLowerCase() === "true";
}

function normalizeConsentVersion(value) {
  return String(value || "").trim();
}

function getConsentGateError(session, requiredVersion) {
  const hasConsent = normalizeConsentFlag(session?.data_consent);
  if (!hasConsent) {
    return DATA_CONSENT_REQUIRED;
  }

  const normalizedRequiredVersion = normalizeConsentVersion(requiredVersion);
  if (!normalizedRequiredVersion) {
    return null;
  }

  const userConsentVersion = normalizeConsentVersion(session?.data_consent_version);
  if (userConsentVersion !== normalizedRequiredVersion) {
    return OUTDATED_CONSENT;
  }

  return null;
}

module.exports = {
  DATA_CONSENT_REQUIRED,
  OUTDATED_CONSENT,
  normalizeConsentFlag,
  normalizeConsentVersion,
  getConsentGateError,
};