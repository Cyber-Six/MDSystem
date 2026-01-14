# 🚀 Quick Start Guide - MDSystem

## Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Git
- Expo CLI (for mobile)
- Expo Go app (for mobile testing)

## 1️⃣ First Time Setup

### Clone and Install
```bash
# Clone the repository
git clone <your-repo-url>
cd MDSystem

# Install core package
cd packages/core
npm install

# Install web frontend
cd ../../mds-frontend
npm install

# Install mobile app
cd ../mds-mobile
npm install

# Install backend (if needed)
cd ../Backend
npm install
```

## 2️⃣ Running the Applications

### 🌐 Web Application (Development)
```bash
cd mds-frontend
npm run dev
```
- Opens at: `http://localhost:5173`
- Hot reload enabled
- Vite build tool

### 📱 Mobile Application (Expo)
```bash
cd mds-mobile
npm start
```
Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator (macOS only)
- Press `w` for web browser
- Scan QR code with Expo Go app on your phone

### 🔧 Backend API (Development)
```bash
cd Backend
npm start
```
- API runs on configured port
- Check `.env` for configuration

## 3️⃣ Project Overview

### Workspace Structure
```
MDSystem/
├── packages/core/          ← Shared business logic
├── mds-frontend/           ← React web app
├── mds-mobile/             ← React Native mobile app
└── Backend/                ← Node.js API
```

### Key Files

#### Web
- `mds-frontend/src/core.js` - Core services adapter for web
- `mds-frontend/src/types/mdsystem__core.d.ts` - TypeScript declarations

#### Mobile
- `mds-mobile/src/core.js` - Core services adapter for mobile
- `mds-mobile/App.js` - Main app with demo features

#### Core Package
- `packages/core/src/services/` - Service factories
- `packages/core/src/validation/` - Validation utilities

## 4️⃣ Common Tasks

### Build for Production

**Web:**
```bash
cd mds-frontend
npm run build
# Output in: dist/
```

**Mobile:**
```bash
cd mds-mobile
eas build --platform android
eas build --platform ios
```

### Run Tests
```bash
# Core package tests
cd packages/core
npm test

# Frontend tests
cd mds-frontend
npm test
```

### Check for Errors
```bash
# Web build test
cd mds-frontend
npm run build

# Backend syntax check
cd Backend
node --check server.js
```

## 5️⃣ Development Tips

### Using Core Package

**Import services:**
```javascript
import { axiosRequest, TokenStorage } from './src/core';
```

**Import validation:**
```javascript
import { validatePassword } from '@mdsystem/core/validation/password-validation';
import { isValidTipEmail } from '@mdsystem/core/validation/email-validation';
```

### Making API Requests

**Web/Mobile:**
```javascript
// Automatically includes auth token
const response = await axiosRequest.get('/endpoint');
const data = await axiosRequest.post('/endpoint', { body });
```

### Managing Authentication

```javascript
// Check if authenticated
const isAuth = await TokenStorage.getAccessToken();

// Logout
import { logout } from './src/core';
await logout(true); // redirects to login
```

### Banner Notifications

```javascript
import { bannerService } from './src/core';

// Subscribe to banners
useEffect(() => {
  const unsubscribe = bannerService.subscribe(setBanners);
  return unsubscribe;
}, []);

// Show banner manually
bannerService.showBanner({
  type: 'success',
  message: 'Operation successful!',
  statusCode: 200
});
```

## 6️⃣ Troubleshooting

### TypeScript Warnings
If you see "Could not find declaration file":
- Check `mds-frontend/src/types/mdsystem__core.d.ts` exists
- Restart VS Code

### Mobile Build Issues
```bash
cd mds-mobile
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
expo start --clear
```

### Core Package Not Found
```bash
# Reinstall core package
cd mds-frontend  # or mds-mobile
npm install file:../packages/core --force
```

### Port Already in Use
```bash
# Web (change port in vite.config.js)
# Or kill the process
lsof -ti:5173 | xargs kill -9
```

## 7️⃣ Next Steps

### For Web Development
1. Add new pages in `mds-frontend/src/modules/`
2. Use `axiosRequest` for API calls
3. Use validation utilities from core package
4. Follow existing component patterns

### For Mobile Development
1. Set up React Navigation
2. Create screens in `mds-mobile/src/screens/`
3. Use the same core services as web
4. Test on real devices via Expo Go

### For Backend Development
1. Add routes in `Backend/routes/`
2. Use validation from `Backend/config/validator.js`
3. Keep validation in sync with core package

## 8️⃣ Useful Commands

```bash
# Check Node version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version

# Update dependencies
npm update

# Clean install
rm -rf node_modules package-lock.json
npm install

# Check for security issues
npm audit

# Fix security issues
npm audit fix
```

## 📚 Documentation

- [Core Package API](packages/core/README.md)
- [Validation Utilities](packages/core/VALIDATION_UTILITIES.md)
- [Mobile Setup](mds-mobile/README.md)
- [Implementation Summary](SETUP_SUMMARY.md)

## ❓ Getting Help

1. Check documentation in respective README files
2. Review implementation examples in demo apps
3. Check error messages in terminal/console
4. Verify all dependencies are installed

---

**Happy Coding! 🎉**
