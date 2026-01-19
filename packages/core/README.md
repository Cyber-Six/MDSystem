# @mdsystem/core

Shared core business logic for MDSystem web and mobile applications. This package provides platform-agnostic implementations of HTTP client, token management, role detection, and notification handling that can be used in both React web and React Native applications.

## 📦 Installation

### For React Web (Vite)

```bash
# From the mds-frontend directory
npm install file:../packages/core
```

### For React Native

```bash
# From your React Native project
npm install file:../packages/core

# Install peer dependencies
npm install @react-native-async-storage/async-storage
npm install react-native-config
```

## 🏗️ Architecture

This package uses **factory patterns** and **dependency injection** to support multiple platforms. Platform-specific implementations (localStorage vs AsyncStorage, window.location vs Config) are injected at runtime.

### Module Structure

```
@mdsystem/core/
├── config/
│   └── banner-config.js          # HTTP status code → banner mapping
├── services/
│   ├── api-base-url-provider.js  # API URL detection (factory)
│   ├── token-service.js          # Token storage & refresh (factory)
│   ├── axios-request-handler.js  # HTTP client with auth (factory)
│   └── banner-service.js         # Notification state management
├── utils/
│   └── role-detection.js         # Role detection from hostname
└── validation/
    ├── email-validation.js       # TIP email validation utilities
    ├── password-validation.js    # Password validation utilities
    └── user-constants.js         # User role/status constants
```

## 🚀 Quick Start

### Web Implementation (React + Vite)

```javascript
// src/services/core-setup.js
import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
import { createTokenService } from '@mdsystem/core/services/token-service';
import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
import * as bannerConfig from '@mdsystem/core/config/banner-config';
import { BannerService } from '@mdsystem/core/services/banner-service';

// 1. Create API base URL provider
export const apiBaseUrlProvider = createApiBaseUrlProvider({
  getHostname: () => window.location.hostname,
  getEnv: (key) => import.meta.env[`VITE_${key}`]
});

// 2. Create token service
export const tokenService = createTokenService({
  storage: localStorage,
  navigator: { 
    navigate: (path) => { window.location.href = path; } 
  },
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl
});

// 3. Create banner manager
export const bannerService = new BannerService();

// 4. Create axios instance
export const axiosRequest = createAxiosRequestHandler({
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
  tokenService,
  bannerConfig,
  onShowBanner: (banner) => bannerService.showBanner(banner)
});
```

```javascript
// src/App.jsx - Use in React
import { useEffect, useState } from 'react';
import { bannerService, axiosRequest } from './services/core-setup';

function App() {
  const [banners, setBanners] = useState([]);
  
  useEffect(() => {
    // Subscribe to banner updates
    return bannerService.subscribe(setBanners);
  }, []);
  
  const fetchData = async () => {
    // Axios automatically handles auth & token refresh
    const response = await axiosRequest.get('/api/data');
    console.log(response.data);
  };
  
  return (
    <div>
      {banners.map(banner => (
        <Banner key={banner.id} {...banner} />
      ))}
      <button onClick={fetchData}>Fetch Data</button>
    </div>
  );
}
```

### React Native Implementation

```javascript
// src/services/core-setup.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { useNavigation } from '@react-navigation/native';
import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
import { createTokenService } from '@mdsystem/core/services/token-service';
import { createAxiosRequestHandler } from '@mdsystem/core/services/axios-request-handler';
import * as bannerConfig from '@mdsystem/core/config/banner-config';
import { BannerService } from '@mdsystem/core/services/banner-service';

// 1. Create API base URL provider
export const apiBaseUrlProvider = createApiBaseUrlProvider({
  getHostname: () => Config.HOSTNAME || 'www.mdsystemtip.space',
  getEnv: (key) => Config[key]
});

// 2. Create token service (note: AsyncStorage methods are async)
export const createTokenServiceInstance = (navigation) => {
  return createTokenService({
    storage: AsyncStorage,
    navigator: navigation,
    getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl
  });
};

// 3. Create banner manager
export const bannerService = new BannerService();

// 4. Create axios instance
export const createAxiosInstance = (tokenService) => {
  return createAxiosRequestHandler({
    getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
    getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
    tokenService,
    bannerConfig,
    onShowBanner: (banner) => {
      // Show toast or notification in React Native
      bannerService.showBanner(banner);
    }
  });
};
```

