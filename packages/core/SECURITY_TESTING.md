# Package security regression tests

Run from the repository root after installing dependencies:

```bash
npm --prefix packages/core run test:security
```

For an output directory outside the checkout:

```bash
npm --prefix packages/core run test:security -- --coverageDirectory=/tmp/mdsystem-core-security-coverage
```

The command runs the complete core suite and enforces the coverage gates in
`jest.config.cjs`. URL normalization requires 100% statement, branch, function,
and line coverage. Service modules together require at least 95% statement,
function, and line coverage and 85% branch coverage. These are project regression
thresholds, not percentages prescribed by OWASP or evidence of complete security.
The full report also includes utilities and the untested Sheets configuration
script; service coverage must not be presented as whole-package coverage.

## Guidance and regression evidence

Tests use selected concerns from
[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/),
the [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/),
and the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
The mappings below identify relevant risks and test evidence; they are not a
requirement-by-requirement ASVS assessment or certification.

| Concern | Regression evidence | Tests |
| --- | --- | --- |
| Credential destination control; CWE-201 | Portal isolation; scheme, port, hostname and userinfo attacks; hostile URL/base overrides rejected before token reads and dispatch; canonical origins and IPv6 | `platform-compatibility.test.js`, `api-url.test.js`, `http-integration.test.js` |
| Sensitive information in logs; CWE-532 | Credentials, cookies, nested payloads, queries, fragments and server messages omitted even with forced logging; production/native defaults disabled | `console-request-logger.test.js`, `platform-compatibility.test.js` |
| Session races; CWE-362 | Single shared refresh; concurrent failure fan-out; logout during pending reads; replacement logins; ordered async writes; stale results discarded | `token-service.test.js`, `axios-request-handler.test.js` |
| Error handling and fail-closed behavior | Partial storage rollback, rejected reads, invalid token responses, network failures, safe retry bounds, revoked sessions, and later successful login | `token-service.test.js`, `axios-request-handler.test.js` |
| Transport integration | Actual HTTP refresh, retry and logout at the configured API prefix; origin rejection before network dispatch; pre-aborted requests and refused connections | `http-integration.test.js` |
| Lifecycle isolation | Bounded socket auth recovery, duplicate-error handling, handshake token rotation, disconnect cleanup, failed widget render recovery, independent widgets and cancelled waiters | `socket-service.test.js`, `recaptcha-service.test.js`, `google-oauth-service.test.js` |
| Notification cleanup | Timed and persistent notifications, timer cancellation, teardown, unsubscribe, and subscriber failure isolation | `banner-service.test.js` |

Service tests are under `src/services/`; URL tests are under `src/internal/`.
Concurrency tests use explicit completion signals instead of depending on network
timing. The transport integration uses an ephemeral `127.0.0.1` HTTP server and
synthetic credentials, disables environment proxies for its duration, restores
Axios defaults, and closes connections after each test. It does not contact
production services. The runner must permit binding a loopback port; a sandbox
that forbids it will fail those tests rather than silently skip them.

## Scope limits

These tests do not verify server-side signature validation, authorization, chat
room permissions, TLS, redirect policy, CORS/CSRF configuration, secure device
storage, browser XSS resistance, dependency advisories, or physical-device flows.
They do not establish ASVS conformance, assign CVEs, or replace penetration tests.
Dependency advisory review and live web/Android/iOS acceptance remain separate
checks. See [README.md](README.md) for app/API boundaries and integration duties.
