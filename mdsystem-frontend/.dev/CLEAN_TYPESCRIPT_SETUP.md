# Clean TypeScript Migration Guide
## Creating a Fresh Vite + TypeScript Project

This guide provides step-by-step instructions for migrating MDSystem frontend to TypeScript using a clean, fresh project approach.

---

## Why Fresh Project vs Gradual Migration?

### Fresh Project Approach (This Guide)
- ✅ **Clean setup** - Official Vite TypeScript template
- ✅ **No legacy baggage** - Proper TypeScript configuration from day 1
- ✅ **No mixed codebase** - Pure TypeScript, no .js/.jsx files
- ✅ **Best practices** - Latest tooling and conventions
- ✅ **Enforces discipline** - Team must write TypeScript from start
- ❌ **More upfront work** - Need to migrate all code at once
- ❌ **Lose git history** - (Can be preserved with workarounds)

### Gradual Migration
- ✅ **Less risky** - Convert files one by one
- ✅ **Keeps git history** - All commits preserved
- ❌ **Mixed codebase** - JavaScript and TypeScript coexist
- ❌ **Longer transition** - Weeks or months with mixed code
- ❌ **Potential confusion** - Team might write new JS files

**Recommendation:** Fresh project for clean, professional TypeScript setup.

---

## Prerequisites

### Required
- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] Git installed
- [ ] VS Code or similar editor

### Recommended
- [ ] Basic TypeScript knowledge
- [ ] Backup of current working project
- [ ] Clean git state (no uncommitted changes)

---

## Phase 1: Backup Current Project

### Step 1.1: Commit Current Work

```bash
# Navigate to current project
cd /c/Code-Workspace/K1taru/MDSystem/mdsystem-frontend

# Check git status
git status

# Stage all changes
git add .

# Commit current state
git commit -m "Pre-TypeScript migration backup - JavaScript version"

# Push to remote (backup)
git push origin frontend-jay
```

### Step 1.2: Create Backup Branch

```bash
# Create backup branch
git checkout -b frontend-javascript-backup

# Push backup branch
git push -u origin frontend-javascript-backup

# Return to main branch
git checkout frontend-jay
```

### Step 1.3: Document Current Dependencies

```bash
# Save current package.json
cp package.json package.json.backup

# List installed packages
npm list --depth=0 > installed-packages.txt

# View dependencies for reference
cat package.json
```

---

## Phase 2: Create Fresh TypeScript Project

### Step 2.1: Create New Vite Project with TypeScript

```bash
# Navigate to parent directory
cd /c/Code-Workspace/K1taru/MDSystem

# Create new TypeScript project
npm create vite@latest mdsystem-frontend-ts -- --template react-ts

# You'll see prompts like:
# ✔ Select a framework: › React
# ✔ Select a variant: › TypeScript + SWC

# Navigate to new project
cd mdsystem-frontend-ts
```

**What you get:**
- ✅ TypeScript configured properly
- ✅ React 18 with TypeScript
- ✅ Vite with SWC compiler (faster than Babel)
- ✅ ESLint configured for TypeScript
- ✅ `tsconfig.json` and `tsconfig.app.json` preconfigured

### Step 2.2: Install Dependencies

```bash
# Install base dependencies
npm install

# Install routing
npm install react-router-dom

# Install HTTP client
npm install axios

# Install TypeScript type definitions
npm install --save-dev @types/react-router-dom
```

**Current dependencies comparison:**

| Old (JavaScript) | New (TypeScript) | Purpose |
|-----------------|------------------|---------|
| react | react | Core React library |
| react-dom | react-dom | React DOM rendering |
| react-router-dom | react-router-dom | Client-side routing |
| axios | axios | HTTP requests |
| - | @types/react-router-dom | TypeScript types for router |
| - | typescript | TypeScript compiler |

### Step 2.3: Verify Installation

```bash
# Check Node version
node --version
# Should be v18+

# Check installed packages
npm list --depth=0

# Test dev server
npm run dev
# Should start on http://localhost:5173
```

