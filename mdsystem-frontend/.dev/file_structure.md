# Project File Structure

```
mdsystem-frontend/
│
├── .dev/
│   ├── auto-gen-documentation/
│   ├── copilot-context.md
│   ├── docs/
│   │   └── BANNER_SYSTEM.md
│   ├── file_structure.md
│   ├── login-integration-notes.md
│   └── token-refresh-mechanism.md
│
├── public/
│   ├── MDSystem.png
│   └── vite.svg
│
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   │
│   ├── assets/
│   │   └── react.svg
│   │
│   ├── components/
│   │   └── banner/
│   │       ├── Banner.jsx
│   │       └── Banner.module.css
│   │
│   ├── config/
│   │   └── bannerConfig.js
│   │
│   ├── context/
│   │   ├── BannerContext.jsx
│   │   ├── PortalContext.jsx (Provider only)
│   │   └── PortalContextObject.js (Context object only)
│   │
│   ├── docs/
│   │   ├── API_INTEGRATION_GUIDE.md
│   │   ├── BANNER_SYSTEM.md
│   │   ├── TOKEN_SERVICE.md
│   │   ├── login-integration-notes.md
│   │   └── token-refresh-mechanism.md
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── auth.module.css
│   │   │   ├── login.module.css
│   │   │   └── register.module.css
│   │   ├── dashboard/
│   │   │   └── dashboard.module.css
│   │   └── landing/
│   │       └── landing.module.css
│   │
│   ├── hooks/
│   │   └── usePortal.js (exports useDetectPortalFromSubdomain)
│   │
│   ├── pages/
│   │   ├── .dev_tips_pages.md
│   │   ├── Auth.jsx
│   │   ├── Dashboard.jsx
│   │   └── Landing.jsx
│   │
│   ├── routes/
│   │   └── PrivateRoute.jsx
│   │
│   ├── services/
│   │   ├── api.js (Base URL detection)
│   │   ├── axiosRequest.js (Axios with token refresh & banner integration)
│   │   └── tokenService.js (Centralized token management)
│   │
│   └── styles/
│       ├── App.css
│       └── index.css
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

## Key Directories & Files

### `.dev/` - Development Documentation
- **copilot-context.md** - Copilot context and best practices
- **file_structure.md** - This file
- **login-integration-notes.md** - Login flow and reCAPTCHA integration guide
- **token-refresh-mechanism.md** - JWT token refresh implementation
- **docs/BANNER_SYSTEM.md** - Banner notification system documentation

### `src/components/` - Reusable Components
- **banner/Banner.jsx** - Global banner notification component (upper-right, z-index: 9999)
- **banner/Banner.module.css** - Banner styling (green/red/grey color-coded)

### `src/config/` - Application Configuration
- **bannerConfig.js** - HTTP status code configuration for banner notifications

### `src/context/` - React Context
- **BannerContext.jsx** - Global banner state management (showBanner, dismissBanner)
- **PortalContext.jsx** - Provides PortalProvider component
- **PortalContextObject.js** - Exports PortalContext object only

### `src/docs/` - Documentation
- **API_INTEGRATION_GUIDE.md** - API integration guide
- **BANNER_SYSTEM.md** - Complete banner system documentation
- **TOKEN_SERVICE.md** - Token management and security documentation
- **login-integration-notes.md** - Login flow notes
- **token-refresh-mechanism.md** - Token refresh implementation

### `src/hooks/` - Custom React Hooks
- **usePortal.js** - Exports `useDetectPortalFromSubdomain()` hook

### `src/modules/` - Feature Modules
- **auth/** - Authentication components (Login, Register) with CSS modules
- **dashboard/** - Dashboard-specific styles
- **landing/** - Landing page styles

### `src/pages/` - Page Components
- **Auth.jsx** - Split-layout auth page (login panel + register center)
- **Dashboard.jsx** - Main dashboard with portal-specific content
- **Landing.jsx** - Landing page with portal detection and auto-redirect

### `src/routes/` - Route Configuration
- **PrivateRoute.jsx** - Protected route component

### `src/services/` - API & Business Logic
- **api.js** - `getApiBaseUrl()` function for subdomain-based URL detection
- **axiosRequest.js** - Axios instance with automatic token refresh and banner integration
- **tokenService.js** - Centralized token management (TokenStorage, refreshAccessToken, logout, isAuthenticated)

## Recent Changes
- ✅ Implemented global banner notification system
- ✅ Extracted token refresh logic to tokenService.js
- ✅ All token operations use TokenStorage for security
- ✅ Banner shows backend error codes and messages
- ✅ Token refresh properly handles 401 with queuing
- ✅ Logout clears all tokens and redirects
- ✅ Case-sensitive paths verified (banner folder lowercase)
