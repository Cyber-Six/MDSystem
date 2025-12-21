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
│   │   ├── MDSystem.png
│   │   └── react.svg
│   │
│   ├── components/
│   │   ├── banner/
│   │   │   ├── Banner.jsx
│   │   │   └── Banner.module.css
│   │   ├── data-consent/
│   │   │   ├── data-consent.jsx
│   │   │   └── DataConsent.module.css
│   │   ├── help-support/
│   │   │   ├── contact-support-modal.jsx
│   │   │   ├── faqs-modal.jsx
│   │   │   ├── feedback-modal.jsx
│   │   │   └── help-support-modal.jsx
│   │   ├── layout/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── top-bar.jsx
│   │   ├── modals/
│   │   │   └── modal.jsx
│   │   ├── navbar/
│   │   │   ├── nav-bar.jsx
│   │   │   └── NavBar.module.css
│   │   ├── profile/
│   │   │   └── profile-modal.jsx
│   │   ├── settings/
│   │   │   ├── change-password-modal.jsx
│   │   │   ├── login-activity-modal.jsx
│   │   │   ├── settings-modal.jsx
│   │   │   └── two-factor-auth-modal.jsx
│   │   └── user-menu/
│   │       └── user-menu.jsx
│   │
│   ├── config/
│   │   ├── bannerConfig.js
│   │   └── generated/
│   │       ├── api-endpoints.json (Auto-generated from Google Sheets)
│   │       └── raw-endpoints.csv (Debug: Raw CSV data)
│   │
│   ├── context/
│   │   ├── banner-context.jsx (Banner state management)
│   │   ├── role-context.jsx (Role Provider - subdomain detection)
│   │   ├── RoleContextObject.js (Context object only)
│   │   └── __tests__/
│   │
│   ├── docs/
│   │   ├── apiBaseUrlProvider.md
│   │   ├── API_INTEGRATION_GUIDE.md
│   │   ├── BANNER_SYSTEM.md
│   │   ├── login-integration-notes.md
│   │   ├── PORTAL_TO_ROLE_REFACTORING.md
│   │   ├── Response interceptor - error.md
│   │   ├── ROLE_CONTEXT_USAGE.md
│   │   ├── TAILWIND_SETUP_GUIDE.md
│   │   ├── token-refresh-mechanism.md
│   │   └── TOKEN_SERVICE.md
│   │
│   ├── modules/
│   │   ├── appointment/
│   │   │   └── appointment-page.jsx
│   │   ├── auth/
│   │   │   ├── auth-slides.jsx
│   │   │   ├── forget-password.jsx
│   │   │   ├── login.jsx
│   │   │   └── register.jsx
│   │   ├── dashboard/
│   │   │   └── dashboard-home.jsx
│   │   ├── landing/
│   │   │   └── landing.jsx
│   │   ├── medicine-request/
│   │   │   └── medicine-request-page.jsx
│   │   └── record-forms/
│   │       └── update-record/
│   │           └── record-update-form.jsx
│   │
│   ├── hooks/
│   │   └── useRole.js (exports useDetectRoleFromSubdomain)
│   │
│   ├── pages/
│   │   ├── Auth.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Dashboard_New.jsx
│   │   └── Landing.jsx
│   │
│   ├── routes/
│   │   └── private-route.jsx
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
- **postcss.config.js** - PostCSS configuration with Tailwind CSS
- **tailwind.config.js** - Tailwind CSS v3 custom theme configuration
- **vite.config.js** - Vite configuration with proxy and React Compiler
- **eslint.config.js** - ESLint configuration for React
- **SHEETS_INTEGRATION_GUIDE.md** - Complete guide for Google Sheets integration

### `scripts/` - Build & Automation Scripts
- **fetch-sheets-config.js** - Fetches API endpoint data from Google Sheets and generates JSON