---

## Phase 3: Project Structure Setup

### Step 3.1: Create Folder Structure

```bash
# Create directory structure
mkdir -p src/components/banner
mkdir -p src/modules/auth
mkdir -p src/pages
mkdir -p src/services
mkdir -p src/config
mkdir -p src/styles
mkdir -p src/types
mkdir -p .dev
mkdir -p public
```

**Final structure:**
```
mdsystem-frontend-ts/
├── .dev/                      # Documentation (migrate from old project)
├── public/                    # Static assets
├── src/
│   ├── components/           # Reusable components
│   │   └── banner/
│   ├── modules/              # Feature modules
│   │   └── auth/
│   ├── pages/                # Page components
│   ├── services/             # API and utilities
│   ├── config/               # App configuration
│   ├── styles/               # Global styles
│   ├── types/                # TypeScript type definitions
│   ├── App.tsx
│   └── main.tsx
├── .env
├── .env.example
├── .gitignore
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### Step 3.2: Copy Configuration Files

```bash
# Copy environment files
cp ../mdsystem-frontend/.env .
cp ../mdsystem-frontend/.env.example .

# Copy gitignore (TypeScript template already has one, merge if needed)
cat ../mdsystem-frontend/.gitignore >> .gitignore

# Copy documentation
cp -r ../mdsystem-frontend/.dev/* .dev/

# Copy any static assets
cp -r ../mdsystem-frontend/public/* public/ 2>/dev/null || true
```

### Step 3.3: Update .gitignore

Ensure your `.gitignore` includes:

```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Dependencies
node_modules
dist
dist-ssr
*.local

# Environment variables
.env
.env.local
.env.*.local

# Editor directories
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Backup files
*.backup
package.json.backup
installed-packages.txt
```

---

## Phase 4: TypeScript Configuration

### Step 4.1: Review tsconfig.json

The Vite template creates `tsconfig.json`. Review and customize:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### Step 4.2: Customize tsconfig.app.json

Update `tsconfig.app.json` for your project:

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
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* Path aliases (optional) */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

### Step 4.3: Update Vite Config (Optional Path Aliases)

If using path aliases (`@/`), update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000
  }
})
```

Then install @types/node:
```bash
npm install --save-dev @types/node
```

---

## Phase 5: Create Type Definitions

### Step 5.1: Create Core Types

Create `src/types/index.ts`:

```typescript
// ============================================
// API Response Types
// ============================================

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

// ============================================
// User & Auth Types
// ============================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'patient' | 'staff' | 'admin';
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
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

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: User;
}

// ============================================
// Token Storage
// ============================================

export interface TokenStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  refreshAccessToken: () => Promise<string>;
}

// ============================================
// Banner Types
// ============================================

export type BannerType = 'success' | 'error' | 'warning' | 'info';

export interface BannerConfig {
  message: string;
  type: BannerType;
  duration?: number;
}

// ============================================
// Environment Variables
// ============================================

export interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PATIENT_API_URL: string;
  readonly VITE_STAFF_API_URL: string;
}

export interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Step 5.2: Create Vite Environment Types

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

## Phase 6: Migrate Services

### Step 6.1: API Base URL Provider

Create `src/services/apiBaseUrlProvider.ts`:

```typescript
/**
 * Provides the correct API base URL based on subdomain detection
 * 
 * @returns {string} The appropriate API base URL
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

### Step 6.2: Token Storage Service

Create `src/services/refreshTokenService.ts`:

```typescript
import axios, { AxiosResponse } from 'axios';
import getApiBaseUrl from './apiBaseUrlProvider';
import type { TokenStorage, AuthTokens } from '../types';