```javascript
// App.js - React Native usage
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { createTokenServiceInstance, createAxiosInstance, bannerService } from './services/core-setup';

function HomeScreen() {
  const navigation = useNavigation();
  const [tokenService] = useState(() => createTokenServiceInstance(navigation));
  const [axiosRequest] = useState(() => createAxiosInstance(tokenService));
  const [banners, setBanners] = useState([]);
  
  useEffect(() => {
    return bannerService.subscribe(setBanners);
  }, []);
  
  const fetchData = async () => {
    const response = await axiosRequest.get('/api/data');
    console.log(response.data);
  };
  
  return (
    <View>
      {banners.map(banner => (
        <Toast key={banner.id} {...banner} />
      ))}
      <Button title="Fetch Data" onPress={fetchData} />
    </View>
  );
}
```

## 📚 API Reference

### Config Module

#### `banner-config`

```javascript
import * as bannerConfig from '@mdsystem/core/config/banner-config';

// Constants
bannerConfig.SUCCESS_STATUS_CODES  // [200, 201]
bannerConfig.ERROR_STATUS_CODES    // [400, 403, 404, 409, 422, 429, 500, 502, 503]
bannerConfig.INFO_STATUS_CODES     // []

// Functions
bannerConfig.shouldShowBanner(statusCode)       // boolean
bannerConfig.getBannerType(statusCode)          // 'success' | 'error' | 'info'
bannerConfig.extractBannerData(axiosResponse)   // { error, message }
```

### Services Module

#### `createApiBaseUrlProvider(dependencies)`

Creates API base URL provider with platform-specific dependencies.

**Parameters:**
- `dependencies.getHostname: () => string` - Returns current hostname
- `dependencies.getEnv: (key: string) => string` - Returns environment variable

**Returns:**
```javascript
{
  getApiBaseUrl: () => string,
  getDevSubdomain: () => string | null
}
```

**Example:**
```javascript
const provider = createApiBaseUrlProvider({
  getHostname: () => window.location.hostname,
  getEnv: (key) => import.meta.env[`VITE_${key}`]
});

const baseUrl = provider.getApiBaseUrl();
```

---

#### `createTokenService(dependencies)`

Creates token service with storage and navigation adapters.

**Parameters:**
- `dependencies.storage` - Storage adapter (localStorage, AsyncStorage)
  - `getItem(key: string): string | Promise<string>`
  - `setItem(key: string, value: string): void | Promise<void>`
  - `removeItem(key: string): void | Promise<void>`
- `dependencies.navigator` - Navigation adapter
  - `navigate(path: string): void`
- `dependencies.getApiBaseUrl: () => string`

**Returns:**
```javascript
{
  TokenStorage: {
    getAccessToken: () => string | Promise<string>,
    getRefreshToken: () => string | Promise<string>,
    setTokens: (access, refresh) => void | Promise<void>,
    clearTokens: () => void | Promise<void>,
    validateToken: (token) => boolean
  },
  refreshAccessToken: () => Promise<string>,
  logout: (redirect: boolean) => Promise<void>,
  isAuthenticated: () => boolean | Promise<boolean>
}
```

**Example:**
```javascript
const tokenService = createTokenService({
  storage: localStorage,
  navigator: { navigate: (path) => { window.location.href = path; } },
  getApiBaseUrl: () => 'https://api.example.com'
});

// Check authentication
if (tokenService.isAuthenticated()) {
  const token = tokenService.TokenStorage.getAccessToken();
}

// Logout
await tokenService.logout(true);
```

---

#### `createAxiosRequestHandler(dependencies)`

Creates configured axios instance with interceptors.

**Parameters:**
- `dependencies.getApiBaseUrl: () => string`
- `dependencies.getDevSubdomain: () => string | null`
- `dependencies.tokenService` - Token service instance
- `dependencies.bannerConfig` - Banner config module
- `dependencies.onShowBanner: (banner) => void` - Callback for showing banners

**Returns:** `AxiosInstance`

**Example:**
```javascript
const axiosRequest = createAxiosRequestHandler({
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  getDevSubdomain: apiBaseUrlProvider.getDevSubdomain,
  tokenService,
  bannerConfig: require('@mdsystem/core/config/banner-config'),
  onShowBanner: (banner) => bannerService.showBanner(banner)
});

// Use like normal axios
const response = await axiosRequest.get('/api/users');
const data = await axiosRequest.post('/api/users', { name: 'John' });
```

