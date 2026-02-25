# MDSystem - Medical Data Management System

A comprehensive medical data management platform built with **React 19** (web), **React Native/Expo** (mobile), and **Node.js/Express** (backend), designed for the TIP (Technological Institute of the Philippines) ecosystem. The system provides secure patient portals, staff management, and medical consultation features across multiple subdomains with a **monorepo architecture** sharing business logic between web and mobile.

---

## 🏥 Overview

**MDSystem** is a multi-portal healthcare management platform that serves three distinct user groups:
- **Patient Portal** (`www.mdsystemtip.space`) - Medical records, appointments, e-consultation
- **Staff Portal** (`staff.mdsystemtip.space`) - Administrative and medical staff interface  
- **Medical Portal** (`medic.mdsystemtip.space`) - Advanced medical professional tools

### Platform Support
- 🌐 **Web Application** - React 19 + Vite
- 📱 **Mobile Application** - React Native + Expo (iOS & Android)
- 🔄 **Shared Core** - Platform-agnostic business logic package

---

## 📁 Repository Structure

```
MDSystem/
├── Backend/                 # Node.js/Express API server
│   ├── config/              # Database, JWT, Redis, security configs
│   │   ├── data/            # Data matrices and mappings
│   │   └── middleware/      # Rate limiting, security middleware
│   ├── routes/              # API route handlers
│   │   ├── auth/            # Authentication endpoints
│   │   ├── patient/         # Patient data & consent management
│   │   └── utils/           # Utility routes (portal detection, auth sessions)
│   ├── services/            # Email service, reCAPTCHA validation
│   ├── server.js            # Patient backend entry point (port 3001)
│   └── staff.js             # Staff backend entry point (port 3002)
│
├── mds-patient/             # React 19 + Vite — Patient portal
│   ├── src/
│   │   ├── components/      # Reusable UI components (banner, layout, modals)
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── modules/         # Feature modules (auth, appointment, records)
│   │   ├── pages/           # Page components (Auth, Dashboard)
│   │   ├── services/        # API service layer
│   │   ├── styles/          # Global CSS & design system
│   │   └── utils/           # Utility functions
│   └── public/              # Static assets
│
├── mds-staff/               # React 19 + Vite — Staff portal
│   ├── src/
│   │   ├── components/      # Reusable UI components (banner, layout, modals)
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── modules/         # Feature modules (auth, appointment, dashboard)
│   │   ├── pages/           # Page components (Auth, Dashboard, etc.)
│   │   └── styles/          # Global CSS & design system
│   └── public/              # Static assets
│
├── mds-mobile/              # React Native + Expo mobile app
│   ├── src/
│   │   ├── components/      # Mobile UI components
│   │   ├── context/         # React Native contexts
│   │   └── screens/         # App screens (auth, dashboard)
│   └── assets/              # Mobile assets (images, fonts)
│
├── packages/
│   └── core/                # @mdsystem/core — Shared business logic
│       └── src/
│           ├── config/      # Banner configuration
│           ├── services/    # API, token, banner services
│           ├── utils/       # Role detection utilities
│           └── validation/  # Email, password validation
│
├── LICENSE                  # Proprietary license (Cyber-Six)
└── README.md                # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **PostgreSQL** 14+ (for backend database)
- **Redis** 6+ (for session management)
- **Expo CLI** (for mobile development)

### Monorepo Setup (Recommended)

```bash
# Clone and install root dependencies
git clone https://github.com/Cyber-Six/MDSystem.git
cd MDSystem
npm install

# This links the @mdsystem/core package for all projects
```

### Backend Setup

```bash
cd Backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database and service credentials

# Start development server
npm start                    # Production mode
```

**Backend runs on:** `http://localhost:3001`

### Web Frontend Setup

**Patient Portal:**
```bash
cd mds-patient
npm run dev
```
**Patient portal runs on:** `http://localhost:5173`

**Staff Portal:**
```bash
cd mds-staff
npm run dev
```
**Staff portal runs on:** `http://localhost:5174`

### Mobile App Setup

```bash
cd mds-mobile
npm install

# Start Expo development server
npm start

# Or run directly on platform
npm run android              # Android emulator/device
npm run ios                  # iOS simulator (macOS only)
npm run web                  # Web browser
```

**Scan QR code** with Expo Go app on your device

---

## 🌐 Domain Architecture

### Production Domains
- **Patient Portal:** `https://www.mdsystemtip.space`
- **Staff Portal:** `https://staff.mdsystemtip.space`  

### Subdomain-Based Routing
The application automatically detects the subdomain and adjusts:
- API base URL routing
- User interface theme/branding
- Available features and permissions
- Role-based access control

---

## 🔑 Key Features

