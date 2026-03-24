# Security Architecture: Admin Transfer & Role Management

## Overview

This document outlines the comprehensive security architecture implemented for the admin privilege transfer system and role management functionality in MDSystem. The implementation follows defense-in-depth principles with multiple overlapping security layers.

---

## Table of Contents

1. [Security Layers](#security-layers)
2. [Authentication & Authorization](#authentication--authorization)
3. [Rate Limiting & Abuse Prevention](#rate-limiting--abuse-prevention)
4. [Email Verification](#email-verification)
5. [Database Transaction Security](#database-transaction-security)
6. [Audit Logging](#audit-logging)
7. [Threat Model & Mitigations](#threat-model--mitigations)
8. [Security Configuration](#security-configuration)

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

**Document Version**: 1.0
**Last Updated**: 2026-03-24
**Maintained By**: MDSystem Security Team
**Review Schedule**: Quarterly
