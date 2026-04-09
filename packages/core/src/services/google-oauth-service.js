/**
 * Google OAuth Service Factory
 * 
 * Platform-agnostic Google Sign-In integration for @tip.edu.ph accounts.
 * Web uses Google Identity Services (GSI) library.
 * Mobile uses Expo AuthSession or similar.
 * 
 * @module @mdsystem/core/services/google-oauth-service
 */

/**
 * @typedef {Object} GoogleOAuthConfig
 * @property {string} clientId - Google OAuth 2.0 Client ID
 * @property {(credential: string) => void} onSuccess - Called with the ID token credential
 * @property {(error: string) => void} onError - Called on authentication failure
 */

/**
 * Creates a Google OAuth service for initiating Google Sign-In.
 * 
 * Web integration uses the Google Identity Services (GSI) library loaded via
 * a script tag in index.html. The GSI `google.accounts.id` API triggers the
 * One Tap or button-based sign-in flow and returns an ID token JWT.
 * 
 * @param {GoogleOAuthConfig} config
 * @returns {{ initialize: () => void, renderButton: (containerId: string) => void }}
 */
export function createGoogleOAuthService(config) {
  const { clientId, onSuccess, onError } = config;

  let initialized = false;

  /**
   * Initialize the Google Identity Services client.
   * Must be called after the GSI script is loaded.
   */
  function initialize() {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) {
      console.warn('[GoogleOAuth] GSI library not loaded — skipping initialization');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      // Restrict to TIP domain for Workspace accounts
      hosted_domain: 'tip.edu.ph',
    });

    initialized = true;
  }

  /**
   * Render the Google Sign-In button in a DOM container.
   * @param {string} containerId - ID of the DOM element to render the button in
   * @param {Object} [options] - Button customization options
   */
  function renderButton(containerId, options = {}) {
    if (!initialized) {
      initialize();
    }

    if (!window.google?.accounts?.id) {
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[GoogleOAuth] Container #${containerId} not found`);
      return;
    }

    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: options.width || undefined,
      ...options,
    });
  }

  /**
   * Handle the credential response from Google Sign-In.
   * @param {Object} response - GSI credential response
   * @param {string} response.credential - JWT ID token
   */
  function handleCredentialResponse(response) {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError('Google Sign-In did not return a credential.');
    }
  }

  return { initialize, renderButton };
}
