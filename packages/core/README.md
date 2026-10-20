# @mdsystem/core

Shared, platform-agnostic core utilities for MDSystem web and mobile applications.

## What This Package Provides

- Token service factory with refresh/logout handling
- Axios request handler factory with:
  - auth token injection
  - queued retries during refresh
  - banner callback integration
- Banner state service
- Socket.IO service factory with token refresh and connection lifecycle handling
- Hostname-based role detection helper
- reCAPTCHA and Google OAuth helper factories
- Shared validation utilities (email, password, user constants)

The authenticated Axios client only accepts requests to the configured API origin
(the page origin when the base URL is relative). Use a separate client for external
URLs. Request diagnostics include transport metadata and omit request/response
payloads and query strings. Token refreshes are shared across callers, and logout
or a new login invalidates refresh responses from the previous session.

## Installation

Inside the MDSystem repository this package is resolved through workspace/local linking.

```bash
# from repository root
npm install
```

For external usage:

```bash
npm install @mdsystem/core
```

## Package Structure

```text
packages/core/
|-- src/
|   |-- config/
|   |-- internal/
|   |-- services/
|   |-- utils/
|   |-- validation/
|   `-- index.js
`-- package.json
```

## Public Exports

From `@mdsystem/core` (barrel export in `src/index.js`):

- `createApiBaseUrlProvider`
- `createTokenService`
- `createAxiosRequestHandler`
- `BannerService`
- `createRecaptchaService`
- `createGoogleOAuthService`
- `detectRoleFromHostname`
- Validation exports from:
  - `validation/email-validation.js`
  - `validation/password-validation.js`
  - `validation/user-constants.js`

Additional service modules are available via direct path imports, for example:

```js
import { createSocketService } from '@mdsystem/core/services/socket-service';
```

## Integration Pattern

The package is factory-driven and uses dependency injection so each runtime can supply platform-specific adapters.

- Web typically injects `localStorage`, browser navigation, and hostname/env readers.
- React Native typically injects `AsyncStorage`, app navigation, and env-backed API URL readers.

### Minimal Web Example

```js
import {
  createApiBaseUrlProvider,
  createTokenService,
  createAxiosRequestHandler,
  BannerService,
} from '@mdsystem/core';
import * as bannerConfig from '@mdsystem/core/config/banner-config';

const apiBaseUrlProvider = createApiBaseUrlProvider({
  getHostname: () => window.location.hostname,
  getEnv: (key) => import.meta.env[`VITE_${key}`],
});

const tokenService = createTokenService({
  storage: localStorage,
  navigator: { navigate: (path) => { window.location.href = path; } },
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  tokenNamespace: 'patient',
});

const bannerService = new BannerService();

export const axiosRequest = createAxiosRequestHandler({
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner) => bannerService.showBanner(banner),
});
```

### Minimal React Native Example

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTokenService,
  createAxiosRequestHandler,
  BannerService,
} from '@mdsystem/core';
import * as bannerConfig from '@mdsystem/core/config/banner-config';

const getApiBaseUrl = () =>
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://www.mdsystemtip.space';
const getDevSubdomain = () => {
  try {
    return new URL(getApiBaseUrl()).hostname;
  } catch {
    return 'www.mdsystemtip.space';
  }
};

const tokenService = createTokenService({
  storage: AsyncStorage,
  navigator: { navigate: () => {} },
  getApiBaseUrl,
  tokenNamespace: 'patient',
});

const bannerService = new BannerService();

export const axiosRequest = createAxiosRequestHandler({
  getApiBaseUrl,
  getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner) => bannerService.showBanner(banner),
});
```

## Notes On Key Services

- `createApiBaseUrlProvider`:
  - currently returns relative base URL (`''`) for web requests
  - provides normalized host mapping for forwarded-host behavior
- `createTokenService`:
  - supports namespaced storage keys via `tokenNamespace`
  - exposes `TokenStorage`, `refreshAccessToken`, `logout`, `isAuthenticated`
- `createAxiosRequestHandler`:
  - handles 401 refresh flow and queues concurrent failed requests
  - integrates status-driven banner notifications via `banner-config`

## Validation Utilities

See `src/validation/VALIDATION_UTILITIES.md` for detailed guidance and usage patterns.

## Security Controls and References

The controls below describe the shared package's current behavior. The CWE
references classify the weakness each control helps prevent; they are not
assigned vulnerability reports or a claim that every instance of that weakness
has been eliminated.

| Control | Implementation and scope | Weakness reference |
| --- | --- | --- |
| Credential destination restriction | The authenticated Axios interceptor validates the resolved request origin, including per-request base URL overrides, before reading tokens or dispatching. Cross-portal and unrelated origins are rejected. | [CWE-201: Insertion of Sensitive Information Into Sent Data](https://cwe.mitre.org/data/definitions/201.html) |
| Restricted request diagnostics | The shared request logger omits bodies, query strings, headers, credentials, and server error messages. It retains method, pathname, status, and transport metadata, including when logging is explicitly enabled. | [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html) |
| Session concurrency protection | Refresh callers share an in-flight operation. Session revisions discard stale refresh results after logout or a replacement login; queued storage operations protect newer sessions from older cleanup. | [CWE-362: Race Condition](https://cwe.mitre.org/data/definitions/362.html) |

API base URL validation also rejects malformed configuration, embedded URL
credentials, query strings, and fragments, while preserving supported path
prefixes. Socket connections support shared connection attempts and cancellation;
chat adapters remove listeners and cancel pending setup on unmount. reCAPTCHA
reset invalidates pending executions. These lifecycle controls prevent stale
asynchronous work from restoring disposed application state.

[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
is a reference for verifying application security controls. This README documents
selected controls relevant to its authentication, session management, validation,
and logging concerns; a complete ASVS assessment or conformance level has not
been established for this package.
[CVE](https://www.cve.org/) identifies specific disclosed vulnerabilities rather
than prescribing coding standards. No CVE assignment or CVSS severity score is
claimed for these changes.

### Integration security responsibilities

- Use HTTPS for production APIs. HTTP support exists for local/LAN development;
  URL validation does not enforce production TLS configuration.
- Keep patient and staff clients and token namespaces separate. Namespace
  separation is an application convention, not an encryption or access-control
  boundary within a compromised runtime. localStorage and AsyncStorage adapters
  do not add token encryption or hardware-backed storage.
- Treat JWT expiry decoding as a client-side freshness check. The backend must
  verify signatures, issuer/audience, expiry, session validity, authorization,
  and chat room membership. Hostname helpers, forwarded portal headers, and
  Google's `hd` UI hint do not establish authorization.
- Keep sensitive values out of URL paths: diagnostic logs retain pathnames.
  Origin validation covers the initial Axios destination; server redirects,
  backend CORS/CSRF policy, and deployment configuration need separate review.
- Review installed dependencies and their advisories as releases change. A
  passing test suite or build does not establish that dependencies are free of
  published CVEs.

## Compatibility

- Node: `>=18`
- Peer dependency: React `>=18` (optional in package metadata)

### App and API boundaries

| App | Production API | Token storage |
| --- | --- | --- |
| `mds-patient` | `https://www.mdsystemtip.space` | `patient_*` in localStorage |
| `mds-staff` | `https://staff.mdsystemtip.space` | `staff_*` in localStorage |
| `mds-mobile` (Android, iOS, Expo web) | `https://www.mdsystemtip.space` | `patient_*` through AsyncStorage |

