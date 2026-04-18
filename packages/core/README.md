# @mdsystem/core

Shared, platform-agnostic core utilities for MDSystem web and mobile applications.

## What This Package Provides

- Token service factory with refresh/logout handling
- Axios request handler factory with:
  - auth token injection
  - queued retries during refresh
  - banner callback integration
- Banner state service
- Hostname-based role detection helper
- reCAPTCHA and Google OAuth helper factories
- Shared validation utilities (email, password, user constants)

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
  process.env.EXPO_PUBLIC_API_URL ?? 'https://www.mdsystemtip.space';
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

## Compatibility

- Node: `>=18`
- Peer dependency: React `>=18` (optional in package metadata)

## License

See [LICENSE](LICENSE) in this package and the repository root license terms.
