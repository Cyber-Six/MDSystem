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
  const widgets = new Map();
  const pending = new Set();
  let revision = 0;

  if (!siteKey) {
    console.warn('[reCAPTCHA] No site key provided');
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
      return executeWebRecaptcha(containerId);
    }
    throw new Error(`reCAPTCHA: platform "${platform}" not supported in core. Inject a custom executor.`);
  }

  /**
   * Reset the reCAPTCHA widget (web only). Call after form submission
   * so the user can re-verify if they need to submit again.
   */
  function reset() {
    revision += 1;
    for (const waiter of [...pending]) waiter.reject(new Error('reCAPTCHA reset. Please try again.'));
    if (platform === 'web' && typeof window !== 'undefined' && window.grecaptcha) {
      for (const widget of widgets.values()) {
        try {
          window.grecaptcha.reset(widget.id);
        } catch {
          // The widget may have been removed from the DOM.
        }
      }
    }
  }

  function executeWebRecaptcha(containerId = 'recaptcha-container') {
    return new Promise((resolve, reject) => {
      if (!siteKey) return reject(new Error('reCAPTCHA site key is required.'));
      if (typeof window === 'undefined' || !window.grecaptcha) {
        return reject(new Error('reCAPTCHA script not loaded. Add the script tag to index.html.'));
      }

      const requestRevision = revision;
      let widget;
      const finish = (callback, value) => {
        pending.delete(waiter);
        widget?.waiters.delete(waiter);
        callback(value);
      };
      const waiter = {
        resolve: (token) => finish(resolve, token),
        reject: (error) => finish(reject, error),
      };
      pending.add(waiter);
      try {
        window.grecaptcha.ready(() => {
          if (revision !== requestRevision) return;
          try {
            const container = document.getElementById(containerId);
            if (!container) throw new Error(`reCAPTCHA container #${containerId} not found in DOM.`);
            widget = widgets.get(container);
            if (widget) {
              const token = window.grecaptcha.getResponse(widget.id);
              if (token) return waiter.resolve(token);
              widget.waiters.add(waiter);
              return;
            }

            widget = { id: null, waiters: new Set([waiter]) };
            widgets.set(container, widget);
            const settle = (method, value) => {
              for (const request of [...widget.waiters]) request[method](value);
            };
            try {
              widget.id = window.grecaptcha.render(container, {
                sitekey: siteKey,
                callback: (token) => {
                  if (typeof token === 'string' && token) settle('resolve', token);
                  else settle('reject', new Error('reCAPTCHA returned an empty token.'));
                },
                'expired-callback': () => settle('reject', new Error('reCAPTCHA expired. Please try again.')),
                'error-callback': () => settle('reject', new Error('reCAPTCHA error. Please try again.')),
              });
            } catch (error) {
              widgets.delete(container);
              settle('reject', error);
            }
          } catch (error) {
            waiter.reject(error);
          }
        });
      } catch (error) {
        waiter.reject(error);
      }
    });
  }

  return { executeRecaptcha, reset, siteKey };
}
