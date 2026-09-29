# API Keys — Google OAuth & reCAPTCHA

All keys are obtained from **Google Cloud Console → APIs & Services → Credentials**
and **https://www.google.com/recaptcha/admin**.

---

## Backend (`Backend/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Web Application client ID — used to verify Google ID tokens server-side |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Web Application client secret — never exposed to the client |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2 secret key — used by the backend to call Google's siteverify API |
| `RECAPTCHA_MOBILE_SECRET` | Shared secret sent by the mobile app in place of the v2 widget token; generate with `openssl rand -hex 32` |

---

## Staff Portal (`mds-staff/.env`)

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID — rendered in the GIS script to show the Sign in with Google button |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v2 site key — used to render the checkbox widget on the login page |

---

## Patient Portal (`mds-patient/.env`)

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID — same purpose as the staff portal |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v2 site key — same purpose as the staff portal |

> `VITE_GOOGLE_CLIENT_ID` and `VITE_RECAPTCHA_SITE_KEY` can use the **same values** across
> both web portals as long as the OAuth credential and reCAPTCHA domain list includes both origins.

---

## Mobile (`mds-mobile/.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | OAuth client ID for Android (requires package name + SHA-1 fingerprint in Cloud Console) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | OAuth client ID for iOS (requires bundle identifier in Cloud Console) |
| `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET` | Must match `RECAPTCHA_MOBILE_SECRET` in the backend — mobile sends this instead of the v2 widget token |

---

## Feature Toggles

| Variable | File | Default | Description |
|---|---|---|---|
| `GOOGLE_OAUTH_ENABLED` | `Backend/.env` | `false` | Enables/disables the `/auth/oauth/google` endpoint |
| `VITE_GOOGLE_OAUTH_ENABLED` | `mds-staff/.env`, `mds-patient/.env` | `true` | Shows/hides the Sign in with Google button |
| `RECAPTCHA_TEST_MODE` | `Backend/.env` | `true` | Skips real captcha verification in development |

---

## Quick Setup Checklist

- [ ] Create a **Web Application** OAuth credential → copy client ID + secret to `Backend/.env` and both web portal `.env` files
- [ ] Create an **Android** OAuth credential → copy to `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] Create an **iOS** OAuth credential → copy to `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- [ ] Register a **reCAPTCHA v2 (checkbox)** site → copy site key to both web portal `.env` files, secret key to `Backend/.env`
- [ ] Generate a random string for `RECAPTCHA_MOBILE_SECRET` and mirror it in `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET`
- [ ] Set `RECAPTCHA_TEST_MODE=false` and `GOOGLE_OAUTH_ENABLED=true` before deploying to production
