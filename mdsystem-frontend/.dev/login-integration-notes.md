# Login Integration Notes

## Overview
The `Login.jsx` component has been updated to be fully compatible with the backend login API flow. The login process follows a multi-step authentication flow with optional 2FA and mandatory data consent.

## Login Flow

### Step 1: Initial Login (`POST /login`)
**Required fields:**
- `email` - TIP institutional email
- `password` - User password
- `role` - User role (patient, doctor, nurse, admin)
- `recaptchaToken` - Google reCAPTCHA token

**Response:**
```json
{
  "ok": true,
  "requires2FA": true/false,
  "verificationKey": "unique-session-key"
}
```

### Step 2a: Two-Factor Authentication (if enabled)
**Send 2FA Code:** `POST /auth/email/2fa`
- Automatically triggered if `requires2FA` is true
- Sends OTP code to user's email

**Verify 2FA Code:** `POST /auth/email/2fa/verify`
```json
{
  "email": "user@tip.edu.ph",
  "otp": "123456"
}
```

**Error Handling:**
- `INVALID_OTP` - Wrong code, shows attempts remaining
- `OTP_LOCKED_OUT` - Too many attempts, shows retry time

### Step 2b: Data Consent (required for all users)
- User must review and agree to data consent policy
- Checkbox must be checked before proceeding

### Step 3: Complete Login (`POST /login/complete`)
**Required fields:**
```json
{
  "verificationKey": "session-key-from-step-1"
}
```

**Backend Validations:**
- Verifies login session is valid
- Checks 2FA was completed (if required)
- Validates data consent was agreed
- Confirms consent version matches current policy

**Success Response:**
```json
{
  "ok": true,
  "message": "Login successful."
}
```
- Auth tokens are set as HTTP-only cookies
- User is redirected to dashboard

## TODO: Required Integrations

### 1. Google reCAPTCHA v3
**Priority: HIGH**

**What to do:**
1. Install reCAPTCHA library:
   ```bash
   npm install react-google-recaptcha-v3
   ```

2. Get reCAPTCHA site key from Google Cloud Console

3. Add reCAPTCHA provider to app:
   ```jsx
   // src/App.jsx
   import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
   
   <GoogleReCaptchaProvider reCaptchaKey="YOUR_SITE_KEY">
     <App />
   </GoogleReCaptchaProvider>
   ```

4. Update Login.jsx to use reCAPTCHA:
   ```jsx
   import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
   
   const { executeRecaptcha } = useGoogleReCaptcha();
   
   // Replace 'RECAPTCHA_TOKEN_HERE' with:
   const recaptchaToken = await executeRecaptcha('login');
   ```

### 2. Data Consent Policy Content
**Priority: HIGH**

**What to do:**
1. Create a consent policy text file or API endpoint
2. Load the actual consent policy content in the consent screen
3. Consider adding a version number display
4. Add a link to full privacy policy document

**Suggested location:**
```
mdsystem-frontend/src/content/consent-policy.md
```

### 3. Error Messages & User Feedback
**Priority: MEDIUM**

**What to do:**
1. Add a success message component for "2FA code sent"
2. Consider adding a loading spinner for better UX
3. Add countdown timer for 2FA resend cooldown
4. Show clear error states with icons

### 4. CSS Styling
**Priority: MEDIUM**

**What to do:**
Update `login.module.css` to include styles for:
- `.consent-form` - Consent screen container
- `.consent-content` - Scrollable consent text area
- `.consent-text` - Formatted policy text
- `.consent-checkbox` - Checkbox with label
- `.resend-button` - Resend 2FA code button
- `.cancel-button` - Cancel action button
- Two-factor authentication screen layout

### 5. Role Selection Logic
**Priority: LOW**

**What to do:**
- Consider pre-selecting role based on email domain pattern
- The backend validates role anyway, but UX can be improved
- For staff portal, show all staff roles
- For patient portal, only show patient role

### 6. Session Management
**Priority: LOW**

**Current:** Auth tokens are HTTP-only cookies managed by backend

**Consider adding:**
- Session timeout warning
- Auto-refresh token mechanism
- Remember me functionality (if supported by backend)

## Backend API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/login` | Initial login with credentials |
| POST | `/login/complete` | Complete login after 2FA/consent |
| POST | `/auth/email/2fa` | Send 2FA code to email |
| POST | `/auth/email/2fa/verify` | Verify 2FA OTP code |

## Security Features Implemented

✅ Portal-based subdomain detection (www. vs staff.)
✅ Google reCAPTCHA verification (needs frontend integration)
✅ Rate limiting on login attempts
✅ Email-based 2FA with OTP
✅ OTP lockout after failed attempts
✅ Data consent requirement
✅ Institutional email validation
✅ HTTP-only cookies for auth tokens
✅ Session-based verification flow

## Testing Checklist

- [ ] Login with valid credentials (patient portal)
- [ ] Login with valid credentials (staff portal)
- [ ] Login with invalid credentials
- [ ] Login with wrong role selection
- [ ] Login with 2FA enabled
- [ ] Login with 2FA disabled
- [ ] 2FA code verification success
- [ ] 2FA code verification failure
- [ ] 2FA resend functionality
- [ ] 2FA lockout after multiple failures
- [ ] Data consent agreement
- [ ] Data consent rejection
- [ ] reCAPTCHA failure handling
- [ ] Session expiration handling
- [ ] Rate limiting behavior

## Notes

- The `verificationKey` acts as a temporary session identifier
- The backend automatically detects portal type from subdomain
- All sensitive tokens are managed server-side (HTTP-only cookies)
- The frontend must handle three distinct screens: login, 2FA, consent
- Error messages are designed to be user-friendly while maintaining security
