# TypeScript Migration Plan for MDSystem

## Overview

This document provides a complete step-by-step guide to migrate the MDSystem React application from JavaScript to TypeScript.

**Estimated Time:** 2-4 days (depending on team size and experience)

**Goal:** Add type safety, improve code quality, and enhance developer experience without breaking existing functionality.

---

## Why Migrate to TypeScript?

### Current State (JavaScript)
- ❌ Type errors only discovered at runtime
- ❌ Limited autocomplete and IntelliSense
- ❌ Refactoring requires manual search for all usages
- ❌ API responses have no type safety
- ❌ Props and state can be any type
- ❌ Hard to catch null/undefined errors

### Future State (TypeScript)
- ✅ Type errors caught during development
- ✅ Excellent autocomplete and IntelliSense
- ✅ Safe refactoring with compiler assistance
- ✅ Strongly typed API responses
- ✅ Type-safe props and state
- ✅ Null/undefined checks enforced by compiler

---

## Prerequisites

### Required Knowledge
- [ ] Basic understanding of TypeScript syntax
- [ ] Familiarity with React hooks and components
- [ ] Understanding of interfaces and types

### Recommended Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

## Migration Strategy

### Phase 1: Setup (Day 1 - Morning)
Install TypeScript and configure the project

### Phase 2: Core Services (Day 1 - Afternoon)
Migrate utility services and API handlers

### Phase 3: Components (Day 2)
Convert React components to TypeScript

### Phase 4: Testing & Refinement (Day 3-4)
Test, fix type errors, and refine types

---

## Phase 1: Setup TypeScript

### Step 1.1: Install TypeScript Dependencies

```bash
# Navigate to frontend directory
cd /c/Code-Workspace/K1taru/MDSystem/mdsystem-frontend

# Install TypeScript and React type definitions
npm install --save-dev typescript @types/react @types/react-dom @types/node

# Install types for libraries you're using
npm install --save-dev @types/react-router-dom
```

### Step 1.2: Create TypeScript Configuration

Create `tsconfig.json` in the project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json` for Vite config:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.js"]
}
```

### Step 1.3: Update Vite Configuration

Rename `vite.config.js` to `vite.config.ts` and update if needed:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
```

### Step 1.4: Update package.json Scripts

Ensure your scripts work with TypeScript:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## Phase 2: Migrate Core Services

### Step 2.1: Create Type Definitions

Create `src/types/index.ts`:

```typescript
// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'patient' | 'staff' | 'admin';
  createdAt: string;
  updatedAt: string;
}

// Auth Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Token Storage
export interface TokenStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  refreshAccessToken: () => Promise<string>;
}

// Banner Types
export type BannerType = 'success' | 'error' | 'warning' | 'info';

export interface BannerConfig {
  message: string;
  type: BannerType;
  duration?: number;
}
```

### Step 2.2: Migrate `apiBaseUrlProvider.js` → `apiBaseUrlProvider.ts`

```bash
mv src/services/apiBaseUrlProvider.js src/services/apiBaseUrlProvider.ts
```

Update the file:

```typescript
/**
 * Provides the correct API base URL based on subdomain detection
 */