/**
 * Token Storage Service
 * Provides centralized access to authentication tokens with atomic operations
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
   * Ensures both tokens are always in sync
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  /**
   * Clear all tokens from storage
   * Used during logout or when refresh fails
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  /**
   * Refresh the access token using the refresh token
   * 
   * @throws {Error} If no refresh token is available or refresh fails
   * @returns {Promise<string>} The new access token
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

### Step 6.3: Axios Request Handler

Create `src/services/axiosRequestHandler.ts`:

```typescript
import axios, { 
  AxiosInstance, 
  AxiosError, 
  InternalAxiosRequestConfig, 
  AxiosResponse 
} from 'axios';
import getApiBaseUrl from './apiBaseUrlProvider';
import TokenStorageService from './refreshTokenService';
import { showBanner } from '../config/bannerConfig';
import type { BannerType } from '../types';

const baseURL = getApiBaseUrl();

// Create Axios instance with default configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// Token Refresh Queue Mechanism
// ============================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Process all queued requests after token refresh completes
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

// ============================================
// Request Interceptor
// ============================================

/**
 * Add access token to all outgoing requests
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

// ============================================
// Response Interceptor
// ============================================

/**
 * Handle token refresh and HTTP errors
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ============================================
    // Handle 401 Unauthorized (Token Expired)
    // ============================================
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request while token is being refreshed
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
        // Refresh the access token
        const newAccessToken = await TokenStorageService.refreshAccessToken();
        
        // Process all queued requests with new token
        processQueue(null, newAccessToken);

        // Retry the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Token refresh failed - clear tokens and redirect to login
        processQueue(refreshError as Error, null);
        TokenStorageService.clearTokens();
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ============================================
    // Handle Other HTTP Errors
    // ============================================
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

### Step 6.4: Banner Configuration

Create `src/config/bannerConfig.ts`:

```typescript
import type { BannerType, BannerConfig } from '../types';

let bannerCallback: ((config: BannerConfig) => void) | null = null;

/**
 * Register a callback function to display banners
 * This is called by the Banner component on mount
 */
export const registerBannerCallback = (callback: (config: BannerConfig) => void): void => {
  bannerCallback = callback;
};

/**
 * Show a banner notification
 * Can be called from anywhere in the application
 */
export const showBanner = (
  message: string,
  type: BannerType = 'info',
  duration: number = 5000
): void => {
  if (bannerCallback) {
    bannerCallback({ message, type, duration });
  } else {
    console.warn('Banner callback not registered. Message:', message);
  }
};
```

---

## Phase 7: Migrate Components

### Step 7.1: Banner Component

Create `src/components/banner/Banner.tsx`:

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
    // Register this component as the banner display handler
    registerBannerCallback((config: BannerConfig) => {
      setBanner({
        ...config,
        visible: true,
      });

      // Auto-hide after duration
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

Copy CSS file:
```bash
cp ../mdsystem-frontend/src/components/banner/Banner.module.css src/components/banner/
```

### Step 7.2: Login Component

Create `src/modules/auth/Login.tsx`:

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

      // Store tokens
      TokenStorageService.setTokens(accessToken, refreshToken);
      
      // Show success message
      showBanner(`Welcome back, ${user.username}!`, 'success');
      
      // Navigate to dashboard
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
        
        <div className={styles.formGroup}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login;
```

Copy CSS files:
```bash
cp ../mdsystem-frontend/src/modules/auth/login.module.css src/modules/auth/
cp ../mdsystem-frontend/src/modules/auth/auth.module.css src/modules/auth/ 2>/dev/null || true
```

### Step 7.3: Register Component

Create `src/modules/auth/Register.tsx`:

```typescript
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axiosRequestHandler';
import { showBanner } from '../../config/bannerConfig';
import styles from './register.module.css';
import type { RegisterData, RegisterResponse } from '../../types';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      showBanner('Passwords do not match', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post<RegisterResponse>('/auth/register', formData);
      showBanner(response.data.message || 'Registration successful!', 'success');
      
      // Redirect to login after successful registration
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error) {
      console.error('Registration failed:', error);
      showBanner('Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registerContainer}>
      <form onSubmit={handleSubmit} className={styles.registerForm}>
        <h2>Register</h2>

        <div className={styles.formGroup}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default Register;
```

