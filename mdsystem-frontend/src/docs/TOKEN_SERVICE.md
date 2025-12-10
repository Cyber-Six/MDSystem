# Token Service Documentation

## Overview
Centralized token management service for handling access tokens, refresh tokens, and authentication state. Provides secure, maintainable token operations with proper cleanup on logout.

## Architecture

### Token Storage
Tokens are stored in `localStorage`:
- **accessToken**: Short-lived JWT for API requests (15 minutes)
- **refreshToken**: Long-lived token for refreshing access (format: `userId:deviceId:rawToken`)

### Security Features
1. ✅ **Atomic token updates**: Both tokens updated together
2. ✅ **Token validation**: Format validation before storage
3. ✅ **Centralized access**: All token operations through `TokenStorage`
4. ✅ **Complete cleanup**: Tokens cleared on logout, refresh failure, or session expiry
5. ✅ **Separate axios instance**: Refresh uses plain axios to prevent interceptor loops
6. ✅ **Timeout protection**: 10-second timeout for refresh requests
7. ✅ **Error preservation**: Backend error codes/messages passed through

## Files

### `src/services/tokenService.js`
Exports:
- **TokenStorage**: Secure token storage interface
- **refreshAccessToken()**: Refresh access token using refresh token
- **logout()**: Clear tokens and optionally redirect
- **isAuthenticated()**: Check if user has valid tokens

### `src/services/axiosRequest.js`
Enhanced to use tokenService:
- Request interceptor uses `TokenStorage.getAccessToken()`
- Response interceptor calls `refreshAccessToken()` on 401
- Error handler calls `logout()` on refresh failure

## API Reference

### TokenStorage Object

```javascript
import { TokenStorage } from './services/tokenService';

// Get tokens
const accessToken = TokenStorage.getAccessToken();
const refreshToken = TokenStorage.getRefreshToken();

// Set tokens (atomic operation)
TokenStorage.setTokens(accessToken, refreshToken);

// Clear all tokens
TokenStorage.clearTokens();

// Validate token format
const isValid = TokenStorage.validateToken(token);
```

### refreshAccessToken()

```javascript
import { refreshAccessToken } from './services/tokenService';

try {
  const newAccessToken = await refreshAccessToken();
  // Tokens automatically updated in localStorage
  // Use new token for requests
} catch (error) {
  // Tokens automatically cleared
  // Error includes code and message from backend
  console.error(error.code); // e.g., 'INVALID_SESSION', 'EXPIRED_REFRESH_TOKEN'
  console.error(error.message);
}
```

### logout()

```javascript
import { logout } from './services/tokenService';

// Logout and redirect to /auth
logout(true);

// Logout without redirect
logout(false);
```

### isAuthenticated()

```javascript
import { isAuthenticated } from './services/tokenService';

if (isAuthenticated()) {
  // User has tokens (not verified for validity)
}
```

## Token Refresh Flow

### URL Construction
```
Base URL: getApiBaseUrl()
  ↓
Examples:
  - http://localhost:3001          (development)
  - https://www.example.com/api    (patient portal)
  - https://staff.example.com/api  (staff portal)
  ↓
Refresh endpoint: ${baseURL}/auth/refresh
  ↓
Final URLs:
  - http://localhost:3001/auth/refresh
  - https://www.example.com/api/auth/refresh
  - https://staff.example.com/api/auth/refresh
```

### Request Format
```json
POST /auth/refresh
{
  "refreshToken": "userId:deviceId:rawToken"
}
```

### Response Format (Success)
```json
{
  "ok": true,
  "accessToken": "new_access_token_jwt",
  "refreshToken": "userId:deviceId:new_raw_token"
}
```

### Response Format (Error)
```json
{
  "error": "INVALID_SESSION",
  "message": "Refresh session is invalid or expired."
}
```

### Error Codes from Backend
- `MISSING_REFRESH_TOKEN`: No token provided
- `INVALID_REFRESH_TOKEN_FORMAT`: Token format invalid
- `INVALID_REFRESH_TOKEN`: Token malformed or invalid
- `INVALID_SESSION`: Session invalid or expired
- `SESSION_REVOKED`: Session has been revoked
- `RELOGIN_REQUIRED`: Must log in again
- `SESSION_COOLDOWN`: Suspicious activity detected
- `STAFF_SESSION_INVALID`: Staff session invalidated
- `EXPIRED_REFRESH_TOKEN`: Token has expired

## Integration Points

### Login.jsx
```javascript
import { TokenStorage } from '../../services/tokenService';

// After successful login
if (response.data.accessToken && response.data.refreshToken) {
  TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
}
navigate('/dashboard');
```

### Register.jsx
```javascript
import { TokenStorage } from '../../services/tokenService';

// After successful registration
if (response.data.accessToken && response.data.refreshToken) {
  TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
}
navigate('/dashboard');
```

### Dashboard.jsx
```javascript
import { logout } from '../services/tokenService';

// On logout button click
const handleLogout = () => {
  logout(true); // Clears tokens and redirects to /auth
};
```

### Landing.jsx
```javascript
import { isAuthenticated } from '../services/tokenService';

useEffect(() => {
  if (isAuthenticated()) {
    navigate('/dashboard');
  }
}, []);
```

## Automatic Token Refresh

### Interceptor Flow
1. API request returns 401 (token expired)
2. Check if already refreshing (queue if yes)
3. Mark as refreshing to prevent multiple simultaneous refreshes
4. Call `refreshAccessToken()` from tokenService
5. If successful:
   - Update authorization header with new token
   - Process queued requests with new token
   - Retry original request
6. If failed:
   - Clear all tokens
   - Show error banner with backend message
   - Redirect to /auth after 1 second

### Queuing Mechanism
Multiple concurrent 401 responses are queued and processed after a single refresh completes:
```javascript
let isRefreshing = false;
let failedQueue = [];

// Queue requests while refreshing
failedQueue.push({ resolve, reject });

// Process all queued requests after refresh
processQueue(null, newAccessToken);
```

## Security Checklist

✅ **Tokens validated before storage**
- Format: `userId:deviceId:rawToken` for refresh token
- Non-empty strings for access token

✅ **Tokens cleared on:**
- Logout (manual)
- Refresh failure
- Session expiry
- Network errors during refresh

✅ **Separate axios instance for refresh**
- Prevents interceptor recursion
- Avoids infinite loops

✅ **Refresh endpoint excluded from retry**
- 401 on /auth/refresh doesn't trigger another refresh

✅ **Request queuing**
- Multiple concurrent requests wait for single refresh
- Prevents token refresh spam

✅ **Timeout protection**
- 10-second timeout for refresh requests
- Prevents hanging requests

✅ **Error preservation**
- Backend error codes/messages passed to frontend
- Displayed in banner notifications

## Migration Guide

### Old Code (Direct localStorage)
```javascript
// ❌ Old way
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### New Code (TokenStorage)
```javascript
// ✅ New way
import { TokenStorage, logout } from './services/tokenService';

TokenStorage.setTokens(accessToken, refreshToken);
TokenStorage.clearTokens();
logout(true); // Includes backend call and redirect
```

## Testing Checklist

- [ ] Login stores tokens via TokenStorage
- [ ] Register stores tokens via TokenStorage
- [ ] Logout clears all tokens
- [ ] 401 triggers automatic refresh
- [ ] Multiple concurrent 401s queue properly
- [ ] Refresh failure clears tokens and redirects
- [ ] Network error during refresh handled
- [ ] Banner shows backend error messages
- [ ] Refresh endpoint not retried on 401
- [ ] Token format validated before storage