export const getApiBaseUrl = (): string => {
  const hostname = window.location.hostname;

  // Development environment
  if (hostname === 'localhost') {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  // Staff subdomain
  if (hostname.startsWith('staff.')) {
    return import.meta.env.VITE_STAFF_API_URL || `https://${hostname}`;
  }

  // Patient portal (default)
  return import.meta.env.VITE_PATIENT_API_URL || `https://${hostname}`;
};

export default getApiBaseUrl;
```

### Step 2.3: Migrate `refreshTokenService.js` → `refreshTokenService.ts`

```bash
mv src/services/refreshTokenService.js src/services/refreshTokenService.ts
```

Update the file:

```typescript
import axios, { AxiosResponse } from 'axios';
import getApiBaseUrl from './apiBaseUrlProvider';
import type { TokenStorage, AuthTokens } from '../types';

/**
 * Token Storage Service
 * Provides centralized access to authentication tokens
 */
const TokenStorageService: TokenStorage = {
  /**
   * Get the current access token from localStorage
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  /**
   * Get the current refresh token from localStorage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  /**
   * Store both tokens atomically
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  /**
   * Clear all tokens from storage
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response: AxiosResponse<AuthTokens> = await axios.post(
        `${baseUrl}/auth/refresh`,
        { refreshToken }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Update both tokens atomically
      this.setTokens(accessToken, newRefreshToken);

      return accessToken;
    } catch (error) {
      // Clear tokens on refresh failure
      this.clearTokens();
      throw error;
    }
  }
};

export default TokenStorageService;
```

### Step 2.4: Migrate `axiosRequestHandler.js` → `axiosRequestHandler.ts`

```bash
mv src/services/axiosRequestHandler.js src/services/axiosRequestHandler.ts
```

Update the file:

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import getApiBaseUrl from './apiBaseUrlProvider';
import TokenStorageService from './refreshTokenService';
import { showBanner } from '../config/bannerConfig';
import type { BannerType } from '../types';

const baseURL = getApiBaseUrl();

// Create Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error: Error | null, token: string | null = null): void => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Request Interceptor: Add access token to headers
 */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = TokenStorageService.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/**
 * Response Interceptor: Handle token refresh and errors
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while token is being refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await TokenStorageService.refreshAccessToken();
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        TokenStorageService.clearTokens();
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other HTTP errors
    const status = error.response?.status;
    const message = (error.response?.data as { message?: string })?.message || error.message;

    let bannerType: BannerType = 'error';
    let bannerMessage = message;

    if (status === 400) {
      bannerType = 'warning';
      bannerMessage = `Bad Request: ${message}`;
    } else if (status === 403) {
      bannerType = 'error';
      bannerMessage = 'Access Denied';
    } else if (status === 404) {
      bannerType = 'warning';
      bannerMessage = 'Resource Not Found';
    } else if (status === 500) {
      bannerType = 'error';
      bannerMessage = 'Server Error';
    }

    showBanner(bannerMessage, bannerType);
    return Promise.reject(error);
  }
);

export default axiosInstance;
```

### Step 2.5: Migrate `bannerConfig.js` → `bannerConfig.ts`

```bash
mv src/config/bannerConfig.js src/config/bannerConfig.ts
```

Update the file:

```typescript
import type { BannerType, BannerConfig } from '../types';

let bannerCallback: ((config: BannerConfig) => void) | null = null;

/**
 * Register a callback function to display banners
 */
export const registerBannerCallback = (callback: (config: BannerConfig) => void): void => {
  bannerCallback = callback;
};

/**
 * Show a banner notification
 */
export const showBanner = (
  message: string,
  type: BannerType = 'info',
  duration: number = 5000
): void => {
  if (bannerCallback) {
    bannerCallback({ message, type, duration });
  }
};
```

---

## Phase 3: Migrate Components

### Step 3.1: Migrate Banner Component

```bash
mv src/components/banner/Banner.jsx src/components/banner/Banner.tsx
```

Update the file:

```typescript
import React, { useState, useEffect } from 'react';
import { registerBannerCallback } from '../../config/bannerConfig';
import styles from './Banner.module.css';
import type { BannerConfig, BannerType } from '../../types';

interface BannerState extends BannerConfig {
  visible: boolean;
}

const Banner: React.FC = () => {
  const [banner, setBanner] = useState<BannerState>({
    message: '',
    type: 'info',
    duration: 5000,
    visible: false,
  });

  useEffect(() => {
    registerBannerCallback((config: BannerConfig) => {
      setBanner({
        ...config,
        visible: true,
      });

      setTimeout(() => {
        setBanner((prev) => ({ ...prev, visible: false }));
      }, config.duration || 5000);
    });
  }, []);

  if (!banner.visible) return null;

  const getIcon = (type: BannerType): string => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={styles.bannerContainer}>
      <div className={`${styles.banner} ${styles[banner.type]}`}>
        <span className={styles.icon}>{getIcon(banner.type)}</span>
        <span className={styles.message}>{banner.message}</span>
      </div>
    </div>
  );
};

export default Banner;
```

### Step 3.2: Migrate Login Component

```bash
mv src/modules/auth/Login.jsx src/modules/auth/Login.tsx
```

Update the file:

```typescript
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axiosRequestHandler';
import TokenStorageService from '../../services/refreshTokenService';
import { showBanner } from '../../config/bannerConfig';
import styles from './login.module.css';
import type { LoginCredentials, LoginResponse } from '../../types';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginCredentials>({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/login', formData);
      const { accessToken, refreshToken, user } = response.data;

      TokenStorageService.setTokens(accessToken, refreshToken);
      showBanner(`Welcome, ${user.username}!`, 'success');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      showBanner('Login failed. Please check your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <form onSubmit={handleSubmit} className={styles.loginForm}>
        <h2>Login</h2>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login;
```

### Step 3.3: Migrate Register Component

```bash
mv src/modules/auth/Register.jsx src/modules/auth/Register.tsx
```

Update similarly with proper types for form data and event handlers.

### Step 3.4: Migrate Dashboard Component

```bash
mv src/pages/Dashboard.jsx src/pages/Dashboard.tsx
```

Add proper types for state and API responses.

### Step 3.5: Migrate App Component

```bash
mv src/App.jsx src/App.tsx
```

Update with React.FC type:

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Banner from './components/banner/Banner';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import './styles/App.css';

const App: React.FC = () => {
  return (
    <Router>
      <Banner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
};

export default App;
```

### Step 3.6: Migrate main Entry Point

```bash
mv src/main.jsx src/main.tsx
```

Update:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Phase 4: Testing & Refinement

### Step 4.1: Fix Type Errors

Run TypeScript compiler:

```bash
npx tsc --noEmit
```

Fix all type errors reported by the compiler.

### Step 4.2: Test Application

```bash
npm run dev
```

Test all features:
- [ ] Login flow
- [ ] Registration
- [ ] Token refresh
- [ ] Dashboard access
- [ ] Banner notifications
- [ ] API error handling

### Step 4.3: Update index.html

Ensure it points to the correct entry file:

```html
<script type="module" src="/src/main.tsx"></script>
```

### Step 4.4: Build Production Version

```bash
npm run build
```

Verify no type errors in production build.

---

## Comparison: JavaScript vs TypeScript

### Before (JavaScript)

**Login.jsx:**
```javascript
const [formData, setFormData] = useState({
  username: '',
  password: ''
});

const handleSubmit = async (e) => {
  e.preventDefault();
  const response = await axiosInstance.post('/auth/login', formData);
  // No type safety, could access wrong properties
  const { accessToken, refreshToken, user } = response.data;
};
```

**Problems:**
- ❌ No autocomplete for `response.data`
- ❌ Could misspell `accessToken` without error
- ❌ No guarantee `user` exists
- ❌ Could pass wrong data to `setFormData`

### After (TypeScript)

**Login.tsx:**
```typescript
interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const [formData, setFormData] = useState<LoginCredentials>({
  username: '',
  password: ''
});

const handleSubmit = async (e: FormEvent): Promise<void> => {
  e.preventDefault();
  const response = await axiosInstance.post<LoginResponse>('/auth/login', formData);
  // Full autocomplete and type safety
  const { accessToken, refreshToken, user } = response.data;
};
```

**Benefits:**
- ✅ Full autocomplete for `response.data`
- ✅ Compiler error if you misspell property names
- ✅ Guaranteed `user` exists and has correct shape
- ✅ Can't pass wrong data to `setFormData`

---

## Common Type Patterns

### 1. Component Props

```typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ onClick, children, disabled, variant = 'primary' }) => {
  return (
    <button onClick={onClick} disabled={disabled} className={variant}>
      {children}
    </button>
  );
};
```

### 2. useState with Types

```typescript
// Primitive
const [count, setCount] = useState<number>(0);

// Object
interface User {
  id: string;
  name: string;
}
const [user, setUser] = useState<User | null>(null);

// Array
const [items, setItems] = useState<string[]>([]);
```

### 3. Event Handlers

```typescript
// Form submit
const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
  e.preventDefault();
};

// Input change
const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
  const { name, value } = e.target;
};

// Button click
const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
  console.log('Clicked');
};
```

### 4. API Responses

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Usage
const response = await axiosInstance.get<ApiResponse<User>>('/users/me');
const user = response.data.data; // Fully typed
```

---

## Environment Variables

Create `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PATIENT_API_URL: string;
  readonly VITE_STAFF_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Checklist

### Setup
- [ ] Install TypeScript dependencies
- [ ] Create `tsconfig.json`
- [ ] Create `tsconfig.node.json`
- [ ] Rename `vite.config.js` → `vite.config.ts`
- [ ] Update `package.json` scripts

### Type Definitions
- [ ] Create `src/types/index.ts`
- [ ] Create `src/vite-env.d.ts`
- [ ] Define API response types
- [ ] Define user and auth types

### Services
- [ ] Migrate `apiBaseUrlProvider.js` → `.ts`
- [ ] Migrate `refreshTokenService.js` → `.ts`
- [ ] Migrate `axiosRequestHandler.js` → `.ts`
- [ ] Migrate `bannerConfig.js` → `.ts`

### Components
- [ ] Migrate `Banner.jsx` → `.tsx`
- [ ] Migrate `Login.jsx` → `.tsx`
- [ ] Migrate `Register.jsx` → `.tsx`
- [ ] Migrate `Dashboard.jsx` → `.tsx`
- [ ] Migrate `Landing.jsx` → `.tsx`
- [ ] Migrate `Auth.jsx` → `.tsx`
- [ ] Migrate `App.jsx` → `.tsx`
- [ ] Migrate `main.jsx` → `.tsx`

### Testing
- [ ] Run `npx tsc --noEmit` (no errors)
- [ ] Test login flow
- [ ] Test registration
- [ ] Test token refresh
- [ ] Test dashboard
- [ ] Test banner notifications
- [ ] Build production (`npm run build`)

---

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:** Install missing type definitions:
```bash
npm install --save-dev @types/react-router-dom
```

### Issue: "Property does not exist on type"

**Solution:** Define proper interface for the object:
```typescript
interface MyObject {
  propertyName: string;
}
```

### Issue: "Type 'null' is not assignable to type"

**Solution:** Use union types:
```typescript
const [user, setUser] = useState<User | null>(null);
```

### Issue: ESLint errors with TypeScript

**Solution:** Install TypeScript ESLint:
```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## Expected Outcomes

### Code Quality
- ✅ 100% type coverage
- ✅ Zero runtime type errors
- ✅ Better code documentation
- ✅ Easier refactoring

### Developer Experience
- ✅ Full IntelliSense autocomplete
- ✅ Instant error detection
- ✅ Better code navigation
- ✅ Safer refactoring

### Team Collaboration
- ✅ Self-documenting code
- ✅ Fewer bugs in pull requests
- ✅ Faster onboarding for new developers
- ✅ Better API contract enforcement

---

## Post-Migration Best Practices

1. **Use strict mode:** Keep `"strict": true` in tsconfig.json
2. **Avoid `any` type:** Use proper types or `unknown`
3. **Type API responses:** Always type your API calls
4. **Use interfaces over types:** For object shapes
5. **Enable ESLint rules:** Use TypeScript-specific linting
6. **Document complex types:** Add JSDoc comments
7. **Keep types DRY:** Reuse type definitions
8. **Use utility types:** `Partial<T>`, `Pick<T>`, `Omit<T>`, etc.

---

## Resources

- [TypeScript Official Docs](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Vite TypeScript Guide](https://vitejs.dev/guide/features.html#typescript)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

## Conclusion

Migrating to TypeScript is an investment that pays off in:
- Fewer bugs
- Better developer experience
- Easier maintenance
- Safer refactoring

For a large project like MDSystem, TypeScript will help your team build more reliable, maintainable software.

**Estimated ROI:** Within 1-2 months, you'll see reduced debugging time and fewer production errors.