Copy CSS:
```bash
cp ../mdsystem-frontend/src/modules/auth/register.module.css src/modules/auth/
```

### Step 7.4: Auth Page (Login/Register Wrapper)

Create `src/pages/Auth.tsx`:

```typescript
import React, { useState } from 'react';
import Login from '../modules/auth/Login';
import Register from '../modules/auth/Register';
import styles from '../modules/auth/auth.module.css';

type AuthMode = 'login' | 'register';

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className={styles.authContainer}>
      <div className={styles.authBox}>
        <div className={styles.authTabs}>
          <button
            className={mode === 'login' ? styles.active : ''}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={mode === 'register' ? styles.active : ''}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        {mode === 'login' ? <Login /> : <Register />}
      </div>
    </div>
  );
};

export default Auth;
```

### Step 7.5: Dashboard Page

Create `src/pages/Dashboard.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../services/axiosRequestHandler';
import TokenStorageService from '../services/refreshTokenService';
import { showBanner } from '../config/bannerConfig';
import styles from './dashboard.module.css';
import type { User } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async (): Promise<void> => {
    try {
      const response = await axiosInstance.get<{ user: User }>('/users/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      showBanner('Failed to load user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = (): void => {
    TokenStorageService.clearTokens();
    showBanner('Logged out successfully', 'success');
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.dashboardHeader}>
        <h1>Dashboard</h1>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Logout
        </button>
      </header>

      <main className={styles.dashboardContent}>
        {user ? (
          <div className={styles.userInfo}>
            <h2>Welcome, {user.username}!</h2>
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
          </div>
        ) : (
          <p>No user data available</p>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
```

Copy CSS:
```bash
cp ../mdsystem-frontend/src/pages/dashboard.module.css src/pages/ 2>/dev/null || true
# Or from modules if that's where it is
cp ../mdsystem-frontend/src/modules/dashboard/dashboard.module.css src/pages/ 2>/dev/null || true
```

### Step 7.6: Landing Page

Create `src/pages/Landing.tsx`:

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './landing.module.css';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.landingContainer}>
      <header className={styles.landingHeader}>
        <h1>Welcome to MDSystem</h1>
        <p>Your Medical Portal Solution</p>
      </header>

      <main className={styles.landingContent}>
        <div className={styles.ctaButtons}>
          <button 
            className={styles.primaryButton}
            onClick={() => navigate('/auth')}
          >
            Get Started
          </button>
          <button 
            className={styles.secondaryButton}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
        </div>
      </main>
    </div>
  );
};

export default Landing;
```

Copy CSS:
```bash
cp ../mdsystem-frontend/src/pages/landing.module.css src/pages/ 2>/dev/null || true
# Or from modules
cp ../mdsystem-frontend/src/modules/landing/landing.module.css src/pages/ 2>/dev/null || true
```

---

## Phase 8: Main Application Files

### Step 8.1: App Component

Create `src/App.tsx`:

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

### Step 8.2: Main Entry Point

Create `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 8.3: Copy Global Styles

```bash
# Copy global CSS files
cp ../mdsystem-frontend/src/styles/index.css src/styles/
cp ../mdsystem-frontend/src/styles/App.css src/styles/
```

---

## Phase 9: Update HTML and Configuration

### Step 9.1: Update index.html

Ensure `index.html` references the correct TypeScript entry point:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MDSystem</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 9.2: Update package.json Metadata

Update `package.json` with project details:

```json
{
  "name": "mdsystem-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "axios": "^1.7.9"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@types/react-router-dom": "^5.3.3",
    "@types/node": "^22.10.2",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "globals": "^15.14.0",
    "typescript": "~5.6.2",
    "typescript-eslint": "^8.18.1",
    "vite": "^6.0.3"
  }
}
```

---

## Phase 10: Testing and Validation

### Step 10.1: Type Check

```bash
# Run TypeScript compiler (type check only, no build)
npx tsc --noEmit

# Should show no errors
```

