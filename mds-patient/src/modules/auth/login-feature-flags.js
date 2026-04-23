/**
 * Feature-flag helpers for the patient login form.
 * All functions are pure and accept raw env values so they can be tested
 * independently of the component lifecycle.
 */

/**
 * Returns true when reCAPTCHA is active — i.e. a non-empty site key is configured.
 * When disabled the captcha widget must not render and must not gate form submission.
 *
 * @param {string|undefined} siteKey - value of VITE_RECAPTCHA_SITE_KEY
 * @returns {boolean}
 */
export function resolveRecaptchaEnabled(siteKey) {
  return !!siteKey;
}

/**
 * Returns true when Google OAuth sign-in should be offered.
 * Both the explicit flag AND a real client ID must be present; an empty client
 * ID means the integration is unconfigured and must not show.
 *
 * @param {string|boolean|undefined} oauthEnabledFlag - value of VITE_GOOGLE_OAUTH_ENABLED
 * @param {string|undefined} clientId - value of VITE_GOOGLE_CLIENT_ID
 * @returns {boolean}
 */
export function resolveGoogleOauthEnabled(oauthEnabledFlag, clientId) {
  return oauthEnabledFlag !== 'false' && oauthEnabledFlag !== false && !!clientId;
}

/**
 * Returns true when the login submit should be blocked because the user has
 * not yet completed the reCAPTCHA challenge.
 *
 * @param {{ captchaRequired: boolean, recaptchaEnabled: boolean, recaptchaToken: string }} opts
 * @returns {boolean}
 */
export function shouldBlockForCaptcha({ captchaRequired, recaptchaEnabled, recaptchaToken }) {
  return captchaRequired && recaptchaEnabled && !recaptchaToken;
}
