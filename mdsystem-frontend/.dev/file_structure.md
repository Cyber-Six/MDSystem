# Project File Structure

```
mdsystem-frontend/
│
├── .dev/
│   ├── auto-gen-documentation/
│   ├── copilot-context.md
│   ├── CSS_GUIDELINES.md
│   ├── ENVIRONMENT_VARIABLES.md
│   ├── file_structure.md
│   ├── login-integration-notes.md
│   ├── SHEETS_INTEGRATION_GUIDE.md
│   └── token-refresh-mechanism.md
│
├── .env.local (Git-ignored - your actual configuration, DO NOT COMMIT!)
├── .env.example (Committed - template for team)
│
├── public/
│   ├── MDSystem.png
│   └── vite.svg
│
├── scripts/
│   └── fetch-sheets-config.js (Google Sheets to JSON converter)
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
│   │   ├── bannerConfig.js
│   │   └── generated/
│   │       ├── api-endpoints.json (Auto-generated from Google Sheets)
│   │       └── raw-endpoints.csv (Debug: Raw CSV data)
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
│   │   ├── apiBaseUrlProvider.js (Base URL detection for mdsystemtip.space)
│   │   ├── axiosRequestHandler.js (Axios with token refresh & banner integration)
│   │   └── refreshTokenService.js (Centralized token management & refresh logic)
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
├── postcss.config.js
├── README.md
├── SHEETS_INTEGRATION_GUIDE.md
├── tailwind.config.js
└── vite.config.js
```

## Key Directories & Files

### `.dev/` - Development Documentation
- **copilot-context.md** - Copilot context and best practices
- **CSS_GUIDELINES.md** - CSS design system and styling conventions
- **ENVIRONMENT_VARIABLES.md** - Complete guide to environment variables configuration
- **file_structure.md** - This file
- **login-integration-notes.md** - Login flow and reCAPTCHA integration guide
- **SHEETS_INTEGRATION_GUIDE.md** - Google Sheets integration for API endpoints
- **token-refresh-mechanism.md** - JWT token refresh implementation

### Root Configuration Files
- **.env.local** - Your environment variables (git-ignored, DO NOT COMMIT!)
- **.env.example** - Template showing available variables (committed to git)
- **postcss.config.js** - PostCSS configuration with Tailwind CSS v4
- **tailwind.config.js** - Tailwind CSS custom theme configuration
- **SHEETS_INTEGRATION_GUIDE.md** - Complete guide for Google Sheets integration

### `scripts/` - Build & Automation Scripts
- **fetch-sheets-config.js** - Fetches API endpoint data from Google Sheets and generates JSON

### `src/components/` - Reusable Components
- **banner/Banner.jsx** - Global banner notification component (upper-right, z-index: 9999)
- **banner/Banner.module.css** - Banner styling (green/red/grey color-coded)

### `src/config/` - Application Configuration
- **bannerConfig.js** - HTTP status code configuration for banner notifications
- **generated/** - Auto-generated files from Google Sheets (git-ignored)
  - **api-endpoints.json** - API endpoint routes organized by module
  - **raw-endpoints.csv** - Raw CSV data for debugging

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
- **apiBaseUrlProvider.js** - `getApiBaseUrl()` function for subdomain-based URL detection (www.mdsystemtip.space / staff.mdsystemtip.space)
- **axiosRequestHandler.js** - Axios instance with automatic token refresh, request queuing, and banner integration
- **refreshTokenService.js** - Centralized token management (TokenStorage, refreshAccessToken, logout, isAuthenticated)

## Recent Changes
- ✅ Implemented Google Sheets integration for API endpoint documentation
- ✅ Added Tailwind CSS v4 with PostCSS configuration
- ✅ Created comprehensive CSS design system with custom properties
- ✅ Redesigned Auth page with fullscreen landing and sliding login panel
- ✅ Implemented global banner notification system
- ✅ Extracted token refresh logic to refreshTokenService.js
- ✅ All token operations use TokenStorage for atomic updates
- ✅ Banner shows backend error codes and messages
- ✅ Token refresh uses queue mechanism for concurrent 401s
- ✅ Logout clears all tokens and redirects
- ✅ File naming: axiosRequest → axiosRequestHandler, tokenService → refreshTokenService, api → apiBaseUrlProvider
- ✅ Updated domain configuration to mdsystemtip.space (www / staff subdomains)
- ✅ Created single .env.local file (git-ignored) with .env.example template
- ✅ Removed /api prefix from all URLs (backend uses root routes)
- ✅ Auto-fetch Google Sheets config on `npm run dev`

## Build Tool & Environment

### Vite (Lightning Fast Build Tool)
- **Dev Server:** `npm run dev` - Starts in ~1 second with instant HMR
- **Production Build:** `npm run build` - Optimized bundle with Rollup
- **Preview:** `npm run preview` - Preview production build locally

### Environment Variables
- **Syntax:** `import.meta.env.VITE_*` (Vite's ES module standard)
- **Why not process.env?** Vite uses modern ES module standard `import.meta.env`
- **Security:** Only variables prefixed with `VITE_` are exposed to client-side code
- **Build Time:** Variables are replaced at build time with actual values