### Authentication & Security
- **JWT-based authentication** with access + refresh tokens
- **Email verification** with OTP (6-digit codes)
- **Two-Factor Authentication (2FA)** via email
- **Google reCAPTCHA v3** integration
- **Token refresh queue** - prevents race conditions on concurrent 401s
- **Secure password reset** with UUID-based reset links
- **Role-based access control** (student, employee, staff, admin)

### Shared Core Package (`@mdsystem/core`)
- 🔄 **Platform-agnostic** business logic
- 🏭 **Factory patterns** for dependency injection
- 🔐 **Token service** - localStorage (web) / AsyncStorage (mobile)
- 🌐 **API base URL provider** - automatic subdomain detection
- 📡 **Axios request handler** - unified HTTP client with auth
- 🔔 **Banner service** - cross-platform notifications
- ✅ **Validation utilities** - email, password, user constants

### Web Frontend Highlights
- ⚡ **Lightning-fast** with Vite 7 + React 19
- 🎨 **Tailwind CSS v3** with custom design system
- 🔄 **Automatic token refresh** with request queuing
- 🔔 **Global banner notifications** for error/success messages
- 📱 **Responsive design** - mobile-first approach
- 🎯 **Portal auto-detection** from subdomain
- 📊 **Google Sheets integration** for API documentation
- 🧪 **React Compiler** support via Babel plugin

### Mobile App Highlights
- 📱 **Expo ~54** for simplified development
- 🎨 **NativeWind** - Tailwind CSS for React Native
- 🔤 **TypeScript** - Full type safety
- 🔄 **Shared business logic** via `@mdsystem/core`
- 🎨 **Consistent design system** - shares Tailwind config with web
- 💾 **AsyncStorage** for secure token persistence

### Backend Capabilities
- **RESTful API** with Express.js 5
- **PostgreSQL database** with parameterized queries
- **Redis caching** for session management
- **Email service** with BullMQ worker queue
- **Rate limiting** to prevent abuse
- **CORS configuration** for multi-subdomain support
- **Security middleware** (XSS protection, input validation)
- **Socket.io** support for real-time features

---

## 📚 Documentation

### Web Frontend Documentation
Located in `mds-frontend/src/docs/` (legacy reference docs):
- **[API_INTEGRATION_GUIDE.md](mds-frontend/src/docs/API_INTEGRATION_GUIDE.md)** - API integration patterns
- **[BANNER_SYSTEM.md](mds-frontend/src/docs/BANNER_SYSTEM.md)** - Global banner notification system
- **[TOKEN_SERVICE.md](mds-frontend/src/docs/TOKEN_SERVICE.md)** - Token management details
- **[token-refresh-mechanism.md](mds-frontend/src/docs/token-refresh-mechanism.md)** - Token refresh flow
- **[ROLE_CONTEXT_USAGE.md](mds-frontend/src/docs/ROLE_CONTEXT_USAGE.md)** - Role-based access control
- **[apiBaseUrlProvider.md](mds-frontend/src/docs/apiBaseUrlProvider.md)** - API URL configuration

### Core Package Documentation
Located in `packages/core/`:
- **[README.md](packages/core/README.md)** - Complete core package documentation
- **[VALIDATION_UTILITIES.md](packages/core/src/validation/VALIDATION_UTILITIES.md)** - Email & password validation

### Mobile App Documentation
- **[README.md](mds-mobile/README.md)** - Mobile app setup and architecture

---

## 🛠️ Development Workflow

### Web Frontend Development
```bash
# Patient portal
cd mds-patient
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint

# Staff portal
cd mds-staff
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Mobile Development
```bash
cd mds-mobile

npm start                # Start Expo development server
npm run android          # Run on Android
npm run ios              # Run on iOS (macOS only)
npm run web              # Run in browser
```

### Backend Development
```bash
cd Backend

npm start                # Production server
```

### Core Package Development
```bash
cd packages/core