### Step 10.2: Start Development Server

```bash
# Start dev server
npm run dev

# Should start on http://localhost:3000
```

### Step 10.3: Manual Testing Checklist

Test all features:

- [ ] Landing page loads correctly
- [ ] Navigation to /auth works
- [ ] Login form submits
- [ ] Register form submits
- [ ] Token storage works (check localStorage)
- [ ] Dashboard loads after login
- [ ] Protected routes work
- [ ] Logout clears tokens
- [ ] Banner notifications display
- [ ] API errors show banners
- [ ] Token refresh works (test with expired token)
- [ ] All CSS styles apply correctly

### Step 10.4: Build Production Bundle

```bash
# Create production build
npm run build

# Check build output
ls -lh dist/

# Preview production build
npm run preview
```

---

## Phase 11: Replace Old Project

### Step 11.1: Verify Everything Works

Before replacing, ensure:

- [ ] All tests pass
- [ ] Production build succeeds
- [ ] No TypeScript errors
- [ ] All features work as expected

### Step 11.2: Rename Projects

```bash
# Navigate to parent directory
cd /c/Code-Workspace/K1taru/MDSystem

# Rename old project as backup
mv mdsystem-frontend mdsystem-frontend-js-backup

# Rename new project to original name
mv mdsystem-frontend-ts mdsystem-frontend
```

### Step 11.3: Initialize Git (if needed)

If this is a fresh repo:

```bash
cd mdsystem-frontend

# Initialize git
git init

# Add remote (replace with your repo URL)
git remote add origin https://github.com/Software-Design-MDSystem/MDSystem.git

# Create new branch
git checkout -b typescript-migration

# Stage all files
git add .

# Initial commit
git commit -m "feat: Migrate to TypeScript

- Fresh Vite + TypeScript setup
- Type-safe services and components
- Improved developer experience
- Full type coverage for API responses
- Maintained all features from JavaScript version"

# Push to remote
git push -u origin typescript-migration
```

### Step 11.4: Create Pull Request

1. Go to GitHub repository
2. Create pull request from `typescript-migration` to `frontend-jay`
3. Add description with migration details
4. Request team review
5. Merge when approved

---

## Phase 12: Cleanup and Documentation

### Step 12.1: Update README

Create/update `README.md`:

```markdown
# MDSystem Frontend (TypeScript)

Medical portal system with patient and staff interfaces.

## Tech Stack

- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Router:** React Router v6
- **HTTP Client:** Axios
- **Styling:** CSS Modules

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

\`\`\`bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
\`\`\`

### Scripts

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code

## Project Structure

\`\`\`
src/
├── components/       # Reusable components
├── modules/          # Feature modules
├── pages/            # Page components
├── services/         # API and utilities
├── config/           # App configuration
├── styles/           # Global styles
└── types/            # TypeScript type definitions
\`\`\`

## Environment Variables

See `.env.example` for required environment variables.

## Documentation

See `.dev/` folder for additional documentation:
- `CSS_GUIDELINES.md` - CSS best practices
- `TYPESCRIPT_MIGRATION_PLAN.md` - Migration guide
- `CLEAN_TYPESCRIPT_SETUP.md` - Fresh setup guide

## License

MIT
```

### Step 12.2: Update Documentation

Update `.dev/file_structure.md` to reflect TypeScript files:

```bash
# Update all .js references to .ts and .jsx to .tsx
sed -i 's/\.js$/\.ts/g' .dev/file_structure.md
sed -i 's/\.jsx$/\.tsx/g' .dev/file_structure.md
```

### Step 12.3: Archive Old Project (Optional)

```bash
# Create archive of JavaScript version
cd /c/Code-Workspace/K1taru/MDSystem
tar -czf mdsystem-frontend-js-backup.tar.gz mdsystem-frontend-js-backup/

# Move to archive location
mkdir -p archives
mv mdsystem-frontend-js-backup.tar.gz archives/

# Can delete old folder now
rm -rf mdsystem-frontend-js-backup
```

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module" errors

