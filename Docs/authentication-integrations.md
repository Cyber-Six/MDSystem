# Google OAuth and reCAPTCHA

This guide describes the current Google sign-in and reCAPTCHA integration for the patient web, staff web, and mobile clients.

## Google OAuth

The web clients read `VITE_GOOGLE_CLIENT_ID`; the login UI also checks `VITE_GOOGLE_OAUTH_ENABLED` and requires a client ID before showing Google sign-in. The backend reads `GOOGLE_OAUTH_ENABLED` and `GOOGLE_OAUTH_CLIENT_ID`. The OAuth route is `POST /auth/oauth/google` on both portal servers.

The client sends a Google ID-token credential. The backend verifies the token signature and audience, requires a verified `@tip.edu.ph` address, and requires the hosted-domain claim to be `tip.edu.ph`. OAuth does not create a new account; it authenticates an existing account and continues the application's verification flow. Set `GOOGLE_OAUTH_ENABLED=false` to disable the backend endpoint.

## reCAPTCHA

The web clients read `VITE_RECAPTCHA_SITE_KEY`. The site key is embedded in the built browser application and is public. The backend reads `RECAPTCHA_SECRET_KEY` to verify tokens with Google's siteverify endpoint. Login routes can require a token after repeated failures; the current threshold is configured by `RECAPTCHA_FAIL_ATTEMPT_THRESHOLD` and defaults to 3. Registration and email authentication flows may have their own verification checks; consult their route behavior when changing the flow.

Mobile clients use `EXPO_PUBLIC_ENABLE_RECAPTCHA` and `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET` in the current auth feature configuration. That value is bundled into a client application and must be treated as public; it is not equivalent to a secret held only by a trusted server. The backend accepts it as the mobile token when it matches `RECAPTCHA_MOBILE_SECRET`.

`RECAPTCHA_TEST_MODE=true` makes the backend verification service accept tokens without calling Google. Keep test mode disabled in production.

## Configuration locations

- Backend variables and deployment values: root `.env.example` and `Backend/config/config.js`.
- Web build-time values: `mds-patient/.env` and `mds-staff/.env`, read by their Vite configurations.
- Mobile public values: `mds-mobile/.env`, read by `mds-mobile/src/config/authFeatures.ts` and `app.config.js`.

Never commit real environment files. Do not place backend OAuth or reCAPTCHA secret keys in `VITE_*` or `EXPO_PUBLIC_*` variables.

## Code locations

- Google ID token verification: `Backend/services/auth/google-oauth.js`.
- reCAPTCHA verification: `Backend/services/auth/recaptcha.js`.
- OAuth route: `Backend/routes/auth/oauth/google.js`.
- Web login configuration: `mds-patient/src/modules/auth/` and `mds-staff/src/modules/auth/`.
- Mobile auth feature flags: `mds-mobile/src/config/authFeatures.ts`.