# Changes auto-resolve via npm workspaces — no reinstall needed
```

### Environment Variables

**Web Frontend (`.env.local`):**
```env
VITE_API_URL=http://localhost:3001
VITE_PATIENT_API_URL=https://www.mdsystemtip.space
VITE_STAFF_API_URL=https://staff.mdsystemtip.space
ENDPOINTS_SHEET_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
```

**Backend (`.env`):**
```env
PATIENT_PORT=3001
HOST=localhost
# Database, JWT, and Redis configs in config/config.json
```

**Backend (`config/config.json`):**
```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "mdsystem",
    "user": "postgres",
    "password": "your_password"
  },
  "jwt": {
    "accessTokenSecret": "your_access_secret",
    "refreshTokenSecret": "your_refresh_secret"
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
```

---

## 🧪 Testing

### Web Frontend Testing
```bash
cd mds-patient
npm run lint             # Code quality checks

cd mds-staff
npm run lint             # Code quality checks
```

### Core Package Testing
```bash
cd packages/core
npm test                 # Run test suite
```

---

## 📦 Deployment

### Web Frontend (Vite Build)
```bash
# Patient portal
cd mds-patient
npm run build            # Creates optimized build in dist/

# Staff portal
cd mds-staff
npm run build            # Creates optimized build in dist/
```

Deploy the `dist/` folders to your hosting service or let the backend serve them.

### Mobile App (Expo)
```bash
cd mds-mobile

# Build for production
npx expo build:android   # Android APK/AAB
npx expo build:ios       # iOS IPA (requires Apple Developer account)

# Or use EAS Build
npx eas build --platform android
npx eas build --platform ios
```

### Backend (Node.js Server)
```bash
cd Backend
npm start                # Production mode

# Or use PM2 for process management:
pm2 start server.js --name mdsystem-backend
pm2 startup              # Auto-start on reboot
pm2 save
```

### Nginx Configuration (Multi-subdomain)
```nginx
# Patient Portal (www)
server {
    server_name www.mdsystemtip.space;
    location / {
        proxy_pass http://localhost:5173;  # Frontend
    }
    location /api {
        proxy_pass http://localhost:3001;  # Backend
    }
}

# Staff Portal
server {
    server_name staff.mdsystemtip.space;
    location / {
        proxy_pass http://localhost:5173;  # Same frontend (detects subdomain)
    }
    location /api {
        proxy_pass http://localhost:3001;  # Backend
    }
}
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Coding Standards
- Follow **ESLint** rules (run `npm run lint`)
- Use **CSS Modules** for component-scoped styles (web)
- Use **NativeWind** classes for mobile styling
- Write **descriptive commit messages**
- Keep shared logic in `packages/core`

---

## 📄 License

This project is **proprietary software** owned by Cyber-Six. All rights reserved. See the [LICENSE](LICENSE) file for details.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without prior written permission.

---

## 👥 Team

**Project Owner:** Cyber-Six  
**Institution:** Technological Institute of the Philippines (TIP)

### Contact
- **Email:** jennifer.enriquez@tip.edu.ph, allegofg.cpe@tip.edu.ph
- **Repository:** https://github.com/K1taru/MDSystem

---

## 📝 Changelog

### Latest Updates
- ✅ **Split Web Apps** - Separate `mds-patient` and `mds-staff` portals
- ✅ **Monorepo Architecture** - Unified workspace with shared packages
- ✅ **@mdsystem/core Package** - Platform-agnostic business logic
- ✅ **Mobile App (mds-mobile)** - React Native + Expo implementation
- ✅ **NativeWind Integration** - Shared Tailwind styles across platforms
- ✅ **TypeScript Support** - Full type safety for mobile app
- ✅ **Factory Pattern Services** - Dependency injection for platform support
- ✅ **Google Sheets Integration** - Auto-generate API docs from spreadsheets
- ✅ **Auth Page Redesign** - Fullscreen landing with sliding panel
- ✅ **Token Refresh Queue** - Prevents duplicate refresh requests
- ✅ **Global Banner System** - Cross-platform notifications
- ✅ **Multi-subdomain Support** - Patient, Staff, Medical portals

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MDSystem Monorepo                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ mds-patient  │  │  mds-staff   │  │     mds-mobile       │  │
│  │  (React 19)  │  │  (React 19)  │  │     (Expo)           │  │
│  │   + Vite     │  │   + Vite     │  │     + RN             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘  │
│         │                  │                 │                   │
│         ▼                  ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────┐            │
│  │             @mdsystem/core                      │            │
│  │          (Shared Business Logic)                │            │
│  ├─────────────────────────────────────────────────┤            │
│  │ • Token Service (Factory)                       │            │
│  │ • API Base URL Provider                         │            │
│  │ • Axios Request Handler                         │            │
│  │ • Banner Service                                │            │
│  │ • Validation Utilities                          │            │
│  │ • Role Detection                                │            │
│  └─────────────────────────────────────────────────┘            │
│                       ▲                                          │
│                       │ REST API                                 │
│  ┌────────────────────┴─────────────────────────────┐           │
│  │                Backend                            │           │
│  │  server.js (Patient :3001) │ staff.js (Staff :3002)│          │
│  │  Express.js 5 + PostgreSQL + Redis                │           │
│  └───────────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

<div align="center">

**Built with ❤️ for the TIP Healthcare Community**

[Report Bug](https://github.com/K1taru/MDSystem/issues) · [Request Feature](https://github.com/K1taru/MDSystem/issues)

</div>