Each authenticated client trusts its configured API origin. Patient credentials
must not be sent to the staff API or vice versa. The web adapters keep an empty
base URL so production uses the current page origin and local development uses
the Vite proxy. `www2` and `staff2` keep their page origins while the forwarded
portal header maps to `www` and `staff` respectively.

Mobile uses the absolute `EXPO_PUBLIC_API_URL`; blank or whitespace-only values
fall back to the patient production API. A local/LAN patient backend is supported,
for example `http://192.168.1.5:3000`. Relative API bases require a browser location.

HTTP, refresh, logout, and socket services normalize surrounding whitespace and
trailing slashes. API path prefixes are preserved: a base ending in `/api/v1/`
uses `/api/v1/auth/refresh`, `/api/v1/auth/logout`, and `/api/v1/socket.io`.
An explicit socket `options.path` overrides the default transport path. Base URLs
must use HTTP(S) or a root-relative path and cannot contain credentials, query
strings, or fragments.

### Platform adapters

Token storage accepts synchronous localStorage or asynchronous AsyncStorage.
Navigation and notification callbacks remain injected by each app. Expo initializes
its native URL implementation before the mobile adapter loads; shared HTTP/token
logic does not require `document` or browser storage.

`createApiBaseUrlProvider` supplies relative URLs for web apps. Native apps should
inject an absolute API URL directly, as shown above. `createGoogleOAuthService`
and the core reCAPTCHA widget helper are browser integrations. Mobile continues
to use its existing native Google sign-in component and mobile authentication
configuration instead of rendering these DOM widgets.

Chat consumers restore rooms on the socket's `connect` event, which also runs
after reconnection. The Socket.IO manager's `reconnect` event is not a socket
event. Pending connections and listeners must be cancelled when consumers unmount.

### Verification

Run `npm --prefix packages/core run test:security` for the complete package suite
with coverage regression gates. See [SECURITY_TESTING.md](SECURITY_TESTING.md) for
OWASP guidance, risk-to-test mappings, loopback integration requirements, and
the limits of these checks.

Security regression coverage includes rejected origins before token access or
network dispatch, isolated token namespaces, diagnostic redaction, concurrent
refreshes, session replacement, storage failures, and cancelled socket/widget
work. Platform coverage includes production portals and aliases, local/LAN APIs,
relative and absolute URLs, path prefixes, asynchronous storage, and Expo's URL
implementation without browser globals. Chat tests cover room restoration,
duplicate-listener prevention, and cleanup during pending connections.

The compatibility implementation was verified with 549 passing tests across
core, patient, staff, and mobile, a clean mobile TypeScript check, both web
production builds, and Expo exports for Android, iOS, and web. These are the
recorded implementation results, not a continuously updated security audit.

Run the core, patient, staff, and mobile Jest suites, both Vite production builds,
and an Expo export for Android, iOS, and web. From the repository root run
`npm --prefix mds-mobile run export:all`; from `mds-mobile` run `npm run export:all`.
Both commands execute in the mobile project because NativeWind reads Expo config
from the working directory. NativeWind input/config paths are absolute and content
discovery is relative to the mobile project. Forward Expo options after `--`, for
example `-- --output-dir /tmp/mdsystem-mobile-export --max-workers 2`.

Bundle exports and automated tests do not exercise a physical device. Live
acceptance still includes login, authenticated upload/download, and socket
recovery after backgrounding or losing network connectivity on Android and iOS.

## License

See [LICENSE](LICENSE) in this package and the repository root license terms.
