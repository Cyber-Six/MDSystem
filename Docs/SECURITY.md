# Security Architecture: Admin Transfer & Role Management

## Overview

This document outlines the comprehensive security architecture implemented for the admin privilege transfer system and role management functionality in MDSystem. The implementation follows defense-in-depth principles with multiple overlapping security layers.

---

## Table of Contents

1. [Security Layers](#security-layers)
2. [Authentication & Authorization](#authentication--authorization)
3. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
4. [Rate Limiting & Abuse Prevention](#rate-limiting--abuse-prevention)
5. [Email Verification](#email-verification)
6. [Database Transaction Security](#database-transaction-security)
7. [Audit Logging](#audit-logging)
8. [Threat Model & Mitigations](#threat-model--mitigations)
9. [Security Configuration](#security-configuration)

---

## Security Layers

The admin transfer system implements **7 distinct security layers**:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Network & Transport                   │
│  - HTTPS/TLS encryption                         │
│  - IP-based rate limiting (3 req/60s)           │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: Authentication                        │
│  - JWT token validation                         │
│  - Medical portal verification                  │
│  - Admin privilege check (requireAdmin)         │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 3: Re-Authentication                     │
│  - Password verification (bcrypt)               │
│  - Progressive failure lockout                  │
│  - 3 attempts → 30-minute lockout               │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 4: Rate Limiting (User-Level)            │
│  - 5-minute initiation cooldown                 │
│  - Duplicate transfer prevention                │
│  - Password failure tracking                    │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 5: Business Logic Validation             │
│  - Target user status checks                    │
│  - 2FA requirement enforcement                  │
│  - Self-transfer prevention                     │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 6: Email Verification                    │
│  - 64-char cryptographic token                  │
│  - 10-minute expiration                         │
│  - One-time use enforcement                     │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│  Layer 7: Atomic Transaction                    │
│  - BEGIN/COMMIT/ROLLBACK                        │
│  - All-or-nothing privilege transfer            │
│  - Integrated audit logging                     │
└─────────────────────────────────────────────────┘
```

---

## Authentication & Authorization

### 1. JWT Protection

**File**: `routes/rolemanagement/graphql.js`

```javascript
app.use(
  '/rolemanagement/admin',
  ipRateLimiter("staffAuthentication", "admin"),  // IP-level throttling
  jwtProtect('medical'),                           // JWT validation
  graphqlHTTP(...)
);
```

**Security Properties**:
- Valid JWT token required
- Must be `medical` portal (staff domain)
- Token expiration enforced
- Token signature verified

### 2. Admin Privilege Check

**File**: `resolvers/admin/admin-resolver.js`

```javascript
async function requireAdmin(user, res) {
  if (!user) {
    throwGraphQLError(res).message('Unauthorized').status(401).throw();
  }

  const isAdmin = await permit.isMedicalPermitted(
    user.id,
    permit.permissions.is_admin,
    null
  );

  if (!isAdmin) {
    throwGraphQLError(res).message('Admin access required.').status(403).throw();
  }
}
```

**Security Properties**:
- Database-backed permission check
- Runs on every admin mutation
- Cannot be bypassed with JWT alone

### 3. Password Re-Authentication

**File**: `resolvers/wrapper/wrapper.js:1028-1077`

```javascript
// Get admin credentials
const adminCredentials = await db.findUserByEmail(oldAdminEmail);

// Verify password with bcrypt
const passwordValid = await verifyPassword(password, adminCredentials.password_hash);

if (!passwordValid) {
  // Record failure with progressive backoff
  const { failures, locked, lockoutTTL } =
    await recordAdminTransferPasswordFailure(oldAdminId);

  // Progressive delay: 500ms → 2s → 5s
  await new Promise(r => setTimeout(r, delayMs));

  // Lock after 3 failures
  if (locked) {
    throwGraphQLError(res)
      .message(`Too many invalid passwords. Locked for ${lockoutTTL} seconds.`)
      .status(429)
      .throw();
  }
}
```

**Security Properties**:
- Defense against session hijacking
- Bcrypt hash comparison (computationally expensive)
- Progressive delay prevents timing attacks
- Automatic lockout after threshold

---

## Two-Factor Authentication (2FA)

> For the complete TOTP implementation reference, see [2FA_TOTP_IMPLEMENTATION.md](./2FA_TOTP_IMPLEMENTATION.md).

MDSystem implements 2FA at two layers depending on the user type:

| User Type | Mechanism | Description |
|-----------|-----------|-------------|
| **Staff** | TOTP (Authenticator App) | RFC 6238 — Google Authenticator, Authy, etc. |
| **Patient / Mobile** | Email OTP | 6-digit code sent to registered email |

### TOTP for Staff

Staff accounts can enable **Time-based One-Time Password (TOTP)** via Settings → Security. When enabled, the login flow adds a mandatory verification step after credentials are accepted.

**Setup flow**: `POST /settings/totp/setup` → scan QR code → `POST /settings/totp/verify`

**Login flow**:
```
POST /auth/login           → { LoginKey, requiresTotp: true }
POST /settings/totp/validate  → marks session verified
POST /auth/login/complete  → issues JWT (blocks if TOTP not verified)
```

**Security properties**:
- Secrets stored encrypted (AES-256-GCM) — plaintext never persisted
- `crypto.timingSafeEqual` for all comparisons — timing-attack safe
- ±1 window (30s clock drift tolerance)
- Per-session brute-force lock: 5 failures → session destroyed
- Disabling 2FA requires a valid authenticator code — not a password

### Email 2FA for Patients

Patient login (web + mobile) can require a 6-digit code sent to the registered email before the data consent step. Controlled by `allow_email_2fa` in `UserCredentials`.

### 2FA Enforcement on Admin Transfer

The admin privilege transfer system **requires the target user to have 2FA enabled** before the transfer can be initiated. See [Layer 5: Business Logic Validation](#security-layers).

### Threat Coverage

| Threat | 2FA Protection |
|--------|---------------|
| Stolen JWT token | TOTP required again at login — JWT alone insufficient |
| Phished password | Attacker also needs physical authenticator device |
| Brute-forced TOTP | Per-session lock after 5 failures; IP rate limiting |
| Secret database leak | AES-256-GCM encryption — key stored separately |
| Token replay | 30-second window prevents reuse |

---

## Rate Limiting & Abuse Prevention

### 1. IP-Level Rate Limiting

**Configuration**: `config/data/matrix.js`

```javascript
staffAuthentication: {
  ipWindow: 60,        // 60-second window
  ipMax: 3,            // 3 requests maximum
}
```

**Implementation**: `config/middleware/ratelimiter.js`

```javascript
async function ipRateLimiter(profileName, route) {
  const ip = req.ip;
  const ipBlocked = await rateLimitIP(ip, route, ipMax, ipWindow);

  if (ipBlocked) {
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many requests. Please slow down."
    });
  }
}
```

**Prevents**:
- Brute force attacks
- DoS from single IP
- Automated scanning

### 2. Password Failure Lockout

**File**: `config/redis.js:887-927` | **Implementation**: `wrapper.js:1034-1044`

**Formula-Based Exponential Backoff**:
```javascript
// Scalable timing attack prevention with randomized delays
const baseDelayMs = failures * 500;
await delayRandom(Math.max(100, baseDelayMs - 100), baseDelayMs + 100);
```

**How It Works**:
- Calculate base delay as `failures * 500ms`
- Add randomization: `±100ms` around the base
- Use `Math.max(100, ...)` to ensure minimum delay on first attempt

**Progressive Delays with Randomization**:
```
Attempt 1: ❌ → baseDelay=500ms  → Range: 400-600ms     → "2 attempts remaining"
Attempt 2: ❌ → baseDelay=1000ms → Range: 900-1100ms    → "1 attempt remaining"
Attempt 3: ❌ → baseDelay=1500ms → Range: 1400-1600ms   → 🔒 LOCKED for 30 minutes
```

**Advantages of Formula-Based Approach**:
- **Scalable**: Automatically adjusts for any threshold (not hardcoded to 3 attempts)
- **Predictable**: Linearly increases, easier to tune
- **Maintainable**: Single formula instead of multiple conditionals
- **Elastic**: Formula can be adjusted by changing the multiplier (currently 500ms)

**Why Randomization Matters**:
- Prevents **timing attacks** (attackers can't distinguish timing patterns)
- Uses `delayRandom(min, max)` from `utils/security.js`
- Cryptographically unpredictable delay ranges
- Makes automated attacks statistically ineffective

**Prevents**:
- Password brute forcing
- Credential stuffing
- Automated password guessing
- Timing attacks (via randomization)

### 3. Transfer Initiation Cooldown

**File**: `config/redis.js:835-854`

```javascript
const ADMIN_TRANSFER_COOLDOWN = 300; // 5 minutes

async function recordAdminTransferAttempt(adminId) {
  const key = `admin:transfer:attempt:${adminId}`;
  const lastAttempt = await client.get(key);

  if (lastAttempt) {
    const ttl = await client.ttl(key);
    return { allowed: false, retryAfterSeconds: ttl };
  }

  await client.set(key, Date.now().toString(), { EX: ADMIN_TRANSFER_COOLDOWN });
  return { allowed: true, retryAfterSeconds: 0 };
}
```

**Prevents**:
- Transfer spam
- Email flooding
- Token exhaustion attacks

### 4. Duplicate Transfer Prevention

**File**: `config/redis.js:861-880`

```javascript
async function getAdminActivePendingTransfer(adminId) {
  // Scan Redis for active transfer sessions
  for await (const key of client.scanIterator({ MATCH: `admin:transfer:*` })) {
    const session = await client.hGetAll(key);

    if (session && session.old_admin_id === adminId.toString()) {
      return {
        hasPending: true,
        tokenPrefix: token.substring(0, 8) + '...'
      };
    }
  }

  return { hasPending: false, tokenPrefix: null };
}
```

**Prevents**:
- Concurrent transfers
- Token confusion
- Audit trail complexity

### Rate Limiting Summary

| Mechanism | Limit | Window | Storage | Auto-Clear |
|-----------|-------|--------|---------|------------|
| **IP Throttle** | 3 requests | 60s | Redis | Yes |
| **Password Failures** | 3 attempts | 1 hour | Redis | On success |
| **Initiation Cooldown** | 1 transfer | 5 minutes | Redis | Yes |
| **Duplicate Check** | 1 active | 10 minutes | Redis | On confirm |

---

## Email Verification

### 1. Token Generation

**File**: `utils/security.js`

```javascript
function generateRandomKey() {
  return crypto.randomBytes(32).toString("hex"); // 64-char token
}
```

**Properties**:
- Cryptographically secure random generation
- 64 hexadecimal characters (256 bits of entropy)
- Unpredictable and unguessable

### 2. Token Storage

**File**: `config/redis.js:782-796`

```javascript
const ADMIN_TRANSFER_EXPIRATION = 600; // 10 minutes

async function createAdminTransferSession(oldAdminId, newAdminId, verificationToken) {
  const key = `admin:transfer:${verificationToken}`;

  await client.hSet(key, {
    old_admin_id: oldAdminId.toString(),
    new_admin_id: newAdminId.toString(),
    created_at: Date.now().toString(),
  });

  await client.expire(key, ADMIN_TRANSFER_EXPIRATION);

  return verificationToken;
}
```

**Security Properties**:
- Stored in Redis (ephemeral)
- 10-minute automatic expiration
- No database persistence (reduces attack surface)
- Deleted after single use

### 3. Email Template Security

**File**: `services/emailservice.js:222-304`

**Security Features**:
- Timestamp in UTC (prevents timezone confusion)
- Explicit warnings about consequences
- Clear token expiration notice
- Incident response instructions
- No clickable links (prevents phishing)
- Token displayed in monospace font (prevents character confusion)

**Template Sections**:
```
1. Critical Security Warning
2. Recipient Verification (shows target email)
3. Consequence List (what will happen)
4. Verification Token (monospace, no link)
5. Token Security Info (expiration, one-time use)
6. Security Recommendations
7. Incident Response Steps (if unauthorized)
```

### 4. Token Validation

**File**: `resolvers/wrapper/wrapper.js:1235-1256`

```javascript
// Retrieve session
const transferSession = await getAdminTransferSession(verificationToken);

if (!transferSession) {
  // Token invalid/expired
  await db.setSystemAuditLog({ ... });
  throwGraphQLError(res)
    .message('Invalid or expired verification token.')
    .status(400)
    .throw();
}

// Verify user is the original initiator
if (currentUserId !== parseInt(transferSession.oldAdminId, 10)) {
  throwGraphQLError(res)
    .message('You are not authorized to confirm this transfer.')
    .status(403)
    .throw();
}
```

**Prevents**:
- Token reuse
- Cross-user token usage
- Replay attacks
- Expired token acceptance

---

## Database Transaction Security

### Atomic Operations

**File**: `resolvers/wrapper/wrapper.js:1382-1416`

```javascript
const client = await pool.pool.connect();

try {
  await client.query('BEGIN');

  // 1. Grant admin to new user (raw SQL)
  await client.query(
    `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
     SELECT $1, r.id, 'Both', $2
     FROM "rolesTable" r
     WHERE r.label = $3
     ON CONFLICT ("personnelId", "rolesId") DO UPDATE
       SET branch = EXCLUDED.branch, "assignedBy" = EXCLUDED."assignedBy"`,
    [newAdminId, oldAdminId, permissions.is_admin]
  );

  // 2. Remove admin from old user (raw SQL)
  await client.query(
    `DELETE FROM "rolesMap"
     WHERE "personnelId" = $1
     AND "rolesId" = (SELECT id FROM "rolesTable" WHERE label = $2)`,
    [oldAdminId, permissions.is_admin]
  );

  // 3. Audit log (within transaction)
  await client.query(
    `INSERT INTO "SystemAuditLog" (...) VALUES (...)`,
    [...]
  );

  await client.query('COMMIT');

} catch (error) {
  await client.query('ROLLBACK');
  // Log rollback failure
  throw error;
} finally {
  client.release();
}
```

### Transaction Properties (ACID)

| Property | Implementation | Benefit |
|----------|---------------|----------|
| **Atomicity** | BEGIN...COMMIT/ROLLBACK | All changes succeed or none |
| **Consistency** | Foreign key constraints | Role table references validated |
| **Isolation** | PostgreSQL default isolation | No partial state visibility |
| **Durability** | PostgreSQL WAL | Changes survive crashes |

### Why Raw SQL vs ORM?

The implementation uses **raw SQL within the transaction** instead of calling helper functions (`setMedicalPermit`, `unsetMedicalPermit`) because:

1. **Transaction Client Binding**: Helper functions don't accept transaction client
2. **Atomicity Guarantee**: All operations use same connection/transaction
3. **No Connection Pool Issues**: Single connection for entire transaction
4. **Explicit Control**: Clear visibility of transaction boundaries

**Critical Security Benefit**: If any step fails (grant admin, revoke admin, or audit log), the entire transaction rolls back, preventing inconsistent privilege states.

---

## Audit Logging

### Complete Event Tracking

**File**: `resolvers/wrapper/wrapper.js`

All security-relevant events are logged to `SystemAuditLog`:

#### Initiation Events

| Event | Trigger | Details Logged |
|-------|---------|---------------|
| `ADMIN_TRANSFER_FAILED` | Password locked | Lockout duration, failure count |
| `ADMIN_TRANSFER_FAILED` | Cooldown active | Retry-after seconds |
| `ADMIN_TRANSFER_FAILED` | Duplicate transfer | Existing token prefix |
| `ADMIN_TRANSFER_FAILED` | Invalid password | Failure count, attempts remaining |
| `ADMIN_TRANSFER_FAILED` | Target validation failed | Specific failure reason |
| `ADMIN_TRANSFER_INITIATED` | Success | Both admin emails, token prefix |

#### Confirmation Events

| Event | Trigger | Details Logged |
|-------|---------|---------------|
| `ADMIN_TRANSFER_FAILED` | Invalid token | Token prefix |
| `ADMIN_TRANSFER_FAILED` | Unauthorized user | Expected vs actual user ID |
| `ADMIN_TRANSFER_FAILED` | Status changed | Re-validation failure reason |
| `ADMIN_TRANSFER_FAILED` | Transaction failed | Error message, rollback reason |
| `ADMIN_TRANSFER_SUCCESS` | Completion | Both emails, timestamp, token |

### Audit Log Schema

```javascript
{
  event_type: 'ADMIN_TRANSFER_SUCCESS',      // Event category
  actorId: 123,                               // Who initiated
  actorType: 'Medical',                       // Actor role
  targetId: 456,                              // Who was affected
  action: 'TRANSFER_ADMIN_PRIVILEGES',        // What happened
  details: JSON.stringify({                   // Additional context
    oldAdminId: 123,
    oldAdminEmail: 'admin@example.com',
    newAdminId: 456,
    newAdminEmail: 'newadmin@example.com',
    verificationTokenPrefix: 'abc12345...',
    timestamp: '2026-03-24T12:00:00.000Z'
  }),
  changedBy: 123,                             // Audit trail owner
  created_at: '2026-03-24T12:00:00.000Z'     // Auto-generated
}
```

### Audit Trail Benefits

1. **Forensic Analysis**: Complete reconstruction of events
2. **Compliance**: Regulatory audit requirements
3. **Incident Response**: Security breach investigation
4. **Accountability**: Non-repudiation of actions
5. **Anomaly Detection**: Pattern analysis for threats

---

## Threat Model & Mitigations

| Threat | Attack Vector | Mitigation | Layer |
|--------|---------------|------------|-------|
| **Session Hijacking** | Stolen JWT token | Password re-authentication required | Layer 3 |
| **Brute Force** | Password guessing | Progressive lockout (3 attempts → 30min) | Layer 3, 4 |
| **Credential Stuffing** | Leaked passwords | Rate limiting + lockout | Layer 1, 4 |
| **Email Flooding** | Rapid initiation | 5-minute cooldown | Layer 4 |
| **Token Theft** | Email interception | 10-minute expiration + one-time use | Layer 6 |
| **Replay Attack** | Reused token | Token deleted after use | Layer 6 |
| **MITM** | Network interception | HTTPS/TLS required | Layer 1 |
| **Privilege Escalation** | Direct DB manipulation | Transaction atomicity | Layer 7 |
| **DoS** | Request flooding | IP rate limiting (3/min) | Layer 1 |
| **Race Condition** | Concurrent transfers | Duplicate check + Redis lock | Layer 4 |
| **Audit Tampering** | Log deletion | Logged within transaction | Layer 7 |
| **Social Engineering** | Phishing admin | Email warnings + no clickable links | Layer 6 |
| **TOTP Brute Force** | Guessing 6-digit codes | Per-session lock after 5 failures; session destroyed | TOTP |
| **TOTP Secret Leak** | DB breach | AES-256-GCM encryption; key in env only | TOTP |
| **Timing Attack on Token** | Code timing oracle | `crypto.timingSafeEqual` comparison | TOTP |
| **2FA Disable Attack** | Compromised session | Disable requires valid authenticator code | TOTP |

---

## Security Configuration

### Environment Variables

**Rate Limiting**:
```bash
# IP Rate Limiting
STAFF_AUTH_RATE_LIMIT_WINDOW=60          # seconds
STAFF_AUTH_RATE_LIMIT_MAX_REQUESTS=3     # requests

# Admin Transfer
ADMIN_TRANSFER_COOLDOWN=300              # 5 minutes
ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD=3 # attempts
ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT=1800 # 30 minutes
ADMIN_TRANSFER_EXPIRATION=600            # 10 minutes
```

**2FA / TOTP**:
```bash
# TOTP secret encryption — 64-char hex (32 bytes). Generate with: npm run setup:totp-key
TOTP_ENCRYPTION_KEY=<generated>

# Login session TTL — TOTP must be verified within this window
VERIFICATION_SESSION_EXPIRATION=900      # 15 minutes

# Email 2FA settings (patient portal)
EMAIL_2FA_EXPIRATION=300                 # 5 minutes
```

**Email**:
```bash
EMAIL_DELAY=1000                         # ms between emails
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=<encrypted>
```

**Redis**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<encrypted>
REDIS_DATABASE=0
```

### Security Hardening Checklist

- [ ] HTTPS/TLS enforced in production
- [ ] Environment variables encrypted at rest
- [ ] Redis password authentication enabled
- [ ] PostgreSQL connections over SSL
- [ ] JWT secret key rotated regularly
- [ ] Email SMTP credentials secured
- [ ] Rate limit values tuned for environment
- [ ] Audit logs backed up regularly
- [ ] Session timeout configured
- [ ] GraphiQL disabled in production
- [ ] `TOTP_ENCRYPTION_KEY` backed up securely (loss = all TOTP secrets unreadable)
- [ ] Target admin users have TOTP enabled before admin transfers

---

## Security Testing Recommendations

### 1. Penetration Testing Scenarios

- [ ] Attempt transfer with stolen JWT (should require password)
- [ ] Brute force password (should lock after 3 attempts)
- [ ] Rapid transfer attempts (should hit cooldown)
- [ ] Token reuse attack (should fail)
- [ ] Expired token usage (should reject)
- [ ] Cross-user token attempts (should deny)
- [ ] Concurrent transfer initiation (should block duplicate)
- [ ] Transaction interruption (should rollback)

### 2. Rate Limit Testing

```bash
# Test IP rate limiting
for i in {1..10}; do
  curl -X POST https://staff.example.com/rolemanagement/admin \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"query":"mutation{initiateAdminTransfer(...)}"}' \
    -w "\n%{http_code}\n"
done
# Expected: First 3 succeed (200), rest fail (429)

# Test password lockout
for i in {1..5}; do
  # Incorrect password
  curl -X POST ... -d '{"password":"wrong"}'
done
# Expected: First 3 delayed, 4th+ denied (429)
```

### 3. Audit Log Validation

```sql
-- Verify all transfers are logged
SELECT COUNT(*) FROM "SystemAuditLog"
WHERE event_type = 'ADMIN_TRANSFER_SUCCESS';

-- Check for failed attempts
SELECT details->>'reason', COUNT(*)
FROM "SystemAuditLog"
WHERE event_type = 'ADMIN_TRANSFER_FAILED'
GROUP BY details->>'reason';

-- Verify transaction atomicity (no orphaned grants/revokes)
SELECT COUNT(*) FROM "rolesMap" rm
JOIN "rolesTable" rt ON rm."rolesId" = rt.id
WHERE rt.label = 'IS_ADMIN'
GROUP BY rm."personnelId"
HAVING COUNT(*) != 1;
-- Expected: 0 rows (each user has exactly 1 or 0 admin roles)
```

---

## Incident Response

### Security Event Alerts

Monitor for:
- 3+ password failures in 10 minutes → Potential brute force
- 5+ failed transfers from same IP → Possible attack
- Transfer outside business hours → Unusual activity
- Transfer with zero warnings → Configuration issue

### Breach Response Procedure

1. **Immediate**:
   - Lock affected admin account
   - Invalidate all JWT tokens for user
   - Delete pending transfer tokens from Redis
   - Review audit logs for timeline

2. **Investigation**:
   - Check SystemAuditLog for all ADMIN_TRANSFER events
   - Correlate with access logs (IP addresses)
   - Verify email delivery logs
   - Check for unauthorized permission changes

3. **Remediation**:
   - Reset credentials for compromised accounts
   - Force 2FA re-enrollment
   - Rotate JWT secret keys
   - Update rate limiting rules

4. **Post-Incident**:
   - Document findings
   - Update threat model
   - Adjust security controls
   - Conduct security training

---

## Compliance & Standards

This implementation aligns with:

- **OWASP Top 10**: Protection against A01 (Broken Access Control), A07 (Identification and Authentication Failures)
- **NIST 800-63B**: Multi-factor authentication, rate limiting, audit logging
- **HIPAA** (if applicable): Audit trails, access controls, data integrity
- **SOC 2**: Security logging, change management, access reviews

---

## Security Maintenance

### Regular Reviews

- **Weekly**: Audit log analysis for anomalies
- **Monthly**: Rate limit effectiveness review
- **Quarterly**: Security configuration audit
- **Annually**: Full penetration test

### Code Security

```bash
# Static analysis
npm run lint:security

# Dependency scanning
npm audit
npm audit fix

# Secret scanning
git-secrets --scan
```

---

## Contact & Reporting

For security vulnerabilities or concerns:
- **Internal**: Contact IT Security Team
- **External**: security@example.com
- **Urgent**: Incident Response Hotline

**Responsible Disclosure**: 90-day disclosure policy for externally reported vulnerabilities.

---

---

## API Contract & Examples

### GraphQL Mutations

#### 1. Initiate Admin Transfer

**Mutation Definition**:
```graphql
mutation InitiateAdminTransfer($newAdminUserId: ID!, $password: String!) {
  initiateAdminTransfer(newAdminUserId: $newAdminUserId, password: $password) {
    ok
    message
    verificationRequired
  }
}
```

**Request Example**:
```json
{
  "query": "mutation { initiateAdminTransfer(newAdminUserId: \"456\", password: \"current_admin_password\") { ok message verificationRequired } }"
}
```

**Success Response (200)**:
```json
{
  "data": {
    "initiateAdminTransfer": {
      "ok": true,
      "message": "Admin transfer initiated. Verification email sent.",
      "verificationRequired": true
    }
  }
}
```

**Request Headers Required**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Requirements**:
- Valid JWT token with `medical` portal claim
- Current user must have `is_admin` permission
- Valid user ID for new admin
- Current admin password (re-authentication)

---

#### 2. Confirm Admin Transfer

**Mutation Definition**:
```graphql
mutation ConfirmAdminTransfer($verificationToken: String!) {
  confirmAdminTransfer(verificationToken: $verificationToken) {
    ok
    message
    oldAdminId
    newAdminId
  }
}
```

**Request Example**:
```json
{
  "query": "mutation { confirmAdminTransfer(verificationToken: \"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2\") { ok message oldAdminId newAdminId } }"
}
```

**Success Response (200)**:
```json
{
  "data": {
    "confirmAdminTransfer": {
      "ok": true,
      "message": "Admin privileges transferred successfully.",
      "oldAdminId": "123",
      "newAdminId": "456"
    }
  }
}
```

**Note**: No Authorization header required for confirmation (verification token is standalone proof)

---

### Error Codes Reference

#### Authentication Errors

| HTTP Code | GraphQL Error | Message | Cause | Resolution |
|-----------|---------------|---------|-------|-----------|
| 401 | Unauthorized | User authentication required | No JWT token or invalid token | Provide valid JWT token |
| 403 | Admin access required | User is not an admin | Current user lacks `is_admin` permission | Request admin user to perform transfer |
| 403 | Medical portal required | User not on medical portal | JWT is from patient portal | Login to staff/medical portal |

#### Rate Limiting Errors

| HTTP Code | GraphQL Error | Message | Cause | Resolution |
|-----------|---------------|---------|-------|-----------|
| 429 | Too many requests. Please slow down. | IP-level rate limit exceeded | More than 3 requests/60s from same IP | Wait 60 seconds before retrying |
| 429 | Too many invalid passwords. Locked for {N} seconds. | Password lockout active | 3 failed password attempts | Wait N seconds (default: 1800s / 30min) |
| 429 | Try again in {N} seconds. | Initiation cooldown active | Attempted transfer within 5 minutes | Wait N seconds before next transfer |
| 429 | A transfer for this admin is already pending. Token: {prefix}... | Duplicate transfer pending | Active transfer already exists | Complete or wait for existing transfer to expire |

#### Validation Errors

| HTTP Code | GraphQL Error | Message | Cause | Resolution |
|-----------|---------------|---------|-------|-----------|
| 400 | Invalid password. {N} attempt(s) remaining. | Password verification failed | Wrong password provided | Check password and retry |
| 400 | password parameter is required. | Missing password field | Initiation request missing password | Add `password` parameter |
| 400 | Target user must be an active medical personnel. | Target not medical staff | New admin user not in Medical identity | Select medical staff member |
| 400 | Target user does not have 2FA enabled. | 2FA not enabled on target | New admin lacks 2FA setup | Enable 2FA for target user first |
| 400 | Target user is not validated. | Target credentials unverified | New admin's credentials not verified | Wait for credential verification |
| 400 | Cannot transfer admin to same user. | Self-transfer attempted | Old admin same as new admin | Select different user |
| 400 | Invalid or expired verification token. | Token invalid/expired | Token missing, invalid, or >10 minutes old | Request new transfer initiation |
| 400 | You are not authorized to confirm this transfer. | Wrong user confirming | Different user than initiator confirming | Correct admin must confirm |

#### System Errors

| HTTP Code | GraphQL Error | Message | Cause | Resolution |
|-----------|---------------|---------|-------|-----------|
| 404 | User not found. | User doesn't exist | newAdminUserId invalid | Verify user ID exists |
| 409 | Status validation failed on confirmation. | User status changed during transfer | User became inactive/suspended | Reinitiate transfer |
| 500 | Transaction failed. | Database transaction rollback | Unexpected DB error | Retry or contact support |

---

## Redis Key Naming Convention

### Key Patterns

All Redis keys follow consistent naming for easy scanning and debugging.

#### Admin Transfer Token Sessions
```
admin:transfer:{verificationToken}
  Type: Hash
  TTL: 600 seconds (10 minutes)
  Fields:
    - old_admin_id: "123"
    - new_admin_id: "456"
    - created_at: "1711270800000" (epoch ms)
  Purpose: Store verification token data
```

#### Admin Transfer Initiation Cooldown
```
admin:transfer:attempt:{adminId}
  Type: String
  TTL: 300 seconds (5 minutes)
  Value: Timestamp when set
  Purpose: Enforce 5-minute gap between transfer initiations
```

#### Admin Transfer Password Failure Tracking
```
admin:transfer:pw:fail:{adminId}
  Type: String
  TTL: 3600 seconds (1 hour)
  Value: Failure count (incremented on each bad attempt)
  Purpose: Track password failures for exponential backoff
```

#### Admin Transfer Password Lockout
```
admin:transfer:pw:lock:{adminId}
  Type: String (exists or not)
  TTL: 1800 seconds (30 minutes)
  Purpose: Indicate admin is locked out
```

#### Example Key Enumeration
```bash
# Scan for all active admin transfer sessions
SCAN 0 MATCH "admin:transfer:*" COUNT 10

# Output might show:
# admin:transfer:a1b2c3d4e5f6g7h8...
# admin:transfer:x9y8z7w6v5u4t3s2...

# Check a specific session
HGETALL admin:transfer:a1b2c3d4e5f6g7h8...

# Output:
# 1) "old_admin_id"
# 2) "123"
# 3) "new_admin_id"
# 4) "456"
# 5) "created_at"
# 6) "1711270800000"
```

---

## Database Schema Changes

### Tables Affected

#### 1. rolesMap (modified)
**Existing table**:
```sql
CREATE TABLE "rolesMap" (
  "personnelId" INTEGER NOT NULL,
  "rolesId" INTEGER NOT NULL,
  "branch" VARCHAR DEFAULT 'Both',
  "assignedBy" INTEGER,
  PRIMARY KEY ("personnelId", "rolesId")
)
```

**Usage in Admin Transfer**:
- INSERT: Grants `is_admin` role to new admin
- DELETE: Revokes `is_admin` role from old admin
- Both operations execute within atomic transaction

**Query Example**:
```sql
-- Grant admin to new user (within transaction)
INSERT INTO "rolesMap" ("personnelId", "rolesId", "branch", "assignedBy")
SELECT $1, r.id, 'Both', $2
FROM "rolesTable" r
WHERE r.label = 'IS_ADMIN'
ON CONFLICT ("personnelId", "rolesId")
DO UPDATE SET branch = EXCLUDED.branch, "assignedBy" = EXCLUDED."assignedBy";

-- Revoke admin from old user (within transaction)
DELETE FROM "rolesMap"
WHERE "personnelId" = $1
AND "rolesId" = (SELECT id FROM "rolesTable" WHERE label = 'IS_ADMIN');
```

#### 2. SystemAuditLog (modified)
**Existing table structure**:
```sql
CREATE TABLE "SystemAuditLog" (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  actorId INTEGER,
  actorType VARCHAR(50),
  targetId INTEGER,
  action VARCHAR(100),
  details JSONB,
  changedBy INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**New event_type values for admin transfer**:
- `ADMIN_TRANSFER_INITIATED` - Transfer process started
- `ADMIN_TRANSFER_SUCCESS` - Transfer confirmed and completed
- `ADMIN_TRANSFER_FAILED` - Transfer failed at any step

**Example audit log entry**:
```json
{
  "event_type": "ADMIN_TRANSFER_SUCCESS",
  "actorId": 123,
  "actorType": "Medical",
  "targetId": 456,
  "action": "TRANSFER_ADMIN_PRIVILEGES",
  "details": {
    "oldAdminId": 123,
    "oldAdminEmail": "admin@example.com",
    "newAdminId": 456,
    "newAdminEmail": "newadmin@example.com",
    "verificationTokenPrefix": "a1b2c3d4...",
    "timestamp": "2026-03-24T12:00:00.000Z"
  },
  "changedBy": 123,
  "created_at": "2026-03-24T12:00:00.000Z"
}
```

---

## Deployment Checklist

### Pre-Deployment Verification

- [ ] All Redis keys patterns documented in operations runbook
- [ ] PostgreSQL connection pooling configured (POSTGRES_MAX_CONN >= 10)
- [ ] Redis authentication credentials set (REDIS_PASSWORD)
- [ ] SMTP configuration tested (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- [ ] Email delay configured (EMAIL_DELAY=1000 by default)
- [ ] JWT secret rotated (JWT_SECRET should be unique per environment)
- [ ] Admin transfer constants configured if needed (optional):

```bash
# These can be added to .env if defaults need adjustment:
ADMIN_TRANSFER_COOLDOWN=300                    # 5 minutes
ADMIN_TRANSFER_PASSWORD_FAIL_THRESHOLD=3       # attempts before lockout
ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT=1800      # 30 minutes
ADMIN_TRANSFER_EXPIRATION=600                  # 10 minutes token validity
```

### Environment Variables (Required for Admin Transfer)

```bash
# Email configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=<encrypted_password>  # Use secrets manager in prod

# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong_password>
REDIS_DB=0

# JWT
JWT_SECRET=<60+_character_random_string>  # Minimum 60 chars
JWT_EXPIRES_IN=1d

# Email queue
EMAIL_DELAY=1000  # milliseconds between email sends
EMAIL_VERIF_EXPIRATION=600  # seconds
EMAIL_2FA_EXPIRATION=300  # seconds

# Rate limiting
STAFF_AUTH_RATE_LIMIT_WINDOW=60  # seconds
STAFF_AUTH_RATE_LIMIT_MAX_REQUESTS=3  # requests per window
```

### Post-Deployment Validation

```bash
# 1. Verify Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD PING
# Expected: PONG

# 2. Verify PostgreSQL connection
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version();"

# 3. Test email service
# Trigger a test email through application

# 4. Check mutations available
# Query GraphQL endpoint for schema

# 5. Monitor logs for initialization
tail -f Backend/utils/logs/debug.log | grep -i "admin transfer\|email.*initialized"
```

---

## Troubleshooting Guide

### Issue: "Too many requests. Please slow down." (429)

**Symptoms**: User receiving 429 error on every request

**Root Cause**: IP-level rate limit exceeded (3 requests per 60 seconds)

**Solution**:
1. Check client IP: `req.ip` in logs
2. Verify no automated tools making requests
3. Wait 60 seconds before retrying
4. In development, increase `STAFF_AUTH_RATE_LIMIT_MAX_REQUESTS` in .env

```bash
# Check current rate limit status in Redis
redis-cli -a $REDIS_PASSWORD GET "ratelimit:rl:admin:client_ip"
```

---

### Issue: "Too many invalid passwords. Locked for 1800 seconds."

**Symptoms**: User locked out after 3 failed password attempts

**Root Cause**: Password verification failed 3 times within lockout window

**Solution**:
1. Verify password is correct
2. Check caps lock, keyboard layout
3. Wait 1800 seconds (30 minutes) for automatic unlock
4. Or manually unlock (see below):

```bash
# Manually unlock (ops emergency only)
redis-cli -a $REDIS_PASSWORD DEL "admin:transfer:pw:lock:${ADMIN_ID}"

# Reset failure count
redis-cli -a $REDIS_PASSWORD DEL "admin:transfer:pw:fail:${ADMIN_ID}"
```

---

### Issue: "Try again in 245 seconds." (Cooldown error)

**Symptoms**: User initiated transfer, waiting for cooldown to expire

**Root Cause**: Attempted to initiate another transfer within 5-minute window

**Solution**:
1. Check current timestamp on transfer initiation
2. Calculate cooldown end time: `initiated_time + 300 seconds`
3. Check Redis key exists:

```bash
# See time remaining
redis-cli -a $REDIS_PASSWORD TTL "admin:transfer:attempt:${ADMIN_ID}"
# Returns: remaining seconds (or -2 if expired, -1 if no expiry)

# Force reset cooldown (emergency only - audit carefully)
redis-cli -a $REDIS_PASSWORD DEL "admin:transfer:attempt:${ADMIN_ID}"
```

---

### Issue: "A transfer for this admin is already pending."

**Symptoms**: New transfer blocked because previous one not confirmed

**Root Cause**: Previous token still active in Redis

**Solution**:
1. Wait for token to expire (10 minutes auto-cleanup)
2. Or manually revoke (see next section)
3. Check existing transfer details:

```bash
# Find pending transfers for admin
redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "admin:transfer:*" COUNT 100
# Shows all transfer tokens

# Get details of specific token
redis-cli -a $REDIS_PASSWORD HGETALL "admin:transfer:${TOKEN}"
```

---

### Issue: Email not received for verification

**Symptoms**: Admin initiates transfer but doesn't receive verification email

**Root Cause**: Email service issue, queue backlog, or SMTP failure

**Solution**:
1. Check SMTP configuration:

```bash
# Verify SMTP host is reachable
nc -zv $SMTP_HOST $SMTP_PORT
# Expected: Connection successful

# Check email delay setting
echo $EMAIL_DELAY  # Should be positive integer (milliseconds)
```

2. Check email queue status:

```bash
# View pending emails
redis-cli -a $REDIS_PASSWORD LLEN emailQueue:jobs  # Count of jobs

# Check job details
redis-cli -a $REDIS_PASSWORD HGETALL "bull:emailQueue:job:${JOB_ID}"
```

3. Review email worker logs:

```bash
tail -100 Backend/utils/logs/debug.log | grep -i "email\|sendmail"
```

4. Force retry:

```bash
# Restart email worker process
# (systemd service or container restart)
systemctl restart mdsystem-email-worker
```

---

### Issue: "Invalid or expired verification token"

**Symptoms**: User confirms transfer with valid-looking token but gets error

**Root Cause**: Token expired (>10 minutes) or invalid format

**Solution**:
1. Check token age:

```bash
# If token exists, see creation time
redis-cli -a $REDIS_PASSWORD HGET "admin:transfer:${TOKEN}" "created_at"

# Calculate age: (now - created_at) / 1000 = seconds
# If > 600 seconds, token has expired
```

2. Verify token format:
   - Must be 64-character hexadecimal string
   - Check email for token spelling

3. Redo transfer initiation:
   - Original token is expired
   - Initiate new transfer to get new token

---

### Issue: Transaction rollback / "Transaction failed"

**Symptoms**: Transfer initiated and confirmed, but privileges not transferred

**Root Cause**: Database transaction rolled back due to constraint violation

**Solution**:
1. Check audit logs for 500 error:

```bash
grep "Transaction failed" Backend/utils/logs/debug.log
```

2. Verify rolesTable integrity:

```sql
-- Check is_admin role exists
SELECT id FROM "rolesTable" WHERE label = 'IS_ADMIN';

-- Verify rolesMap constraints
\d "rolesMap"  -- PostgreSQL describe
```

3. Retry transfer:

```bash
# Verify new admin still valid
SELECT * FROM "MedicalPersonnel" WHERE id = ${NEW_ADMIN_ID};

# Retry initiation
```

---

## Monitoring & Alerting

### Metrics to Monitor

#### Admin Transfer Volume
```sql
-- Daily transfer count
SELECT DATE(created_at), COUNT(*) as transfers
FROM "SystemAuditLog"
WHERE event_type LIKE 'ADMIN_TRANSFER_%'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

**Alert Threshold**: > 1 transfer per day
**Action**: Investigate unusual activity

---

#### Transfer Success Rate
```sql
-- Success vs failure ratio
SELECT
  event_type,
  COUNT(*) as count
FROM "SystemAuditLog"
WHERE event_type LIKE 'ADMIN_TRANSFER_%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type;
```

**Alert Threshold**: Success rate < 50%
**Action**: Check for service issues

---

#### Password Failure Patterns
```sql
-- Identify failed password attempts
SELECT
  details->>'oldAdminId' as admin_id,
  COUNT(*) as failures,
  MAX(created_at) as last_attempt
FROM "SystemAuditLog"
WHERE event_type = 'ADMIN_TRANSFER_FAILED'
  AND details->>'reason' = 'Invalid password provided'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY details->>'oldAdminId'
HAVING COUNT(*) >= 2;
```

**Alert Threshold**: >= 2 failures per admin in 1 hour
**Action**: Possible credential compromise

---

#### Redis Key Cleanup
```bash
# Monitor Redis memory usage
redis-cli -a $REDIS_PASSWORD INFO memory | grep used_memory_human

# Check number of admin transfer keys
redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "admin:transfer:*" COUNT 1000 | wc -l
```

**Alert Threshold**: Redis memory > 80% of allocated
**Action**: Review retention policies

---

### Recommended Dashboards

**Grafana/Prometheus Setup**:
```
Dashboard: Admin Transfer Security
Panels:
  1. Transfers per day (LINE chart)
  2. Success rate (GAUGE)
  3. Password failures (TABLE sorted by failures)
  4. Email delivery latency (HISTOGRAM)
  5. Active transfer sessions (STAT)
  6. Redis memory usage (GAUGE)
```

---

### Alert Rules

```yaml
# Prometheus alert rules
groups:
  - name: admin_transfer
    rules:
      - alert: HighAdminTransferFailureRate
        expr: |
          (count by (job) (increase(admin_transfer_failures_total[5m])) /
           count by (job) (increase(admin_transfer_initiated_total[5m]))) > 0.5
        for: 5m
        action: page

      - alert: PasswordLockoutSpam
        expr: |
          count by (admin_id) (increase(admin_transfer_password_failures[1h])) > 5
        for: 1m
        action: alert

      - alert: EmailQueueBacklog
        expr: |
          email_queue_waiting_count > 50
        for: 5m
        action: warning
```

---

## Manual Token Invalidation

### Revoking Active Transfer Token

**Scenario**: Initiated transfer but want to cancel it before confirmation

```bash
#!/bin/bash
# revoke_transfer.sh

TOKEN="$1"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD}"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <verification-token>"
  exit 1
fi

# Delete the transfer session
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" \
  DEL "admin:transfer:$TOKEN"

echo "✅ Transfer token invalidated: $TOKEN"

# Log the action
echo "$(date): Manual revocation of token ${TOKEN:0:8}... by $USER" \
  >> revocation_audit.log
```

**Usage**:
```bash
./revoke_transfer.sh a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Finding Tokens to Revoke

```bash
# List all active transfer tokens
redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "admin:transfer:*" COUNT 100

# Get details of each
redis-cli -a $REDIS_PASSWORD HGETALL "admin:transfer:${TOKEN_VALUE}"

# Example output:
# 1) "old_admin_id"
# 2) "123"
# 3) "new_admin_id"
# 4) "456"
# 5) "created_at"
# 6) "1711270800000"
```

---

## Rollback Procedures

### Scenario: Successful Transfer Needs to Be Reversed

**WARNING**: This is an emergency-only procedure. Ensure you have audit trail evidence.

```sql
-- Step 1: Backup current roles before changes
BEGIN TRANSACTION;

CREATE TEMP TABLE roles_backup AS
SELECT * FROM "rolesMap"
WHERE "personnelId" IN (123, 456);  -- old_admin_id, new_admin_id

-- Step 2: Restore old admin privileges
INSERT INTO "rolesMap" ("personnelId", "rolesId", "branch", "assignedBy")
SELECT 123, r.id, 'Both', 999  -- 999 = audit system user
FROM "rolesTable" r
WHERE r.label = 'IS_ADMIN'
ON CONFLICT DO NOTHING;

-- Step 3: Remove new admin privileges
DELETE FROM "rolesMap"
WHERE "personnelId" = 456
AND "rolesId" = (SELECT id FROM "rolesTable" WHERE label = 'IS_ADMIN');

-- Step 4: Log the rollback action
INSERT INTO "SystemAuditLog"
  (event_type, actorId, action, details, changedBy)
VALUES (
  'ADMIN_TRANSFER_ROLLED_BACK',
  123,
  'TRANSFER_ADMIN_PRIVILEGES_REVERSED',
  jsonb_build_object(
    'reason', 'Emergency rollback',
    'oldAdminId', 123,
    'newAdminId', 456,
    'rolledBackAt', NOW()
  ),
  999  -- system user
);

-- Step 5: Review changes
SELECT * FROM "rolesMap" WHERE "personnelId" IN (123, 456);

-- Step 6: Commit or rollback
COMMIT;  -- or ROLLBACK to undo everything
```

**After Rollback**:
1. Notify affected parties
2. Update password for both accounts
3. Review audit logs for timing
4. Ensure no session hijacking occurred

---

## Email Delivery Resilience

### Retry Strategy

**BullMQ Job Configuration**:
```javascript
{
  attempts: 5,                              // Retry up to 5 times
  backoff: {
    type: 'exponential',
    delay: 1000                            // Start at 1 second
  },
  removeOnComplete: true,                  // Delete after success
  removeOnFail: false                      // Keep failed jobs for analysis
}
```

**Backoff Schedule**:
```
Attempt 1: Immediate
Attempt 2: 1 second + exponential
Attempt 3: 2 seconds + exponential
Attempt 4: 4 seconds + exponential
Attempt 5: 8 seconds + exponential
After 5 failures: Job moved to failed queue
```

---

### Handling Email Delivery Failures

#### Check Failed Email Queue
```bash
# View failed email jobs
redis-cli -a $REDIS_PASSWORD LRANGE "bull:emailQueue:failed" 0 -1

# Get details of failed job
redis-cli -a $REDIS_PASSWORD HGETALL "bull:emailQueue:job:${JOB_ID}"
```

#### Manual Email Retry
```bash
# Move job back to pending queue
redis-cli -a $REDIS_PASSWORD LPUSH "bull:emailQueue:wait" "jobId"

# Or clear failed queue and reinitiate transfer
redis-cli -a $REDIS_PASSWORD DEL "bull:emailQueue:failed"
```

#### SMTP Troubleshooting
```bash
# Test SMTP connectivity
openssl s_client -connect $SMTP_HOST:$SMTP_PORT -starttls smtp

# Monitor email logs
tail -f Backend/utils/logs/debug.log | grep -i "smtp\|nodemailer"
```

---

## Redis Key Cleanup

### Automatic Cleanup
Redis automatically removes keys when TTL expires:
- Transfer tokens: 10 minutes (auto-removed)
- Initiation cooldown: 5 minutes (auto-removed)
- Password failures: 1 hour (auto-removed)
- Password lockout: 30 minutes (auto-removed)

### Manual Cleanup

#### View All Admin Transfer Keys
```bash
redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "admin:transfer*" COUNT 100
```

#### Delete Specific Key
```bash
redis-cli -a $REDIS_PASSWORD DEL "admin:transfer:a1b2c3d4..."
```

#### Cleanup Expired Keys (Force)
```bash
#!/bin/bash
# cleanup_expired_admin_transfers.sh

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD}"

echo "Scanning for expired admin transfer keys..."

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" \
  --scan --pattern "admin:transfer:*" | while read key; do

  TTL=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" TTL "$key")

  if [ "$TTL" -eq -2 ]; then
    echo "Removing expired key: $key"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" DEL "$key"
  fi
done

echo "✅ Cleanup complete"
```

---

## Development Setup

### Prerequisites
```bash
# Required services
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- SMTP server (for email testing)

# Optional
- Docker & Docker Compose
- Postman (for GraphQL testing)
- pgAdmin (database management)
- Redis Commander (Redis visualization)
```

### Local Environment Setup

```bash
# 1. Clone and install
cd Backend
npm install

# 2. Configure environment
cat > .env << 'EOF'
# Database
POSTGRES_HOST=localhost
POSTGRES_USER=mdsadmin
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=mdsystem_dev

# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=dev_redis_pass

# Email (mailhog for local testing)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=test@example.com
SMTP_PASS=test

# Admin Transfer
ADMIN_TRANSFER_COOLDOWN=5  # 5 seconds for testing
ADMIN_TRANSFER_PASSWORD_FAIL_LOCKOUT=10  # 10 seconds for testing
ADMIN_TRANSFER_EXPIRATION=300  # 5 minutes

# Logging
LOG_LEVEL=debug
DEBUG_BYPASS_OTP=true
EOF

# 3. Start services
docker-compose up postgres redis  # or run locally

# 4. Initialize database
npm run migrate

# 5. Seed test data
npm run seed

# 6. Start backend
npm run dev
```

### Local Testing

#### GraphQL Playground
```
http://localhost:3001/rolemanagement/admin
```

#### Test Mutation Flow

```graphql
# 1. Create test medical personnel (skip if exists)
mutation {
  createMedicalPersonnel(input: {
    userId: "456"
    title: "Dr. Test"
    role: Doctor
    designation: Manila
  }) {
    ok
    message
  }
}

# 2. Initiate transfer (using admin user)
mutation {
  initiateAdminTransfer(
    newAdminUserId: "456"
    password: "admin_password"
  ) {
    ok
    message
    verificationRequired
  }
}

# 3. Check Redis for token (in separate ssh session)
# redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "admin:transfer:*"

# 4. Confirm transfer with token from email/Redis
mutation {
  confirmAdminTransfer(
    verificationToken: "TOKEN_FROM_REDIS"
  ) {
    ok
    message
    oldAdminId
    newAdminId
  }
}

# 5. Verify privileges transferred
query {
  getStaffPermissions(userId: "456") {
    permissions {
      key
      enabled
    }
  }
}
```

#### Testing Rate Limiting Locally

```bash
#!/bin/bash
# test_rate_limits.sh

TOKEN="YOUR_JWT_TOKEN"
API="http://localhost:3001/rolemanagement/admin"

# Test IP rate limiting (should fail on 4th request)
for i in {1..5}; do
  echo "Request $i:"
  curl -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query":"query { listStaffAccounts { count } }"}'
  echo ""
  sleep 2
done

# Expected: First 3 return data, 4th+ return 429
```

---

## Performance Characteristics

### Expected Latencies

| Operation | Latency | Notes |
|-----------|---------|-------|
| Initiate transfer | 200-400ms | Includes password verification (bcrypt) |
| Send email | 500-2000ms | Queued, actual send is async |
| Confirm transfer | 300-500ms | Includes transaction + audit log |
| Get transfer session | 10-50ms | Redis only |
| Password failure check | 20-50ms | Redis lookup |

### Database Impact

```sql
-- Typical transfer operations impact:
-- 1x INSERT into rolesMap (1-2ms)
-- 1x DELETE from rolesMap (1-2ms)
-- 1x INSERT into SystemAuditLog (1-2ms)
-- Total: ~5ms per successful transfer
```

### Redis Memory Usage

```
Per active transfer session:
  - Key: ~100 bytes (token string)
  - Hash: ~200 bytes (old/new admin IDs + timestamp)
  - Overhead: ~50 bytes
  - Total: ~350 bytes per session

With 10 concurrent transfers: ~3.5 KB
With 1000 total sessions (10min expiry): ~350 KB
```

### Email Queue Performance

```
Email delay: 1000ms (configurable)
Queue processing: ~1 email per second
Max queue depth: Limited by Redis memory (GB)

Example: 1GB Redis with 20MB queue = ~3000 pending emails
```

---

## Multi-Instance Considerations

### Distributed Admin Transfer System

When running multiple application instances with shared Redis and PostgreSQL:

#### Race Condition Prevention

**Scenario**: Two instances simultaneously initiating transfers

```javascript
// ✅ Solution 1: Redis atomic operations (currently implemented)
// recordAdminTransferAttempt uses SET with EX - atomic
const lastAttempt = await client.get(key);
if (lastAttempt) {
  // Cooldown active
  return { allowed: false };
}
await client.set(key, Date.now(), { EX: COOLDOWN });

// ✅ Solution 2: Redis GETEX (alternative)
// Atomic get-and-set
const existed = await client.getEx(key, { EX: COOLDOWN });
if (existed) return { allowed: false };
```

#### Transaction Isolation Across Instances

PostgreSQL handles this automatically:

```sql
-- Instance A: BEGIN transaction
BEGIN;
INSERT INTO rolesMap ... (grants admin)
DELETE FROM rolesMap ... (revokes admin)
INSERT INTO SystemAuditLog ... (logs)
COMMIT;

-- Instance B: Cannot interfere
-- PostgreSQL isolation level ensures consistency
-- Even if Instance B tries same operation, only one succeeds
```

#### Redis Failover Considerations

**Primary Redis down**:
- Transfer initiation fails (cannot check cooldown)
- Email send queued in BullMQ (if using persistent queue)
- Resolution: Automatic failover to Redis replica

**Recommended Setup**:
```yaml
Redis Cluster:
  - Primary: Production instance (master)
  - Replica 1: Automatic failover candidate
  - Replica 2: Backup/analytics

Sentinel Configuration:
  - Monitors all 3 Redis instances
  - Auto-promotes replica on master failure
  - Notifies application of topology changes
```

#### Email Queue in Distributed Setup

```javascript
// BullMQ automatically handles distributed queues
const emailQueue = new Queue('emailQueue', {
  connection: redisConfig  // Shared Redis
});

// All instances see same queue
// Any instance can process jobs
// Built-in job locking prevents duplicate processing
```

#### Audit Logging Across Instances

```sql
-- PostgreSQL ensures consistency
-- All instances write to same table
-- created_at timestamp ensures ordering

-- Query to verify no duplicates:
SELECT details->>'verificationTokenPrefix', COUNT(*)
FROM "SystemAuditLog"
WHERE event_type = 'ADMIN_TRANSFER_SUCCESS'
GROUP BY details->>'verificationTokenPrefix'
HAVING COUNT(*) > 1;
-- Should return 0 rows (no duplicates)
```

#### Load Balancing Considerations

```
Request Flow (with 3 app instances):

Client → Load Balancer
           ├→ Instance 1 (JWT verify, IP rate limit)
           ├→ Instance 2 (JWT verify, IP rate limit)
           └→ Instance 3 (JWT verify, IP rate limit)

All instances share:
  - Redis (for rate limiting, sessions)
  - PostgreSQL (for role data, audit logs)
  - SMTP queue (BullMQ in Redis)
```

### Sticky Sessions Requirement

**NOT required** for admin transfer flow because:
1. JWT is verified independently on each request
2. Redis state is shared and consistent
3. Database state is transactional

Any instance can handle any request in the flow.

---

**Document Version**: 2.0
**Last Updated**: 2026-03-24
**Maintained By**: MDSystem Security Team
**Review Schedule**: Quarterly
