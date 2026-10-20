# Development → deployment merge review

Prepared on 2026-10-20. Deployment baseline: `0637f210`. Incoming development revision: `d1b15687`.

The existing merge is resolved and staged for review. No merge commit, push, deployment, or server database change has been performed.

## Resolution decisions

- Keep deployment's dependency manifests and both lockfiles, including `exceljs ^4.4.0` and `uuid ^13.0.0`.
- Keep the SQL setup file deleted. Preserve deployment's profile resolver, account-lock checks, SQL tables and shared personnel/user ID relationship.
- Exclude incoming soft deletion, `active_*` views, separate personnel IDs, permission-query migrations, and account-deletion UI changes.
- Retain the session change across JWT issuance/refresh, Redis, protected HTTP routes, admin GraphQL and the staff UI. Admin session responses no longer expose refresh tokens, and revocation cannot be reversed through the admin mutations.
- Retain audit additions for appointments, consultations, documents, health chat, announcements, inventory, medicine requests and prescriptions. Audit inserts use the existing helper and existing database relationships. Scheduler, consultation, chat, announcement and inventory changes use the same transaction as their audit entries. Patient medicine-request cancellation is recorded with a patient actor.

## Session compatibility

Newly issued JWT IDs and expiry times are stored with their device session. Refresh retains every still-valid JWT ID and drops expired IDs. Single-device and bulk revocation blacklist these IDs until their individual expirations and mark the refresh session revoked.

Redis scripts make revocation and refresh updates atomic. A stale successful or suspicious-refresh update cannot restore a revoked session. Repeated revocation and missing/expired sessions are safe. Blacklist keys expire automatically; no permanent membership sets are created.

Existing sessions remain signed in. Their earlier, untracked access tokens remain valid until expiry. A refresh or new login starts tracking newly issued access tokens. The admin `accessTokenExpired` field is always a boolean; legacy sessions with unknown access-token expiry are reported as not known to be expired.

## Local validation

| Check | Result |
| --- | --- |
| Backend suite | 156/158 suites pass; 1,364/1,370 tests pass under the workstation's current environment |
| Remaining two backend suites with test-only dotenv isolation | 14/14 tests pass |
| Patient suite | 128/128 pass |
| Staff suite | 249/249 pass |
| Shared-package suite | 11/11 pass |
| Repository checks | 27/27 pass |
| Patient and staff production builds | Pass |
| Local Playwright smoke | 2/2 pass against the final built portals |
| Undefined-variable checks on changed backend source | Pass |
| Real disposable Redis 7.0 verification | Pass: refresh compare-and-swap, overlapping JWT revocation, stale refresh rejection, repeated revocation, legacy/missing sessions, preserved session TTL, automatic blacklist expiry |

The six failures in the standard backend command are in unchanged `services/auth/recaptcha.test.js` and `config/data/matrix.test.js`. They load this workstation's private `Backend/.env`: reCAPTCHA test mode and custom rate limits override the defaults those tests expect. Both their implementation and test files are identical to deployment HEAD. Re-running those two suites with dotenv mocked only in the test process passes all 14 tests. No private environment files were changed.

Existing checks were extended for session metadata, staff anchors, refresh/revocation races, GraphQL response shape, authorization, audit actors, transaction rollback, and request validation under a row lock. Verification logs and the disposable Redis verification script are available locally under `/tmp/mdsystem-merge-resolution/`. The Redis process was shut down and its socket removed.

## Deferred Raspberry Pi validation

The actual schema, post-build and startup SQL files are private server files and were unavailable here. Their compatibility with the new audit inserts is **not yet verified against a real database**. Specifically, validate these audit event categories and the existing actor/target/changedBy column types: `APPOINTMENT_MANAGEMENT`, `CONSULTATION_MANAGEMENT`, `DOCUMENT_MANAGEMENT`, `HEALTHCHAT_MANAGEMENT`, `ANNOUNCEMENT_MANAGEMENT`, `INVENTORY_MANAGEMENT`, and `MEDICINE_REQUESTS`. No SQL migrations have been introduced.

After reviewing and making this exact resolution available on the Pi:

1. Confirm `e2e.private.env` points to that host's existing schema, post-build and startup SQL files. Use the deployment-compatible SQL, preserving its personnel/user ID relationship.
2. From the reviewed checkout, run `npm ci` and `npm run test:e2e:core`. The runner creates disposable PostgreSQL, Redis, SMTP and application services with synthetic accounts.
3. Check schema initialization, patient OTP login, administrator role-management access, restricted staff rejection and protected deep-link behavior.
4. Before release, exercise a new session through refresh, then single/bulk revocation; both older unexpired and newest JWTs must be rejected. Confirm admin session lists work and contain no refresh tokens. Exercise retained audit operations against the actual schema.
5. Preserve the sanitized `e2e-results/` report and check that the disposable project's containers and volumes were removed.

The existing core browser suite automates five authentication/authorization scenarios. Session-revocation and audit/database scenarios are additional Pi checks; the existing suite alone does not establish that coverage. Live deployment services and data are outside this test run.