### `src/components/` - Reusable Components
- **banner/Banner.jsx** - Global banner notification component (upper-right, z-index: 9999)
- **banner/Banner.module.css** - Banner styling (green/red/grey color-coded)
- **data-consent/** - Data consent agreement components
- **help-support/** - Help, support, FAQs, and feedback modals
- **layout/** - Main layout components (Layout, Sidebar, TopBar)
- **modals/** - Reusable modal components
- **navbar/** - Navigation bar components
- **profile/** - User profile modal
- **settings/** - Settings modals (password, 2FA, login activity)
- **user-menu/** - User dropdown menu component

### `src/config/` - Application Configuration
- **bannerConfig.js** - HTTP status code configuration for banner notifications
- **generated/** - Auto-generated files from Google Sheets (git-ignored)
  - **api-endpoints.json** - API endpoint routes organized by module
  - **raw-endpoints.csv** - Raw CSV data for debugging

### `src/context/` - React Context
- **banner-context.jsx** - Global banner state management (showBanner, dismissBanner)
- **role-context.jsx** - Provides RoleProvider component with subdomain-based role detection
- **RoleContextObject.js** - Exports RoleContext object only
- **__tests__/** - Context unit tests

### `src/docs/` - Documentation
- **apiBaseUrlProvider.md** - Base URL provider documentation
- **API_INTEGRATION_GUIDE.md** - Comprehensive API integration guide
- **BANNER_SYSTEM.md** - Complete banner system documentation
- **login-integration-notes.md** - Login flow integration notes
- **PORTAL_TO_ROLE_REFACTORING.md** - Portal to role refactoring guide
- **Response interceptor - error.md** - Error handling documentation
- **ROLE_CONTEXT_USAGE.md** - Role context usage patterns
- **TAILWIND_SETUP_GUIDE.md** - Tailwind CSS setup and customization
- **token-refresh-mechanism.md** - Token refresh implementation details
- **TOKEN_SERVICE.md** - Token management and security documentation

### `src/hooks/` - Custom React Hooks
- **useRole.js** - Exports `useDetectRoleFromSubdomain()` hook for role detection

### `src/modules/` - Feature Modules
- **appointment/** - Appointment booking and management
- **auth/** - Authentication components (login, register, auth-slides, forget-password)
- **dashboard/** - Dashboard home and related components
- **landing/** - Landing page components
- **medicine-request/** - Medicine request functionality
- **record-forms/** - Medical record update forms

### `src/pages/` - Page Components
- **Auth.jsx** - Auth page with fullscreen slides, sliding login panel, and centered register modal
- **Dashboard.jsx** - Main dashboard with nested routing (home, appointments, medicine request, etc.)
- **Dashboard_New.jsx** - Alternative dashboard implementation
- **Landing.jsx** - Landing page component

### `src/routes/` - Route Configuration
- **private-route.jsx** - Protected route component with token validation and auth checking

### `src/services/` - API & Business Logic
- **apiBaseUrlProvider.js** - `getApiBaseUrl()` function for subdomain-based URL detection (www.mdsystemtip.space / staff.mdsystemtip.space)
- **axiosRequestHandler.js** - Axios instance with automatic token refresh, request queuing, and banner integration
- **refreshTokenService.js** - Centralized token management (TokenStorage, refreshAccessToken, logout, isAuthenticated)

## Recent Changes
- ✅ Implemented Google Sheets integration for API endpoint documentation
- ✅ Added Tailwind CSS v3 with comprehensive custom theme configuration
- ✅ Created extensive design system with custom colors, typography, and animations
- ✅ Redesigned Auth page with fullscreen auth-slides carousel, sliding login panel, and centered register modal
- ✅ Implemented global banner notification system with type-based styling
- ✅ Extracted token refresh logic to refreshTokenService.js with TokenStorage interface
- ✅ All token operations use TokenStorage for atomic updates and security
- ✅ Banner integration with axios interceptors (configurable status codes)
- ✅ Token refresh uses queue mechanism for concurrent 401s (prevents duplicate refreshes)
- ✅ Logout clears all tokens and redirects with cleanup
- ✅ File naming standardization: lowercase with hyphens for consistency
- ✅ Updated to role-based architecture (RoleContext) detecting subdomain (www = patient, staff = medical)
- ✅ Updated domain configuration to mdsystemtip.space (www / staff subdomains)
- ✅ Created single .env.local file (git-ignored) with .env.example template
- ✅ Removed /api prefix from all URLs (backend uses root routes)
- ✅ Auto-fetch Google Sheets config on `npm run dev`
- ✅ Comprehensive layout system with Sidebar, TopBar, and responsive design
- ✅ User menu with nested panels (main, settings, help & support)
- ✅ Multi-step authentication flows (login with 2FA, registration with email verification)
- ✅ Dashboard with nested routing (home, appointments, medicine request, record update)
- ✅ Dark mode support throughout the application
- ✅ React 19 with React Compiler for automatic optimizations
- ✅ Lucide React icons integration

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
