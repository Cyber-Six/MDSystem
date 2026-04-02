# Staff Member Branch/Location Information - Complete Map

## Overview
This document describes how logged-in staff members' branch/location/clinic information is stored, retrieved, and accessed across the mds-staff and packages/core codebase.

---

## 1. DATA STORAGE

### Backend Database
**Table**: `UsersPersonal`
**Column**: `branch` (TEXT)
**Values**: `'Manila'`, `'QuezonCity'`, `'Both'`

```sql
CREATE TABLE "UsersPersonal" (
  id TEXT PRIMARY KEY,
  branch TEXT,
  ...
);
```

### Database Query Function
**File**: [Backend/config/query.js](Backend/config/query.js)

```javascript
async function getUserBranch(userId) {
  const sql = `
    SELECT branch
    FROM "UsersPersonal"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) {
      logger.debug(`No branch found for userId=${userId}`);
      return null;
    }
    return result.rows[0].branch; 
  } catch (err) {
    logger.error(`Error fetching branch for userId=${userId}:`, err);
    throw err;
  }
}

module.exports = { ..., getUserBranch, ... };
```

---

## 2. AUTHENTICATION & TOKEN STORAGE

### JWT Token Structure
**File**: [mds-staff/src/packages-core-adapter.js](mds-staff/src/packages-core-adapter.js)

#### Access Token (JWT)
- **Type**: JWT (3 base64url segments)
- **Contents**: `{ id, role, aud, iss, ... }`
- **Storage**: `localStorage` with namespace `staff_accessToken`
- **Note**: Does NOT contain branch information

#### Refresh Token  
- **Type**: Custom format `userId:deviceId:rawToken`
- **Storage**: `localStorage` with namespace `staff_refreshToken`
- **Extraction**: `userId = refreshToken.split(':')[0]`
- **Note**: Does NOT contain branch information

### Token Service
**File**: [packages/core/src/services/token-service.js](packages/core/src/services/token-service.js)

```javascript
export const createTokenService = ({ storage, navigator, getApiBaseUrl, tokenNamespace }) => {
  const accessTokenKey  = tokenNamespace ? `${tokenNamespace}_accessToken`  : 'accessToken';
  const refreshTokenKey = tokenNamespace ? `${tokenNamespace}_refreshToken` : 'refreshToken';

  const TokenStorage = {
    getAccessToken: () => storage.getItem(accessTokenKey),
    getRefreshToken: () => storage.getItem(refreshTokenKey),
    setTokens: async (accessToken, refreshToken) => { ... },
    clearTokens: async () => { ... },
    validateToken: (token) => { /* Check JWT structure */ },
    validateRefreshToken: (token) => { /* Check userId:deviceId:rawToken format */ },
  };
  
  return { TokenStorage, refreshAccessToken, isAccessTokenExpired, logout, isAuthenticated };
};
```

**Web Implementation** - [mds-staff/src/packages-core-adapter.js](mds-staff/src/packages-core-adapter.js):

```javascript
export const tokenService = createTokenService({
  storage: localStorage,
  navigator: { 
    navigate: (path) => { 
      window.location.assign(path);
    } 
  },
  getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
  tokenNamespace: 'staff'
});

export const { TokenStorage, refreshAccessToken, isAccessTokenExpired, logout, isAuthenticated } = tokenService;
```

---

## 3. CONTEXT PROVIDERS

### SettingsProvider
**File**: [mds-staff/src/context/settings-context.jsx](mds-staff/src/context/settings-context.jsx)

**Purpose**: Manages user UI preferences (theme, sound, notifications)
**Does NOT**: Store user identity or branch information
**Hook**: `useSettings()`

```javascript
import { useSettings } from '../context/settings-context';

// Usage:
const { soundEnabled, themeMode } = useSettings();
```

### PermissionsProvider
**File**: [mds-staff/src/context/permissions-context.jsx](mds-staff/src/context/permissions-context.jsx)

**Purpose**: Fetches and caches the current staff member's module permissions
**Endpoint**: `GET /staff/me/permissions` (JWT protected)
**Response**:
```json
{
  "modules": [
    { "moduleId": "patientSearch", "enabled": true },
    { "moduleId": "appointments", "enabled": true },
    ...
  ],
  "isAdmin": false
}
```

**Hook**: `usePermissions()`

```javascript
const { hasPermission, isAdmin, canAccessRoute } = usePermissions();

