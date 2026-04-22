# reCAPTCHA & Google OAuth Implementation

## Overview

MDSystem uses **Google reCAPTCHA v2** (checkbox) for bot protection and **Google OAuth (Sign-In with Google)** as an alternative authentication method. reCAPTCHA is **adaptive** — it is only presented to users after consecutive failed login attempts, reducing friction for legitimate users while defending against credential-stuffing attacks.

---

## Table of Contents

1. [Adaptive reCAPTCHA](#adaptive-recaptcha)
2. [Google OAuth](#google-oauth)
3. [Authentication Flow](#authentication-flow)
4. [Environment Variables](#environment-variables)
5. [Architecture](#architecture)
6. [File Reference](#file-reference)

---

## Adaptive reCAPTCHA

### How It Works

Instead of always requiring reCAPTCHA on every login attempt, the system uses a **failure-count threshold** stored in Redis. The reCAPTCHA widget is hidden by default and only appears after the server signals that it is required.

**Sequence:**

1. User submits email + password (no reCAPTCHA token).
2. If credentials are wrong, the backend increments the per-email failure counter in Redis and returns `requiresCaptcha: true` once the count reaches the threshold.
3. The frontend detects `requiresCaptcha` in the error response and renders the reCAPTCHA v2 widget.
4. Subsequent requests from the same email must include a valid `recaptchaToken` until the failure counter expires (TTL-based).
5. On successful login the failure counter is not explicitly cleared — it expires naturally via Redis TTL.

### Threshold Configuration

| Variable | Default | Description |
|---|---|---|
| `RECAPTCHA_FAIL_THRESHOLD` | `2` | Number of consecutive failures before reCAPTCHA is required |

The threshold is independent of the **account lockout** thresholds:

| Portal | Lockout Threshold | Lockout Duration | Failure TTL |
|---|---|---|---|
| Patient | 5 failures | 300 s | 300 s |
| Staff (Medical) | 3 failures | 300 s | 300 s |

### Server Response Flags

Every credential-failure response includes:

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect. 2 failed attempts.",
  "requiresCaptcha": true
}
```

When captcha is required but no token is sent:

```json
{
  "error": "RECAPTCHA_REQUIRED",
  "message": "Too many failed attempts. Please complete the reCAPTCHA check.",
  "requiresCaptcha": true
}
```

### Frontend Behaviour

- `captchaRequired` state is `false` by default — the widget DOM element does not exist.
- When a login error response includes `requiresCaptcha: true`, the state flips to `true`.
- A `useEffect` watches `captchaRequired` and calls `grecaptcha.render()` once the script and DOM are ready.
- The submit button is disabled only when `captchaRequired && !recaptchaToken`.
- After every submission (success or failure), the widget is reset via `grecaptcha.reset()`.

### Mobile Clients

Mobile native apps (React Native / Expo) cannot render a reCAPTCHA v2 checkbox widget. Instead, they send a **shared server-side secret** (`RECAPTCHA_MOBILE_SECRET` / `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET`). The backend `verifyRecaptcha()` service recognises this token and returns `true` without calling Google's siteverify API.

Because mobile always sends a valid token, the adaptive threshold is effectively bypassed for mobile clients.

### Test Mode

Set `RECAPTCHA_TEST_MODE=true` to skip real reCAPTCHA verification. This calls `verifyRecaptcha_demo()` which always returns `true`.

---

## Google OAuth

### Overview

Users can sign in with their **@tip.edu.ph** Google account. The flow uses **Google Identity Services (GIS)** on web and **expo-auth-session** on mobile. The backend verifies the Google ID token server-side using `google-auth-library`.

### Flow

```
┌─────────────────┐
│  Client (Web)   │
│                 │
│ 1. User clicks  │
│    "Sign in     │
│     with Google"│
│                 │
│ 2. Google GIS   │
│    returns      │
│    credential   │
│    (ID token)   │
│                 │
│ 3. Client sends │─────► POST /auth/oauth/google
│    credential + │       { credential, recaptchaToken }
│    recaptchaToken│
└─────────────────┘
                          ┌──────────────────────┐
                          │      Backend          │
                          │                       │
                          │ 4. Verify reCAPTCHA   │
                          │ 5. Verify Google      │
                          │    ID token           │
                          │    - Signature check  │
                          │    - Audience check   │
                          │    - email_verified   │
                          │    - @tip.edu.ph hd   │
                          │ 6. Look up user in DB │
                          │ 7. Create 2FA session │
                          │ 8. Return LoginKey    │
                          └──────────────────────┘
```

### Security Layers (OAuth)

1. **IP rate limiting** — portal-based
2. **reCAPTCHA verification** — always required for OAuth (email unknown until token decoded)
3. **Google ID token verification** — signature, audience, `email_verified`
4. **`@tip.edu.ph` domain enforcement** — `hd` claim validated
5. **Existing user requirement** — no auto-registration
6. **Login lockout check** — same Redis-based lockout as password login
7. **Portal-based account type validation**

### Why reCAPTCHA Is Always Required for OAuth

Unlike password login, the user's email is not known until the Google ID token is decoded. Therefore, the server cannot look up a per-email failure count before processing the request. reCAPTCHA is always mandatory for OAuth routes.

On the frontend, if the user clicks "Sign in with Google" before completing the reCAPTCHA widget, the widget is shown immediately and the user is prompted to complete it first.

---

## Authentication Flow

The complete authentication flow follows this sequence:

```
Email → Password → reCAPTCHA (adaptive) → 2FA → Login Complete (Data Consent only if required)
```

### Detailed Steps

| Step | Description | Component |
|---|---|---|
| 1. Email + Password | User enters credentials | Login form |
| 2. reCAPTCHA (adaptive) | Shown only after N failures; server returns `requiresCaptcha` flag | `shouldRequireRecaptcha()` in Redis |
| 3. Credential Verification | Backend validates email format, institution, password hash | `POST /auth/login` |
| 4. 2FA - TOTP (if enabled) | If user has TOTP (Google Authenticator) enabled, prompt for 6-digit code | `POST /settings/totp/validate` |
| 5. 2FA - Email OTP (default) | If TOTP not enabled, send OTP to email; user enters code | `POST /auth/email/2fa` → `POST /auth/email/2fa/verify` |
| 6. Data Consent (Conditional) | Prompted only when `data_consent` is false or `data_consent_version` differs from `DATA_CONSENT_VERSION` | DataConsent modal |
| 7. Login Complete | Final call exchanges LoginKey for JWT access + refresh tokens | `POST /auth/login/complete` |

### Session State

All intermediate state (LoginKey, 2FA status, consent status) is stored in **Redis** via `createVerificationSession()`. The LoginKey is a cryptographically random string that acts as a session handle. It expires after a configurable TTL (default: 300 seconds).

---

## Environment Variables

### reCAPTCHA

| Variable | Required | Description |
|---|---|---|
| `RECAPTCHA_SECRET_KEY` | Yes | Google reCAPTCHA v2 secret key (server-side) |
| `RECAPTCHA_FAIL_THRESHOLD` | No | Failures before reCAPTCHA is required (default: `2`) |
| `RECAPTCHA_MOBILE_SECRET` | Yes | Shared secret for mobile app reCAPTCHA bypass |
| `RECAPTCHA_TEST_MODE` | No | Set `"true"` to skip verification in development |
| `VITE_RECAPTCHA_SITE_KEY` | Yes (web) | reCAPTCHA v2 site key for staff/patient web portals |
| `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET` | Yes (mobile) | Mobile client-side copy of the shared secret |

### Google OAuth

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 client ID |
| `VITE_GOOGLE_CLIENT_ID` | Yes (web) | Client ID exposed to staff/patient web portals |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Yes (mobile) | Client ID for Expo/mobile |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Yes (iOS) | iOS-specific Google client ID |

---

## Architecture

### Backend Files

| File | Purpose |
|---|---|
| `Backend/services/recaptcha.js` | reCAPTCHA token verification (Google siteverify API + mobile secret bypass) |
| `Backend/services/google-oauth.js` | Google ID token verification via `google-auth-library` |
| `Backend/config/redis.js` | `shouldRequireRecaptcha()`, `getLoginFailureCount()`, `LoginFailureMatrix`, failure tracking |
| `Backend/routes/auth/user/login.js` | Password login route with adaptive reCAPTCHA |
| `Backend/routes/auth/oauth/google.js` | Google OAuth login route (always requires reCAPTCHA) |

### Frontend Files

| File | Purpose |
|---|---|
| `mds-staff/src/modules/auth/login.jsx` | Staff portal login — adaptive reCAPTCHA + Google Sign-In |
| `mds-patient/src/modules/auth/login.jsx` | Patient portal login — adaptive reCAPTCHA + Google Sign-In |
| `mds-mobile/src/screens/auth/LoginScreen.tsx` | Mobile login — uses shared secret, Google via expo-auth-session |

### Shared Packages

| File | Purpose |
|---|---|
| `packages/core/validation/email-validation.js` | `@tip.edu.ph` email format validation + role detection |

---

## File Reference

### Redis — Adaptive reCAPTCHA Functions

```javascript
// Backend/config/redis.js

const RECAPTCHA_FAIL_THRESHOLD = Number(process.env.RECAPTCHA_FAIL_THRESHOLD) || 2;

async function getLoginFailureCount(email, portal) {
  const prefix = LoginFailureMatrix[portal].prefix;
  const failKey = `${prefix}:fail:${email}`;
  const count = await client.get(failKey);
  return Number(count) || 0;
}

async function shouldRequireRecaptcha(email, portal) {
  const count = await getLoginFailureCount(email, portal);
  return count >= RECAPTCHA_FAIL_THRESHOLD;
}
```

### Login Route — Adaptive Check

```javascript
// Backend/routes/auth/user/login.js

const captchaRequired = await shouldRequireRecaptcha(email, account_type);
if (captchaRequired) {
  if (!recaptchaToken) {
    return res.status(400).json({
      error: "RECAPTCHA_REQUIRED",
      message: "Too many failed attempts. Please complete the reCAPTCHA check.",
      requiresCaptcha: true,
    });
  }
  // ... verify token via Google siteverify
}
```

### Frontend — Adaptive State

```jsx
// mds-staff/src/modules/auth/login.jsx (same pattern in mds-patient)

const [captchaRequired, setCaptchaRequired] = useState(false);

// Render widget only when server flagged it
useEffect(() => {
  if (!captchaRequired || !RECAPTCHA_SITE_KEY) return;
  // ... poll for grecaptcha to be ready, then render
}, [captchaRequired]);

// In error handler:
if (err.response?.data?.requiresCaptcha) {
  setCaptchaRequired(true);
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-07-14
**Maintained By**: MDSystem Security Team
