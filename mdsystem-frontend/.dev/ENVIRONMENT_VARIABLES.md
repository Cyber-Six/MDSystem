# Environment Variables Configuration

## ⚠️ Security Notice

The `.env` file is **GIT-IGNORED** and should **NEVER** be committed to the repository. This prevents exposing sensitive configuration in our public GitHub repository.

## Overview

This project uses a **single `.env` file** for all environment configuration.

## Files

### `.env` (YOUR CONFIGURATION - GIT-IGNORED ❌)
**DO NOT commit this file!** Contains your actual configuration values.

```bash
# This file is ignored by git
# Safe to put actual values here
```

### `.env.example` (TEMPLATE - COMMITTED ✅)
Template showing all available environment variables. 

**New team members:** Copy this to `.env` when setting up the project.

## Quick Setup

```bash
# 1. Copy the example file to create your .env
cp .env.example .env

# 2. (Optional) Edit .env with your custom values
nano .env

# 3. Start development
npm run dev
```

## Environment Variables Reference

| Variable | Purpose | Default | Used In |
|----------|---------|---------|---------||
| `VITE_API_URL` | Local development backend URL | `http://localhost:3001` | `apiBaseUrlProvider.js` |
| `VITE_PATIENT_API_URL` | Patient portal API URL (www subdomain) | `https://www.mdsystemtip.space` | `apiBaseUrlProvider.js` |
| `VITE_STAFF_API_URL` | Staff portal API URL (staff subdomain) | `https://staff.mdsystemtip.space` | `apiBaseUrlProvider.js` |

## Usage in Code

### apiBaseUrlProvider.js
```javascript
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }
  
  if (hostname.startsWith('staff.')) {
    return import.meta.env.VITE_STAFF_API_URL || `https://${hostname}/api`;
  }
  
  return import.meta.env.VITE_PATIENT_API_URL || `https://${hostname}/api`;
}
```

### Used By:
- ✅ **axiosRequestHandler.js** - Sets `baseURL` for axios instance
- ✅ **refreshTokenService.js** - Builds URLs for `/auth/refresh` and `/auth/logout`

## How It Works

### Development (`npm run dev`)
Vite loads `.env` file and makes `VITE_*` variables available.

```javascript
// In apiBaseUrlProvider.js
const apiUrl = import.meta.env.VITE_API_URL;
// Returns: http://localhost:3001 (from your .env)
```

### Production Build (`npm run build`)
Same `.env` file is used. For production deployment, set environment variables in your hosting platform instead.

## Hostname Detection Logic

| User Visits | Detected Hostname | Env Var Used | Final API URL |
|-------------|-------------------|--------------|---------------|
| `localhost:5173` | `localhost` | `VITE_API_URL` | `http://localhost:3001` |
| `www.mdsystemtip.space` | `www.mdsystemtip.space` | `VITE_PATIENT_API_URL` | `https://www.mdsystemtip.space` |
| `staff.mdsystemtip.space` | `staff.mdsystemtip.space` | `VITE_STAFF_API_URL` | `https://staff.mdsystemtip.space` |

## Fallback Behavior

If environment variable is **not set**, the code falls back to:
```javascript
// Staff portal fallback
`https://${hostname}`  // e.g., https://staff.mdsystemtip.space

// Patient portal fallback
`https://${hostname}`  // e.g., https://www.mdsystemtip.space

// Local development fallback
'http://localhost:3001'
```

This means the app will work even without `.env` files, using dynamic hostname detection.

## Creating Personal Overrides

### For Custom Backend Port:
```bash
# .env.local
VITE_API_URL=http://localhost:5000
```

### For Testing with Custom Domains:
```bash
# .env.local
VITE_PATIENT_API_URL=http://www.mdsystem.local:3001/api
VITE_STAFF_API_URL=http://staff.mdsystem.local:3001/api
```

Add to hosts file:
```
127.0.0.1  www.mdsystem.local
127.0.0.1  staff.mdsystem.local
```

## Deployment Configuration

### Important: DO NOT commit .env to git!

For production deployment, set environment variables in your hosting platform's dashboard.

### Vercel
Project Settings → Environment Variables:
```
VITE_API_URL = http://localhost:3001
VITE_PATIENT_API_URL = https://www.mdsystemtip.space
VITE_STAFF_API_URL = https://staff.mdsystemtip.space
```

### Netlify
Site Settings → Build & Deploy → Environment:
```
VITE_PATIENT_API_URL = https://www.mdsystemtip.space
VITE_STAFF_API_URL = https://staff.mdsystemtip.space
```

### Docker
```dockerfile
ARG VITE_PATIENT_API_URL=https://www.mdsystemtip.space
ARG VITE_STAFF_API_URL=https://staff.mdsystemtip.space
ENV VITE_PATIENT_API_URL=$VITE_PATIENT_API_URL
ENV VITE_STAFF_API_URL=$VITE_STAFF_API_URL
```

## Security Notes

1. ✅ **`.env` is git-ignored** - Never committed to repository
2. ✅ **`.env.example` is committed** - Safe template for team
3. ✅ **VITE_** prefix required - Only these are exposed to client
4. ⚠️ **Never store secrets** - API keys, passwords don't belong here
5. ⚠️ All `VITE_*` variables are **public** - Visible in built JavaScript
6. ✅ **Use hosting platform env vars** for production - Not .env file

## Verification

To verify environment variables are loaded:

### Development
```bash
npm run dev
# Open browser console:
console.log(import.meta.env.VITE_API_URL)
```

### Production Build
```bash
npm run build
# Check dist/ output - variables will be replaced with actual values
```

## Troubleshooting

### Variables not loading?
1. Variable must start with `VITE_`
2. Restart dev server after changing `.env`
3. Check file is in project root (same level as `package.json`)

### Wrong URL in production?
1. Check `.env.production` exists and has correct values
2. Verify build command uses production mode
3. Check hosting platform environment variables override `.env.production`

## Files Summary

```
mdsystem-frontend/
├── .env                  ❌ GIT-IGNORED - Your actual config (DO NOT COMMIT!)
├── .env.example          ✅ COMMITTED - Template for team
├── .gitignore            (ignores .env, .env.local, .env.*.local)
└── src/services/
    └── apiBaseUrlProvider.js  (uses these variables)
```

## Git Status Check

Before committing, always verify `.env` is not staged:

```bash
git status

# Should NOT see:
# ❌ new file: .env

# Should see:
# ✅ new file: .env.example
```

If you accidentally stage `.env`:
```bash
git reset .env  # Unstage it
git rm --cached .env  # Remove from git if already committed
```