// Check permission:
if (hasPermission('appointments')) { ... }
```

### Notification Providers
**Files**: 
- [mds-staff/src/modules/notification/notification-context.jsx](mds-staff/src/modules/notification/notification-context.jsx)
- [mds-staff/src/modules/medical-inventory/hooks/useMedicineRequestSocket.js](mds-staff/src/modules/medical-inventory/hooks/useMedicineRequestSocket.js)

**Purpose**: Manages real-time socket notifications
**Where Branch is Retrieved**: In the socket event handler `notification:join-branch`

---

## 4. HOW BRANCH INFORMATION IS RETRIEVED

### Backend Socket Connection
**File**: [Backend/config/sockets/notification-events.js](Backend/config/sockets/notification-events.js)

When a staff member connects via WebSocket and emits `notification:join-branch`, the server:

1. **Extracts userId** from the JWT token (verified by socket-auth middleware)
2. **Queries the database**: `db.getUserBranch(userId)`
3. **Maps branch to location rooms**:
   - `'Manila'` → `['Arlegui', 'Casal']`
   - `'QuezonCity'` → `['QuezonCity']`
   - `'Both'` → `['Arlegui', 'Casal', 'QuezonCity']`
4. **Joins socket rooms**: `socket.join('branch:Arlegui')`, etc.

```javascript
const BRANCH_TO_LOCATIONS = {
  Manila: ['Arlegui', 'Casal'],
  QuezonCity: ['QuezonCity'],
  Both: ['Arlegui', 'Casal', 'QuezonCity'],
};

const notificationHandlers = {
  'notification:join-branch': async (socket, _data, ack) => {
    const branch = await db.getUserBranch(socket.userId);
    
    if (!branch) {
      if (typeof ack === 'function') ack({ error: 'NO_BRANCH' });
      return;
    }
    
    const locations = BRANCH_TO_LOCATIONS[branch] || [branch];
    for (const loc of locations) {
      socket.join(`branch:${loc}`);
    }
    
    // Medical staff also join role-prefixed room
    if (socket.userRole === 'medical') {
      socket.join(`${branch}::staff`);
    }
    
    if (typeof ack === 'function') ack({ success: true, branch });
  },
};
```

### Frontend Socket Connection
**File**: [mds-staff/src/modules/notification/notification-context.jsx](mds-staff/src/modules/notification/notification-context.jsx)

```javascript
// Initialize socket service
const service = createSocketService({
  getApiBaseUrl: () => apiBaseUrlProvider.getApiBaseUrl(),
  getToken: () => tokenService.TokenStorage.getAccessToken(),
});

// Connect and join branch room
await service.connect();

// Join the staff member's branch room to receive branch-scoped events
service.emit('notification:join-branch', {});
```

---

## 5. CURRENT ARCHITECTURE LIMITATION: NO DIRECT BRANCH ACCESS

**IMPORTANT**: Currently, the frontend does NOT have a direct endpoint or context provider that exposes the staff member's branch information for general use.

### Where Branch IS Accessible:
1. ✅ **Socket Acknowledgment**: After emitting `notification:join-branch`, the server sends back:
   ```javascript
   ack({ success: true, branch });
   ```
   
2. ✅ **Backend Queries** (server-side only): Developers can call `db.getUserBranch(req.user.id)`

3. ✅ **Backend Routes**: Staff routes check branch via:
   ```javascript
   const medicalBranch = await db.getUserBranch(req.user.id);
   if (medicalBranch !== 'Both' && medicalBranch !== branch) {
     return res.status(403).json({ error: 'Forbidden' });
   }
   ```

### Where Branch IS NOT Accessible:
1. ❌ **React Context**: No AuthContext or BranchContext exposes branch info
2. ❌ **Local Storage**: Branch is NOT stored in localStorage
3. ❌ **JWT Token**: Branch is NOT included in access or refresh tokens
4. ❌ **REST Endpoint**: No `/staff/me` endpoint returns user profile with branch
5. ❌ **Hooks**: No `useCurrentUserBranch()` or similar hook exists

---

## 6. RECOMMENDED IMPLEMENTATION: ACCESS CURRENT USER BRANCH

To add branch access to the frontend, you can:

### Option A: Create a BranchContext Provider

```javascript
// src/context/branch-context.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { axiosRequest, tokenService } from '../packages-core-adapter';

const BranchContext = createContext(null);

