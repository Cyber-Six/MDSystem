/**
 * reCAPTCHA v2 Service Factory
 * 
 * Platform-agnostic reCAPTCHA integration. The web implementation uses
 * Google's reCAPTCHA v2 "I'm not a robot" checkbox widget.
 * Mobile platforms can inject a different executor (e.g. expo-recaptcha).
 * 
 * @module @mdsystem/core/services/recaptcha-service
 */

/**
 * @typedef {Object} RecaptchaConfig
 * @property {string} siteKey - Google reCAPTCHA v2 site key
 * @property {'web'|'mobile'} platform - Target platform
 */

/**
 * Creates a reCAPTCHA service that manages token acquisition.
 * 
 * For web: renders the invisible/checkbox widget and resolves the token.
 * For mobile: delegates to an injected executor function.
 * 
 * @param {RecaptchaConfig} config
 * @returns {{ executeRecaptcha: () => Promise<string>, reset: () => void }}
 */
export function createRecaptchaService(config) {
  const { siteKey, platform = 'web' } = config;

  if (!siteKey) {
    console.warn('[reCAPTCHA] No site key provided — tokens will be empty');
  }

  /**
   * Execute reCAPTCHA and return a valid token string.
   * On web, this renders the checkbox widget via the global grecaptcha API.
   * 
   * @param {string} [containerId] - DOM element ID for reCAPTCHA widget (web only)
   * @returns {Promise<string>} The reCAPTCHA response token
   */
  async function executeRecaptcha(containerId) {
    if (platform === 'web') {
      return executeWebRecaptcha(siteKey, containerId);
    }
    throw new Error(`reCAPTCHA: platform "${platform}" not supported in core. Inject a custom executor.`);
  }

  /**
   * Reset the reCAPTCHA widget (web only). Call after form submission
   * so the user can re-verify if they need to submit again.
   */
  function reset() {
    if (platform === 'web' && typeof window !== 'undefined' && window.grecaptcha) {
      try {
        window.grecaptcha.reset();
      } catch {
        // Widget may not be rendered yet — safe to ignore
      }
    }
  }

  return { executeRecaptcha, reset, siteKey };
}

/**
 * Renders reCAPTCHA v2 checkbox widget in the specified container and
 * returns a Promise that resolves with the response token when the user
 * completes the challenge.
 * 
 * @param {string} siteKey
 * @param {string} [containerId='recaptcha-container']
 * @returns {Promise<string>}
 */
function executeWebRecaptcha(siteKey, containerId = 'recaptcha-container') {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.grecaptcha) {
      return reject(new Error('reCAPTCHA script not loaded. Add the script tag to index.html.'));
    }

    // Ensure the grecaptcha API is ready
    window.grecaptcha.ready(() => {
      try {
        const container = document.getElementById(containerId);
        if (!container) {
          return reject(new Error(`reCAPTCHA container #${containerId} not found in DOM.`));
        }

        // Clear previous widget if re-rendering
        container.innerHTML = '';

        window.grecaptcha.render(containerId, {
          sitekey: siteKey,
          callback: (token) => resolve(token),
          'expired-callback': () => reject(new Error('reCAPTCHA expired. Please try again.')),
          'error-callback': () => reject(new Error('reCAPTCHA error. Please try again.')),
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
