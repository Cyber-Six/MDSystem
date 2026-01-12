# Tools and Resources for Development

## MDSystem - Medical Delivery System

**Platform:** Raspberry Pi 5  
**CDN/Proxy/Security:** Cloudflare  
**Last Updated:** January 12, 2026

---

## 📋 Table of Contents

1. [Infrastructure & Hosting](#infrastructure--hosting)
2. [Backend Technologies](#backend-technologies)
3. [Frontend Technologies (Web)](#frontend-technologies-web)
4. [Mobile Technologies](#mobile-technologies)
5. [Shared Core Package](#shared-core-package)
6. [Database & Caching](#database--caching)
7. [Authentication & Security](#authentication--security)
8. [Email & Messaging](#email--messaging)
9. [Development Tools](#development-tools)
10. [Build & Bundling](#build--bundling)
11. [Summary List](#summary-list)

---

## Infrastructure & Hosting

| Tool/Service | Purpose | Version/Notes |
|--------------|---------|---------------|
| **Raspberry Pi 5** | Production Server Platform | Self-hosted server |
| **Cloudflare** | CDN, DDoS Protection, SSL/TLS, Proxy | Tunnels for secure access |
| **Node.js** | Runtime Environment | >=18.0.0 |

---

## Backend Technologies

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **Express.js** | ^5.1.0 | Web server framework (REST API) |
| **Socket.io** | ^4.8.1 | Real-time bidirectional communication |
| **CORS** | - | Cross-Origin Resource Sharing middleware |
| **dotenv** | ^17.2.3 | Environment variable management |

### Database & ORM

| Package | Version | Purpose |
|---------|---------|---------|
| **pg (node-postgres)** | ^8.16.3 | PostgreSQL client for Node.js |

### Caching & Message Queue

| Package | Version | Purpose |
|---------|---------|---------|
| **Redis** | ^5.9.0 | In-memory data store / caching |
| **ioredis** | ^5.8.2 | Redis client with cluster support |
| **BullMQ** | ^5.65.0 | Message queue for background jobs |

### Authentication & Security

| Package | Version | Purpose |
|---------|---------|---------|
| **jsonwebtoken** | ^9.0.2 | JWT token generation & verification |
| **bcrypt** | ^6.0.0 | Password hashing |
| **validator** | ^13.15.20 | String validation & sanitization |
| **xss** | ^1.0.15 | XSS attack prevention |
| **crypto** | (native) | Cryptographic functions |

### Email Services

| Package | Version | Purpose |
|---------|---------|---------|
| **nodemailer** | ^7.0.10 | Email sending (SMTP) |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| **winston** | ^3.18.3 | Logging library |
| **uuid** | ^13.0.0 | UUID generation |
| **multer** | ^2.0.2 | File upload handling |
| **node-fetch** | ^3.3.2 | HTTP client for Node.js |

### External Services

| Service | Purpose |
|---------|---------|
| **Google reCAPTCHA** | Bot protection & CAPTCHA verification |
| **SMTP Server** | Email delivery (Gmail SMTP) |

---

## Frontend Technologies (Web)

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **React** | ^19.2.3 | UI library |
| **React DOM** | ^19.2.3 | React rendering for web |
| **React Router DOM** | ^7.10.1 | Client-side routing |

### HTTP Client

| Package | Version | Purpose |
|---------|---------|---------|
| **Axios** | ^1.13.2 | HTTP client with interceptors |

### UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| **Lucide React** | ^0.562.0 | Icon library |
| **TailwindCSS** | ^3.4.19 | Utility-first CSS framework |
| **PostCSS** | ^8.5.6 | CSS transformations |
| **Autoprefixer** | ^10.4.22 | CSS vendor prefixing |

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| **Vite** | ^7.2.7 | Build tool & dev server |
| **@vitejs/plugin-react** | ^5.1.2 | React plugin for Vite |
| **babel-plugin-react-compiler** | ^1.0.0 | React Compiler optimization |

### Code Quality

| Package | Version | Purpose |
|---------|---------|---------|
| **ESLint** | ^9.39.2 | JavaScript/JSX linter |
| **eslint-plugin-react-hooks** | ^7.0.1 | React Hooks linting rules |
| **eslint-plugin-react-refresh** | ^0.4.24 | Fast Refresh linting |

### TypeScript Support

| Package | Version | Purpose |
|---------|---------|---------|
| **@types/react** | ^19.2.7 | React type definitions |
| **@types/react-dom** | ^19.2.3 | React DOM type definitions |

---

## Mobile Technologies

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **React Native** | 0.81.5 | Mobile app framework |
| **Expo** | ~54.0.30 | React Native toolchain |
| **React** | 19.1.0 | UI library |

### Navigation & Storage

| Package | Version | Purpose |
|---------|---------|---------|
| **@react-native-async-storage/async-storage** | ^2.2.0 | Persistent local storage |
| **react-native-safe-area-context** | ^5.6.2 | Safe area handling |
| **expo-status-bar** | ~3.0.9 | Status bar management |

### Styling

| Package | Version | Purpose |
|---------|---------|---------|
| **NativeWind** | ^2.0.11 | TailwindCSS for React Native |
| **TailwindCSS** | ^3.3.2 | Utility-first CSS framework |

### HTTP Client

| Package | Version | Purpose |
|---------|---------|---------|
| **Axios** | ^1.13.2 | HTTP client with interceptors |

### TypeScript

| Package | Version | Purpose |
|---------|---------|---------|
| **TypeScript** | ~5.9.2 | Type-safe JavaScript |
| **@types/react** | ~19.1.0 | React type definitions |
| **@types/react-native** | ^0.72.8 | React Native type definitions |

---

## Shared Core Package

**Package Name:** `@mdsystem/core`

### Purpose
Platform-agnostic business logic shared between web and mobile applications.

### Exports & Features

| Module | Purpose |
|--------|---------|
| **createApiBaseUrlProvider** | Dynamic API URL management |
| **createTokenService** | JWT token storage & refresh |
| **createAxiosRequestHandler** | Configured Axios with interceptors |
| **BannerService** | Cross-platform notification system |
| **detectRoleFromHostname** | Role detection utility |
| **Email Validation** | Email format & domain validation |
| **Password Validation** | Password strength validation |
| **User Constants** | Shared user-related constants |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **Axios** | ^1.7.9 | HTTP client foundation |

---

## Database & Caching

### PostgreSQL

| Component | Purpose |
|-----------|---------|
| **pg Pool** | Connection pooling |
| **Configurable pool size** | max: 5 connections (default) |
| **Connection timeout** | 10,000ms |
| **Idle timeout** | 30,000ms |

### Redis

| Component | Purpose |
|-----------|---------|
| **Session storage** | JWT refresh tokens, session data |
| **OTP storage** | Email verification codes |
| **Rate limiting** | IP-based request throttling |
| **Message queue backend** | BullMQ job storage |
| **ACL authentication** | Secure user/password access |

---

## Authentication & Security

### JWT Configuration

| Feature | Implementation |
|---------|----------------|
| **Access Tokens** | Short-lived (configurable per role) |
| **Refresh Tokens** | Long-lived (~7 days default) |
| **Token Storage** | Redis-backed sessions |
| **Role-based expiration** | Patient vs Staff tokens |

### Password Security

| Feature | Implementation |
|---------|----------------|
| **Hashing** | bcrypt with 12 salt rounds |
| **Minimum length** | 8 characters |
| **Maximum length** | 64 characters |

### Rate Limiting

| Feature | Implementation |
|---------|----------------|
| **IP-based limiting** | Redis-backed counters |
| **Role-based profiles** | Different limits per user type |
| **Portal-based limiting** | Patient vs Staff portals |

### Security Features

| Feature | Implementation |
|---------|----------------|
| **XSS Protection** | xss sanitization library |
| **Input Validation** | validator.js library |
| **Timing Attack Prevention** | Random delay on auth failures |
| **reCAPTCHA** | Google reCAPTCHA v2/v3 |
| **CORS** | Configured allowed origins |
| **Cloudflare** | DDoS protection & WAF |

---

## Email & Messaging

### Email Queue System (BullMQ)

| Feature | Implementation |
|---------|----------------|
| **Queue Name** | emailQueue |
| **Retry Attempts** | 5 attempts |
| **Backoff Strategy** | Exponential (1s initial) |
| **Job Types** | Verification, 2FA, Password Reset |

### Email Templates

| Template | Purpose |
|----------|---------|
| **Email Verification** | Account activation OTP |
| **2FA OTP** | Two-factor authentication |
| **Password Reset** | Secure password recovery link |

### SMTP Configuration

| Setting | Default |
|---------|---------|
| **Host** | smtp.gmail.com |
| **Port** | 465 (secure) |
| **Secure** | TLS enabled |

---

## Development Tools

### Package Managers

| Tool | Purpose |
|------|---------|
| **npm** | Node package management |

### Code Quality

| Tool | Purpose |
|------|---------|
| **ESLint** | JavaScript/TypeScript linting |
| **TypeScript** | Static type checking (mobile) |

### Logging

| Tool | Purpose |
|------|---------|
| **Winston** | Application logging |
| **Daily log rotation** | File-based log management |

### Version Control

| Tool | Purpose |
|------|---------|
| **Git** | Source code management |

---

## Build & Bundling

### Web (mds-frontend)

| Tool | Configuration |
|------|---------------|
| **Vite** | ES modules, HMR, optimized builds |
| **TailwindCSS** | JIT compilation |
| **PostCSS** | CSS processing pipeline |
| **React Compiler** | Automatic optimization |

### Mobile (mds-mobile)

| Tool | Configuration |
|------|---------------|
| **Expo** | Managed workflow |
| **Metro** | React Native bundler |
| **Babel** | Transpilation with presets |
| **TypeScript** | Type checking & compilation |

### Shared (packages/core)

| Tool | Configuration |
|------|---------------|
| **ES Modules** | Native ESM exports |
| **Subpath exports** | Granular module access |

---

## Summary List

### 🖥️ Infrastructure
- Raspberry Pi 5 (Server)
- Cloudflare (CDN/Security/Proxy)
- Node.js >= 18.0.0

### 🗄️ Database & Cache
- PostgreSQL (Database)
- Redis (Cache/Sessions/Queue)

### ⚙️ Backend Stack
- Express.js 5.x
- Socket.io
- BullMQ (Job Queue)
- jsonwebtoken (JWT)
- bcrypt (Password Hashing)
- nodemailer (Email)
- Winston (Logging)

### 🌐 Web Frontend Stack
- React 19.x
- React Router DOM 7.x
- Vite 7.x
- TailwindCSS 3.x
- Axios
- ESLint

### 📱 Mobile Stack
- React Native 0.81.x
- Expo 54.x
- NativeWind
- TypeScript 5.x
- AsyncStorage

### 🔐 Security
- JWT Authentication
- bcrypt (12 rounds)
- Google reCAPTCHA
- XSS Protection
- Rate Limiting (Redis)
- Cloudflare WAF

### 📧 Email Services
- Nodemailer (SMTP)
- BullMQ Email Queue
- Gmail SMTP (default)

### 🔧 Shared Core
- @mdsystem/core package
- Token Service
- API URL Provider
- Banner/Notification System
- Input Validation

### 🛠️ Dev Tools
- npm
- ESLint
- TypeScript
- Git

---

## Environment Variables Required

### Backend (.env)
```
# Database
POSTGRES_HOST=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
POSTGRES_PORT=5432

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0

# JWT
JWT_SECRET=
JWT_PATIENT_ACCESS_EXPIRATION=
JWT_STAFF_ACCESS_EXPIRATION=
JWT_REFRESH_EXPIRATION=604800

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
EMAIL_DELAY=1000

# OTP Expiration (seconds)
EMAIL_VERIF_EXPIRATION=300
EMAIL_2FA_EXPIRATION=300
EMAIL_PASSWD_RESET_EXPIRATION=900

# reCAPTCHA
RECAPTCHA_SECRET_KEY=
RECAPTCHA_TEST_MODE=false

# Server
HOST=
PATIENT_PORT=3001

# Logging
LOGGER_DIR=logs
LOG_LEVEL=info
```

### Frontend (.env.local)
```
VITE_DEV_PORTAL=www
```

---

## Project Structure Overview

```
MDSystem/
├── Backend/              # Express.js API Server
│   ├── config/           # Configuration modules
│   ├── routes/           # API endpoints
│   └── services/         # Business logic services
├── mds-frontend/         # React Web Application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context providers
│   │   ├── modules/      # Feature modules
│   │   ├── pages/        # Page components
│   │   └── services/     # API service layer
├── mds-mobile/           # React Native Mobile App
│   └── src/
│       ├── components/   # Mobile UI components
│       ├── context/      # React context providers
│       └── screens/      # Screen components
└── packages/
    └── core/             # Shared business logic
        └── src/
            ├── config/   # Shared configurations
            ├── services/ # Core services
            ├── utils/    # Utility functions
            └── validation/ # Validation logic
```

---

*This document serves as a reference for all tools, technologies, and resources used in the MDSystem development project.*
