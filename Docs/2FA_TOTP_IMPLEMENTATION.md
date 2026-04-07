# Two-Factor Authentication (2FA) & TOTP — Implementation Reference

## Overview

MDSystem supports two distinct 2FA mechanisms depending on the user type:

| Mechanism | Portal | Method |
|-----------|--------|--------|
| **TOTP (Authenticator App)** | Staff (`mds-staff`) | RFC 6238 — Google Authenticator, Authy, etc. |
| **Email OTP** | Patient (`mds-patient`), Mobile (`mds-mobile`) | 6-digit code via email |

This document covers the **TOTP implementation only**. Email OTP is part of the general auth flow.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Core TOTP Utility](#core-totp-utility)
3. [Secret Encryption](#secret-encryption)
4. [Database Schema](#database-schema)
5. [Redis Session Tracking](#redis-session-tracking)
6. [API Endpoints](#api-endpoints)
7. [Login Flow with TOTP](#login-flow-with-totp)
8. [Security Hardening](#security-hardening)
9. [Error Reference](#error-reference)
10. [Supported Authenticator Apps](#supported-authenticator-apps)
11. [Environment Variables](#environment-variables)
12. [Deployment & Migration Notes](#deployment--migration-notes)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Staff Login Flow                      │
│                                                          │
│  1. Credentials → POST /auth/login                       │
│       └→ Returns { LoginKey, requiresTotp: true/false }  │
│                                                          │
│  2. If requiresTotp:                                     │
│       └→ User enters 6-digit code from app               │
│       └→ POST /settings/totp/validate                    │
│            └→ Validates token, marks session verified    │
│                                                          │
│  3. POST /auth/login/complete                            │
│       └→ Checks totp_2fa_verified in session             │
│       └→ Issues JWT tokens                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    TOTP Settings Flow                    │
│                                                          │
│  POST /settings/totp/setup                               │
│    └→ Generates secret, encrypts, stores in DB           │
│    └→ Returns: { secret, qrCode (base64 data URL) }      │
│                                                          │
│  POST /settings/totp/verify                              │
│    └→ User scans QR, enters first code                   │
│    └→ Validates → sets totp_enabled = true               │
│                                                          │
│  POST /settings/totp/disable                             │
│    └→ Requires current authenticator code               │
│    └→ Clears totp_secret, sets totp_enabled = false      │
└─────────────────────────────────────────────────────────┘
```

---

## Core TOTP Utility

**File**: `Backend/utils/totp.js`

Pure Node.js implementation — no external library. Compliant with **RFC 6238** (TOTP) and **RFC 4226** (HOTP).

### Parameters

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA1 |
| Digits | 6 |
| Period | 30 seconds |
| Window | ±1 step (90-second validity) |
| Secret encoding | Base32 (RFC 4648) |

### Exported Functions

```javascript
const { totpGenerateSecret, totpGetToken, totpVerify,
        totpKeyUri, encryptTotpSecret, decryptTotpSecret } = require("./utils/totp.js");
```

#### `totpGenerateSecret()`
Generates a cryptographically random 20-byte secret encoded as Base32.
```javascript
const secret = totpGenerateSecret();
// → "JBSWY3DPEHPK3PXP" (example)
```

#### `totpGetToken(secret, timestamp?)`
Computes the current 6-digit TOTP code for a given secret.
```javascript
const code = totpGetToken(secret);           // current code
const code = totpGetToken(secret, Date.now() - 30000); // previous step
```

#### `totpVerify(token, secret, window?)`
Validates a token against a secret with ±`window` time steps.
- Normalizes token to string before comparison
- Uses `crypto.timingSafeEqual` — immune to timing attacks
- Default window = 1 (accepts codes from ±30 seconds)

```javascript
const valid = totpVerify("123456", secret); // → true | false
```

#### `totpKeyUri(account, secret, issuer?)`
Generates the `otpauth://totp/...` URI for QR code generation.
```javascript
const uri = totpKeyUri("user@tip.edu.ph", secret);
// → "otpauth://totp/MDSystem:user%40tip.edu.ph?secret=...&issuer=MDSystem&..."
```

---

## Secret Encryption

**Algorithm**: AES-256-GCM (authenticated encryption)

All TOTP secrets are encrypted before being stored in the database. The encryption key is stored only in the environment — **never in the database or codebase**.

### Storage Format

Secrets are stored in the database in the format:
```
{ivHex}:{authTagHex}:{encryptedHex}
```

Example:
```
a1b2c3d4e5f6...:7f8e9d0c...:deadbeef1234...
```

### Implementation

```javascript
function encryptTotpSecret(plaintext) {
  const key = _getEncryptionKey();       // 32-byte key from env
  const iv = crypto.randomBytes(12);     // 96-bit IV (GCM standard)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();   // 128-bit authentication tag
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptTotpSecret(stored) {
  const key = _getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));  // verifies integrity
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
}
```

### Key Generation

Generate a fresh key for each environment:
```bash
cd Backend
npm run setup:totp-key
```

The script:
1. Generates 32 random bytes → 64-character hex string
2. Appends `TOTP_ENCRYPTION_KEY=<key>` to `Backend/.env`
3. Is idempotent — skips if key already exists
4. Warns if the key is not set at server startup

---

## Database Schema

### Columns added to `UserCredentials`

```sql
ALTER TABLE "UserCredentials"
  ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
```

**Migration file**: `Backend/config/data/post_build_setup.sql`

| Column | Type | Description |
|--------|------|-------------|
| `totp_secret` | `VARCHAR(255)` | AES-256-GCM encrypted Base32 secret. `NULL` when not set up |
| `totp_enabled` | `BOOLEAN` | `true` only after user completes setup and verifies |

### State Machine

```
totp_secret = NULL, totp_enabled = false   → Not set up
totp_secret = <enc>, totp_enabled = false  → Setup pending (QR scanned, not yet verified)
totp_secret = <enc>, totp_enabled = true   → Active
totp_secret = NULL, totp_enabled = false   → Disabled (cleared on disable)
```

---

## Redis Session Tracking

**File**: `Backend/config/redis.js`

### Verification Session Hash

When a user logs in, a verification session is created in Redis under:
```
verify:2fa:{verificationKey}
```

The session hash includes TOTP state fields:

| Field | Values | Description |
|-------|--------|-------------|
| `totp_enabled` | `"true"` / `"false"` | Copied from DB at session creation |
| `totp_2fa_verified` | `"true"` / `"false"` | Set to `"true"` after successful `/validate` |

### Brute-Force Lock Keys

Per-session TOTP failure tracking prevents brute-forcing of login sessions:

```
totp_fail:2fa:{verificationKey}
```

| Property | Value |
|----------|-------|
| Type | Integer counter |
| TTL | Matches `VERIFICATION_SESSION_EXPIRATION` (default: 900s) |
| Threshold | 5 failures → session destroyed |

#### Functions

```javascript
// Increment failure count. Returns true when threshold reached.
await recordTotpFailureForKey(verificationKey, "2fa");

// Check without incrementing. Returns true if locked.
await isTotpLockedForKey(verificationKey, "2fa");
```

When a session is locked by brute-force, the verification session itself is **deleted** — preventing any further use of that login session.

### Session Lifecycle

```
POST /auth/login
  └→ createVerificationSession()
       → verify:2fa:{key} hash created (TTL: 900s)
       → totp_enabled, totp_2fa_verified set from DB

POST /settings/totp/validate  (if totp_enabled=true)
  └→ isTotpLockedForKey() → abort if locked
  └→ totpVerify(token, decryptTotpSecret(secret))
  └→ updateTotp2FAInSession() → totp_2fa_verified = "true"
       OR
  └→ recordTotpFailureForKey() → count++; if locked → deleteVerificationSession()

POST /auth/login/complete
  └→ session.totp_enabled === "true" && session.totp_2fa_verified !== "true" → TOTP_NOT_VERIFIED
  └→ deleteVerificationSession()
  └→ Issue JWT tokens
```

---

## API Endpoints

**Base path**: `/settings/totp`

All endpoints except `/validate` require `Authorization: Bearer <JWT>` (staff portal JWT).

---

### `GET /settings/totp/status`

Returns the current 2FA status for the authenticated user.

**Auth**: JWT required (`medical`)

**Response**:
```json
{
  "ok": true,
  "totpEnabled": false,
  "emailTwoFactorEnabled": true
}
```

---

### `POST /settings/totp/setup`

Generates a new TOTP secret and QR code. Does **not** enable TOTP — user must verify first.

**Auth**: JWT required (`medical`)

**Response**:
```json
{
  "ok": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "message": "Scan the QR code with your authenticator app, then verify with a code."
}
```

> ⚠️ The `secret` is returned **once** for manual entry. The `otpauthUrl` is intentionally **not returned** (built and used for QR generation only) to reduce exposure.

---

### `POST /settings/totp/verify`

Verifies a code from the authenticator app and enables TOTP.

**Auth**: JWT required (`medical`) + `strictLimiter`

**Body**:
```json
{ "token": "123456" }
```

**Response**:
```json
{
  "ok": true,
  "message": "TOTP 2FA has been enabled successfully."
}
```

---

### `POST /settings/totp/disable`

Disables TOTP. Requires a valid authenticator code (not a password).

**Auth**: JWT required (`medical`) + `strictLimiter`

**Body**:
```json
{ "token": "123456" }
```

**Response**:
```json
{
  "ok": true,
  "message": "TOTP 2FA has been disabled."
}
```

On success: `totp_secret` is set to `NULL`, `totp_enabled` to `false`.

---

### `POST /settings/totp/validate`

Validates a TOTP code during the **login flow**. Called between `/auth/login` and `/auth/login/complete`.

**Auth**: None (IP rate-limited via `strictLimiter`)

**Body**:
```json
{
  "token": "123456",
  "verificationKey": "abc123...",
  "email": "user@tip.edu.ph"
}
```

**Response**:
```json
{
  "ok": true,
  "verificationKey": "abc123...",
  "message": "TOTP verification successful."
}
```

---

## Login Flow with TOTP

```
Staff User
    │
    ├─ POST /auth/login { email, password }
    │       ↓
    │   { ok: true, LoginKey, requiresTotp: true, requires2FA: false }
    │       ↓
    ├─ (show TOTP input)
    │       ↓
    ├─ POST /settings/totp/validate { token, verificationKey: LoginKey, email }
    │       ↓ (session updated: totp_2fa_verified = "true")
    ├─ POST /auth/login/complete { LoginKey }
    │       ↓ (all checks pass: consent, totp verified)
    └─ { accessToken, refreshToken }
```

**Key flag from `/auth/login`**:
```json
{
  "requires2FA": false,       // Email 2FA (patient flow)
  "requiresTotp": true        // Authenticator TOTP (staff flow)
}
```

The frontend uses `requiresTotp` to decide whether to show the TOTP input step.

---

## Security Hardening

### 1. Timing-Safe Comparison
```javascript
crypto.timingSafeEqual(expected, tokenBuf)
```
All token comparisons use constant-time equality — prevents timing oracle attacks.

### 2. Numeric-Only Validation
```javascript
if (!/^\d{6}$/.test(token)) { ... }
```
Applied on every endpoint before processing. Rejects non-numeric/non-6-digit inputs.

### 3. Per-Session Brute-Force Lock
- 5 failed TOTP attempts on the same `verificationKey` → session destroyed
- Attacker cannot reuse the session after repeated guessing
- Counter TTL matches the session TTL

### 4. IP Rate Limiting
Routes with `ipRateLimiter("strictLimiter")`:
- `POST /settings/totp/verify`
- `POST /settings/totp/disable`
- `POST /settings/totp/validate`

### 5. Secret Encryption at Rest
AES-256-GCM with:
- Unique 96-bit IV per encryption
- 128-bit GCM auth tag (detects tampering)
- Application-layer key (not DB-level) — DB compromise alone is insufficient

### 6. Secret Not Returned in Responses
The `otpauthUrl` (which embeds the secret in plaintext) is generated internally for QR code building only and is **never included in API responses**.

### 7. Disable Requires TOTP Code
Disabling 2FA requires a valid authenticator code — not a password. This prevents:
- Attackers who stole a session JWT from simply turning off 2FA

---

## Error Reference

| Error Code | HTTP | Trigger |
|------------|------|---------|
| `INVALID_TOKEN` | 400 | Token is not a 6-digit number |
| `TOTP_NOT_SETUP` | 400 | `/verify` called without `/setup` first |
| `TOTP_ALREADY_ENABLED` | 400 | `/setup` called when already enabled |
| `TOTP_NOT_ENABLED` | 400 | `/disable` or `/validate` called when not enabled |
| `INVALID_TOTP_CODE` | 400 | Token does not match secret |
| `INVALID_SESSION` | 400 | `verificationKey` not found or expired/locked |
| `EMAIL_MISMATCH` | 400 | Email doesn't match the session |
| `TOTP_NOT_VERIFIED` | 400 | `/login/complete` called before TOTP validated |
| `MISSING_FIELDS` | 400 | Required fields missing from request body |
| `USER_NOT_FOUND` | 404 | No DB record for the user |
| `TOTP_SETUP_FAILED` | 500 | Unexpected DB or crypto error |
| `TOTP_VERIFY_FAILED` | 500 | Unexpected error during verification |
| `TOTP_DISABLE_FAILED` | 500 | Unexpected error during disable |
| `TOTP_VALIDATE_FAILED` | 500 | Unexpected error during login validation |

---

## Supported Authenticator Apps

Any app implementing **RFC 6238 TOTP with HMAC-SHA1** will work. Tested/compatible:

| App | Platform | Notes |
|-----|----------|-------|
| Google Authenticator | iOS, Android | Standard reference |
| Authy | iOS, Android, Desktop | Cloud backup support |
| Microsoft Authenticator | iOS, Android | Enterprise-friendly |
| 1Password | iOS, Android, Desktop | Integrated with password manager |
| LastPass Authenticator | iOS, Android | |
| Duo Mobile | iOS, Android | |
| FreeOTP | iOS, Android | Open source |
| Bitwarden | iOS, Android, Desktop | Open source |

**Why they're all compatible**: The `otpauth://` URI scheme is a universal standard. Your app generates the same 6-digit codes regardless of which authenticator is used, because they all implement the same RFC 6238 algorithm with:
- HMAC-SHA1
- 6 digits
- 30-second period

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOTP_ENCRYPTION_KEY` | ✅ Yes | 64-character hex string (32 bytes AES key) |
| `VERIFICATION_SESSION_EXPIRATION` | Optional | Login session TTL in seconds (default: 900) |

### Generate the key

```bash
cd Backend
npm run setup:totp-key
# Writes TOTP_ENCRYPTION_KEY to Backend/.env
# Idempotent — safe to run multiple times (skips if already set)
```

---

## Deployment & Migration Notes

### First Deployment

1. Run `npm run setup:totp-key` to generate and write the encryption key
2. Run `Backend/config/data/post_build_setup.sql` against the database to add columns
3. Deploy the backend

### Upgrading from Pre-Encryption Version

If TOTP secrets were stored as plaintext (before AES encryption was added):

- **Impact**: `decryptTotpSecret()` expects `iv:tag:ciphertext` format — plaintext secrets will throw
- **Resolution**: Affected users must re-run TOTP setup (`disable` → `setup` → `verify`)
- **Detection**: Any stored `totp_secret` that does not contain exactly two `:` characters is plaintext

### Key Rotation

To rotate the encryption key:
1. Disable TOTP for all users (requires migrating existing encrypted secrets)
2. Delete the old `TOTP_ENCRYPTION_KEY` line from `.env`
3. Run `npm run setup:totp-key` to generate a new key
4. Users must re-setup TOTP after rotation

> ⚠️ **There is no automatic re-encryption on key rotation.** Plan user communication accordingly.

### Backup

The `TOTP_ENCRYPTION_KEY` must be backed up securely (e.g., secret manager, encrypted vault). Losing it makes **all stored TOTP secrets unreadable** — all TOTP-enabled users would lose access.

---

**Document Version**: 1.0
**Last Updated**: 2026-04-07
**Maintained By**: MDSystem Backend Team