**Cause:** Missing type definitions

**Solution:**
```bash
npm install --save-dev @types/react-router-dom @types/node
```

#### Issue: TypeScript errors in .tsx files

**Cause:** Incorrect types or missing imports

**Solution:**
```typescript
// Ensure proper imports
import type { User, LoginCredentials } from '../types';
```

#### Issue: CSS modules not working

**Cause:** Missing .module.css extension

**Solution:**
```typescript
// Correct
import styles from './Component.module.css';

// Wrong
import styles from './Component.css';
```

#### Issue: Environment variables undefined

**Cause:** Not prefixed with VITE_

**Solution:**
```bash
# In .env
VITE_API_URL=http://localhost:3001  # ✅ Correct
API_URL=http://localhost:3001        # ❌ Wrong
```

#### Issue: Build fails with type errors

**Cause:** Strict TypeScript checks

**Solution:**
```bash
# Check errors
npx tsc --noEmit

# Fix all type errors before building
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current JavaScript project
- [ ] Create backup branch in git
- [ ] Document current dependencies
- [ ] Verify all features work in JS version

### Setup
- [ ] Create fresh TypeScript project with Vite
- [ ] Install dependencies
- [ ] Create folder structure
- [ ] Copy configuration files (.env, .gitignore)
- [ ] Update tsconfig.json

### Type Definitions
- [ ] Create src/types/index.ts
- [ ] Create src/vite-env.d.ts
- [ ] Define all interfaces and types

### Services
- [ ] Migrate apiBaseUrlProvider
- [ ] Migrate refreshTokenService
- [ ] Migrate axiosRequestHandler
- [ ] Migrate bannerConfig

### Components
- [ ] Migrate Banner component
- [ ] Migrate Login component
- [ ] Migrate Register component
- [ ] Migrate Dashboard page
- [ ] Migrate Landing page
- [ ] Migrate Auth page wrapper
- [ ] Migrate App component
- [ ] Migrate main entry point

### Styling
- [ ] Copy all CSS modules
- [ ] Copy global styles
- [ ] Verify CSS imports

### Testing
- [ ] Type check (npx tsc --noEmit)
- [ ] Test development server
- [ ] Test all routes
- [ ] Test authentication flow
- [ ] Test token refresh
- [ ] Test error handling
- [ ] Build production bundle
- [ ] Test production preview

### Deployment
- [ ] Replace old project
- [ ] Initialize/update git
- [ ] Push to remote
- [ ] Create pull request
- [ ] Update documentation
- [ ] Archive old JavaScript version

---

## Benefits Achieved

### Before (JavaScript)
- ❌ Runtime type errors
- ❌ Limited autocomplete
- ❌ Difficult refactoring
- ❌ No type safety for API responses
- ❌ Prone to null/undefined errors

### After (TypeScript)
- ✅ Compile-time type checking
- ✅ Full IntelliSense and autocomplete
- ✅ Safe refactoring with compiler help
- ✅ Type-safe API contracts
- ✅ Null/undefined checks enforced

---

## Next Steps

1. **Team Training:** Ensure team members understand TypeScript basics
2. **Code Reviews:** Enforce TypeScript best practices in PRs
3. **CI/CD:** Add type checking to build pipeline
4. **Testing:** Add unit tests with TypeScript
5. **Documentation:** Keep types and docs in sync

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Vite TypeScript Guide](https://vitejs.dev/guide/features.html#typescript)
- [Axios TypeScript Guide](https://axios-http.com/docs/typescript)

---

## Conclusion

You now have a clean, professional TypeScript setup for MDSystem frontend. This provides:

- Better developer experience
- Fewer bugs in production
- Easier onboarding for new developers
- Safer refactoring and maintenance

**Estimated migration time:** 1-2 days for a clean setup following this guide.

**ROI:** Within weeks, you'll see reduced debugging time and fewer production errors.