---

#### `BannerService`

Platform-agnostic notification state management.

**Constructor:**
```javascript
const manager = new BannerService();
```

**Methods:**

##### `showBanner(config)`
```javascript
const id = manager.showBanner({
  type: 'success' | 'error' | 'info',
  message: 'Your message here',
  error: 'ERROR_CODE',           // optional
  duration: 5000                  // ms, 0 for no auto-dismiss
});
```

##### `dismissBanner(id)`
```javascript
manager.dismissBanner(bannerId);
```

##### `clearAllBanners()`
```javascript
manager.clearAllBanners();
```

##### `getBanners()`
```javascript
const banners = manager.getBanners();
```

##### `subscribe(listener)`
```javascript
const unsubscribe = manager.subscribe((banners) => {
  console.log('Banners updated:', banners);
});

// Clean up
unsubscribe();
```

##### `destroy()`
```javascript
manager.destroy();
```

### Utils Module

#### `detectRoleFromHostname(hostname)`

Detects user role from hostname pattern.

**Parameters:**
- `hostname: string` - Hostname to check

**Returns:** `'medical' | 'patient'`

**Logic:**
- `staff.*` → `'medical'`
- All others → `'patient'`

**Example:**
```javascript
import { detectRoleFromHostname } from '@mdsystem/core/utils/role-detection';

// Web
const role = detectRoleFromHostname(window.location.hostname);

// React Native
import Config from 'react-native-config';
const role = detectRoleFromHostname(Config.HOSTNAME);

// Examples
detectRoleFromHostname('staff.mdsystemtip.space')  // → 'medical'
detectRoleFromHostname('www.mdsystemtip.space')    // → 'patient'
detectRoleFromHostname('localhost')                // → 'patient'
```

---

#### Email Validation

```javascript
import { 
  isStudentEmail, 
  isEmployeeEmail, 
  isMedicalEmail,
  detectRoleFromEmail,
  isValidTipEmail,
  isValidEmailFormat
} from '@mdsystem/core/utils/email-validation';

// Validate TIP email formats
isStudentEmail('msmith@tip.edu.ph')              // → true
isStudentEmail('qjohnson123@tip.edu.ph')         // → true
isEmployeeEmail('john.doe@tip.edu.ph')           // → true
isMedicalEmail('doc.mds@tip.edu.ph')             // → true

// Detect role from email
detectRoleFromEmail('msmith@tip.edu.ph')         // → 'Student'
detectRoleFromEmail('john.doe@tip.edu.ph')       // → 'Employee'
detectRoleFromEmail('doc.mds@tip.edu.ph')        // → 'Medical'

// General validation
isValidTipEmail('anyone@tip.edu.ph')             // → true
isValidEmailFormat('user@example.com')           // → true
```

---

#### Password Validation

```javascript
import { 
  validatePassword, 
  getPasswordError,
  passwordsMatch,
  PASSWORD_RULES
} from '@mdsystem/core/utils/password-validation';

// Validate password
validatePassword('short')                        // → false
validatePassword('validPassword123')             // → true

// Get error messages
getPasswordError('short')                        // → 'Password must be at least 8 characters long.'
getPasswordError('validPassword123')             // → null

// Check if passwords match
passwordsMatch('password123', 'password123')     // → true
passwordsMatch('password123', 'different')       // → false

// Access password rules
PASSWORD_RULES.MIN_LENGTH                        // → 8
PASSWORD_RULES.MAX_LENGTH                        // → 64
```

---

#### User Constants

```javascript
import { 
  USER_STATUS,
  USER_STATUS_VALUES,
  isUserStaff,
  isValidStatus
} from '@mdsystem/core/utils/user-constants';

// User status constants
USER_STATUS.STUDENT                              // → 'Student'
USER_STATUS.EMPLOYEE                             // → 'Employee'
USER_STATUS.MEDICAL                              // → 'Medical'

// Check if user is staff
isUserStaff('Medical')                           // → true
isUserStaff('Student')                           // → false

// Validate status
isValidStatus('Student')                         // → true
isValidStatus('Invalid')                         // → false
```

## 🔒 Security Features

### Token Management
- Automatic token refresh on 401 errors
- Request queuing during token refresh
- Secure token validation
- Atomic token storage operations
- Complete cleanup on logout

### HTTP Client
- Automatic bearer token injection
- Refresh token rotation
- Prevents interceptor loops
- Network error handling
- CSRF protection with credentials

