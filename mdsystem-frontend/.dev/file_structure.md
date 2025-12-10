# Project File Structure

```
mdsystem-frontend/
│
├── .dev/
│   ├── auto-gen-documentation/
│   ├── copilot-context.md
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
│   │   ├── Demo/
│   │   │   └── DemoButton.jsx
│   │   ├── Layout/
│   │   │   ├── Footer.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Layout.jsx
│   │   └── User/
│   │       ├── UserCard.jsx
│   │       ├── UserList.jsx
│   │       └── UserSection.jsx
│   │
│   ├── context/
│   │   ├── PortalContext.jsx (Provider only)
│   │   └── PortalContextObject.js (Context object only)
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   └── login.module.css
│   │   └── dashboard/
│   │       └── dashboard.module.css
│   │
│   ├── hooks/
│   │   └── usePortal.js (exports useDetectPortalFromSubdomain)
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   └── Login.jsx
│   │
│   ├── routes/
│   │   └── PrivateRoute.jsx
│   │
│   ├── services/
│   │   ├── api.js (Base URL detection)
│   │   └── axiosRequest.js (Axios instance with token refresh)
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

### `src/context/` - React Context
- **PortalContext.jsx** - Provides PortalProvider component
- **PortalContextObject.js** - Exports PortalContext object only

### `src/hooks/` - Custom React Hooks
- **usePortal.js** - Exports `useDetectPortalFromSubdomain()` hook

### `src/services/` - API & Request Configuration
- **api.js** - `getApiBaseUrl()` function for subdomain-based URL detection
- **axiosRequest.js** - Axios instance with automatic token refresh

### `src/pages/` - Page Components
- **Login.jsx** - Multi-step login with 2FA and consent
- **Dashboard.jsx** - Main dashboard with portal-specific content

### `src/routes/` - Route Configuration
- **PrivateRoute.jsx** - Protected route component
