# Authentication review — 2026-10-21

Reviewed the authentication/session changes introduced by merge `72b51b5f`, together with their HTTP, Socket.IO, logout and admin callers. The fixes preserve deployment's tables and personnel/user ID relationship. No database migration, commit, push or deployment was performed for this review. Concurrent shared-client work was left intact.

## Findings fixed

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Logout revoked only the refresh session; already-issued JWTs stayed usable. Its separate read/write could also overwrite a replacement session. | Logout now matches the current/previous refresh credential and revokes every tracked JWT in one Redis operation. A stale credential cannot revoke a newer login. Session TTL is preserved. |
| P1 | Socket.IO bypassed the JWT blacklist and treated a successful handshake as permanent authorization. Idle sockets could receive data after token expiry. | Check revocation, account locks and current staff membership at handshake and before events. Disconnect JWT rooms when sessions are revoked, disconnect idle sockets at expiry, and recheck after joining rooms to close the handshake race. Account locks and staff-anchor rotation disconnect whole user rooms, including legacy sockets. |
| P1 | Existing credentials could renew access after an account lock; several authenticated routes did not check the current lock state. | HTTP requests, socket authorization and refresh check the existing credential record. Locked/missing accounts are denied; staff membership is rechecked. Locking an account also revokes refresh sessions. Unverified/Inactive patients retain the existing registration access policy. |
| P2 | Concurrent logins could lose earlier JWT IDs, and concurrent staff logins could return different session anchors. A stale suspicion update could rotate the anchor before its session update failed. | Login atomically merges unexpired JWT history and selects the persisted staff anchor. Refresh and suspicion updates compare the current credential and staff anchor; escalation changes the anchor only when that comparison succeeds. |
| P2 | An incorrect raw refresh token could increase suspicion counters and ultimately invalidate staff sessions without proving possession of a refresh credential. | Unknown credentials and cooldown retries do not mutate session/anchor state. Recognized previous-token replay retains the existing escalation policy. |
| P2 | Admin diagnostics logged raw Redis refresh-session records, including refresh credentials. | Remove the session payload from those diagnostic logs. |
| P2 | Bulk session deletion mishandled batched Redis scan results and removed revocation metadata without blacklisting tracked JWTs. Repeated revocation also grew the stored history. | Normalize/deduplicate scan batches; blacklist tracked JWTs atomically before deleting each session. Revocation no longer appends duplicate records to stored history. |

Additional hardening validates refresh-token input types, lengths and positive safe user IDs; rejects unknown token roles and malformed authorization headers; pins JWT signing/verification to HS256; rejects invalid token lifetimes before writing sessions; maps refresh conflicts to authentication responses; and removes internal verifier details from HTTP responses.

## Verification

- Authentication/security regression run: **235/235 tests passed across 12 suites**.
- The run includes **nine real Redis integration scenarios**: concurrent login/history retention, shared staff anchors, current/previous-credential logout, stale logout, guessed credentials, stale suspicion updates, batched bulk deletion, locked-account refresh, and automatic blacklist expiry.
- Complete backend run with real Redis enabled: **1,414/1,420 tests passed; 159/161 suites passed**.
- The remaining six failures are the existing workstation `.env` interference in unchanged reCAPTCHA/rate-limit tests. Both suites pass **14/14 tests** when dotenv loading is disabled only in that test process. Private environment files were not changed.
- Undefined-variable checks on changed backend source and whitespace checks pass.
- Disposable Redis instances use private temporary Unix sockets, no TCP listener and no application data. They were stopped and removed after testing.

The new `Backend/config/redis-auth.integration.test.js` opts in when `REDIS_TEST_SERVER` points to a Redis server executable. It always starts its own isolated instance. For example:

```bash
REDIS_TEST_SERVER=/usr/bin/redis-server npm run test:backend
```

Logs from this review are under `/tmp/mdsystem-auth-review/` on this workstation. These are backend changes; browser tests and deployment were not run for this review.

## Compatibility and deployment checks

- Refresh-token wire format, login responses and existing SQL structure are preserved.
- Legacy access tokens whose IDs were never tracked still expire naturally, as previously agreed. Account lock checks and staff anchors are enforced even for those tokens.
- Socket disconnection across application processes uses the existing Socket.IO Redis adapter. Verify Redis pub/sub permissions and absence of the application's single-node adapter fallback on the Pi before relying on immediate cross-process disconnection. Handshake and event authorization independently recheck shared Redis state.
- HTTP authorization and socket events now perform current account checks. Verify the real patient/staff OTP, lock/unlock, refresh, logout and admin-revocation flows on the Pi before release.
- Invalid or missing access-token lifetime configuration now stops startup explicitly. `JWT_PATIENT_ACCESS_EXPIRATION` and `JWT_STAFF_ACCESS_EXPIRATION` must be positive integer seconds; the refresh lifetime retains its seven-day default when unset.