## 🧪 Testing

### Role Detection Tests
You can move existing tests from `mds-frontend/src/context/__tests__/roleDetection.test.js` to `packages/core/__tests__/`.

```javascript
// __tests__/role-detection.test.js
import { detectRoleFromHostname } from '../src/utils/role-detection';

describe('detectRoleFromHostname', () => {
  it('should detect medical role from staff subdomain', () => {
    expect(detectRoleFromHostname('staff.mdsystemtip.space')).toBe('medical');
    expect(detectRoleFromHostname('STAFF.mdsystemtip.space')).toBe('medical');
  });
  
  it('should detect patient role for all other hostnames', () => {
    expect(detectRoleFromHostname('www.mdsystemtip.space')).toBe('patient');
    expect(detectRoleFromHostname('mdsystemtip.space')).toBe('patient');
    expect(detectRoleFromHostname('localhost')).toBe('patient');
  });
});
```

## 🔄 Migration Guide

### Migrating Existing Web App

1. **Install the package:**
   ```bash
   cd mds-frontend
   npm install file:../packages/core
   ```

2. **Create adapter file:**
   ```javascript
   // mds-frontend/src/services/core-adapters.js
   import { createApiBaseUrlProvider } from '@mdsystem/core/services/api-base-url-provider';
   // ... (see Quick Start above)
   ```

3. **Update imports in existing files:**
   ```javascript
   // Before
   import { getApiBaseUrl } from './api-base-url-provider';
   import { TokenStorage } from './refresh-token-service';
   import axiosRequest from './axios-request-handler';
   
   // After
   import { apiBaseUrlProvider, tokenService, axiosRequest } from './core-adapters';
   ```

4. **Update banner context:**
   ```javascript
   // Before
   const [banners, setBanners] = useState([]);
   
   // After
   import { bannerService } from './core-adapters';
   
   useEffect(() => {
     return bannerService.subscribe(setBanners);
   }, []);
   ```

5. **Test thoroughly** - Ensure all API calls, authentication, and notifications work correctly.

## 🌐 Environment Variables

### Web (.env.local)
```bash
# API URLs (optional, defaults to hostname)
VITE_STAFF_API_URL=https://staff.mdsystemtip.space
VITE_PATIENT_API_URL=https://www.mdsystemtip.space

# Development portal selection
VITE_DEV_PORTAL=www    # or 'staff'
```

### React Native (.env or react-native-config)
```bash
# Required
HOSTNAME=www.mdsystemtip.space

# Optional API URLs
STAFF_API_URL=https://staff.mdsystemtip.space
PATIENT_API_URL=https://www.mdsystemtip.space

# Development portal
DEV_PORTAL=www
```

## 📋 Platform Differences

### Storage
- **Web:** `localStorage` (synchronous)
- **React Native:** `AsyncStorage` (asynchronous)

The token service handles both by using `Promise.resolve()` wrapper.

### Navigation
- **Web:** `window.location.href = '/auth'`
- **React Native:** `navigation.navigate('Auth')`

### Environment Variables
- **Web:** `import.meta.env.VITE_*` (Vite)
- **React Native:** `Config.*` (react-native-config)

### Hostname Detection
- **Web:** `window.location.hostname`
- **React Native:** `Config.HOSTNAME` or app configuration

## 🛠️ Troubleshooting

### Import Errors
If you get `Cannot find module '@mdsystem/core'`:
```bash
# Reinstall the package
npm install file:../packages/core

# Or use npm link
cd packages/core
npm link
cd ../../mds-frontend
npm link @mdsystem/core
```

### Type Errors (if using TypeScript)
Add type definitions:
```typescript
// types/mdsystem-core.d.ts
declare module '@mdsystem/core/*';
```

### AsyncStorage Issues (React Native)
Ensure AsyncStorage is installed:
```bash
npm install @react-native-async-storage/async-storage
cd ios && pod install
```

## 🤝 Contributing

When adding new shared logic:

1. **Keep naming consistent** - Use exact same function/file names as in source
2. **Use factory pattern** for platform-specific code
3. **Document thoroughly** with JSDoc comments
4. **Add usage examples** in this README
5. **Test on both platforms**

## 📄 License

UNLICENSED - Internal use only

## 📞 Support

For questions or issues, contact the MDSystem development team.

---

**Version:** 1.0.0  
**Last Updated:** January 2, 2026