export const BranchProvider = ({ children }) => {
  const [branch, setBranch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        setIsLoading(true);
        const response = await axiosRequest.get('/staff/me/branch');
        setBranch(response.data.branch);
      } catch (err) {
        setError(err.message);
        setBranch(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (tokenService.isAuthenticated()) {
      fetchBranch();
    }
  }, []);

  return (
    <BranchContext.Provider value={{ branch, isLoading, error }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
```

Then wrap it in App.jsx:
```javascript
<BranchProvider>
  <PermissionsProvider>
    <SettingsProvider>
      {/* app content */}
    </SettingsProvider>
  </PermissionsProvider>
</BranchProvider>
```

### Option B: Extract from Socket Acknowledgment

Capture the branch from the socket connection acknowledgment:

```javascript
// In notification-context.jsx
service.emit('notification:join-branch', {}, (ack) => {
  if (ack.success && ack.branch) {
    // Store branch somewhere (context, state, etc)
    console.log('Staff branch:', ack.branch);
  }
});
```

### Option C: Add Backend REST Endpoint

Create a new route in [Backend/routes/staff/staff.js](Backend/routes/staff/staff.js):

```javascript
router.get('/me', jwtProtect("medical"), async (req, res) => {
  try {
    const branch = await db.getUserBranch(req.user.id);
    res.json({
      userId: req.user.id,
      branch: branch || null,
    });
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Then call from frontend:
```javascript
const { data } = await axiosRequest.get('/staff/me');
console.log('Current staff branch:', data.branch);
```

---

## 7. FILE PATHS SUMMARY

| Concept | File | Key Code |
|---------|------|----------|
| **Token Storage** | [packages/core/src/services/token-service.js](packages/core/src/services/token-service.js) | `TokenStorage.getRefreshToken()` |
| **Web Token Setup** | [mds-staff/src/packages-core-adapter.js](mds-staff/src/packages-core-adapter.js) | `tokenService`, `TokenStorage` |
| **Auth Context** | [mds-staff/src/context/permissions-context.jsx](mds-staff/src/context/permissions-context.jsx) | `usePermissions()` |
| **Branch Database Query** | [Backend/config/query.js](Backend/config/query.js) | `db.getUserBranch(userId)` |
| **Branch DB Schema** | [Backend/config/query.js](Backend/config/query.js#L313) | `SELECT branch FROM "UsersPersonal"` |
| **Socket Branch Join** | [Backend/config/sockets/notification-events.js](Backend/config/sockets/notification-events.js) | `'notification:join-branch'` handler |
| **Socket Auth** | [Backend/config/sockets/socket-auth.js](Backend/config/sockets/socket-auth.js) | JWT verification |
| **Staff Socket Connection** | [mds-staff/src/modules/notification/notification-context.jsx](mds-staff/src/modules/notification/notification-context.jsx) | `service.emit('notification:join-branch')` |
| **Staff Routes** | [Backend/routes/staff/staff.js](Backend/routes/staff/staff.js) | Branch checks on `/id/*` endpoints |

---

## 8. USAGE EXAMPLES

### Example 1: Check Staff Branch Access (Backend)

```javascript
// Backend route
router.get('/search/:branchName', jwtProtect("medical"), async (req, res) => {
  const staffBranch = await db.getUserBranch(req.user.id);
  
  if (staffBranch !== 'Both' && staffBranch !== req.params.branchName) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Proceed with search
  const results = await db.searchByBranch(req.params.branchName);
  res.json(results);
});
```

### Example 2: Get Current User's Branch (Frontend - proposed)

```javascript
import { useBranch } from '../context/branch-context';

function StaffDashboard() {
  const { branch, isLoading } = useBranch();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Welcome to {branch} Branch</h1>
    </div>
  );
}
```

### Example 3: Socket Room Joining (Backend)

```javascript
// When staff connects, they automatically join their branch room
const branch = await db.getUserBranch(socket.userId);
// Branch is: 'Manila', 'QuezonCity', or 'Both'

// They receive events emitted to:
// - 'branch:Arlegui' (if branch is Manila or Both)
// - 'branch:Casal' (if branch is Manila or Both)
// - 'branch:QuezonCity' (if branch is QuezonCity or Both)
```

---

## 9. KEY INSIGHTS

1. **JWT tokens contain ID and role**, but not branch
2. **Branch is fetched from database** whenever needed
3. **No centralized frontend context** currently provides branch info
4. **Socket connection retrieves branch** server-side for room joining
5. **Branch-based filtering** is enforced on staff routes
6. **Three valid values**: `'Manila'`, `'QuezonCity'`, `'Both'`
7. **Database normalizes** branch to location mapping via `BRANCH_TO_LOCATIONS`
