# Token Refresh Mechanism

## Overview
The application uses JWT-based authentication with automatic token refresh to maintain user sessions without requiring frequent logins.

## Token Types

### Access Token
- **Purpose:** Used for authenticating API requests
- **Lifetime:** Short-lived (typically 15 minutes)
- **Storage:** localStorage as `accessToken`
- **Usage:** Sent in `Authorization: Bearer <token>` header

### Refresh Token
- **Purpose:** Used to obtain new access tokens
- **Lifetime:** Long-lived (typically 7-30 days)
- **Storage:** localStorage as `refreshToken`
- **Format:** `userId:deviceId:rawToken` (combined token)

## How It Works

### Initial Login Flow
1. User completes login (credentials + 2FA + consent)
2. Backend returns both `accessToken` and `refreshToken`
3. Frontend stores both tokens in localStorage
4. All subsequent requests include access token in Authorization header

### Automatic Token Refresh Flow

#### When Access Token Expires
1. **Request Made:** Frontend makes API request with expired access token
2. **401 Response:** Backend returns 401 Unauthorized
3. **Intercept Error:** Axios interceptor catches the 401 error
4. **Check Queue:** If refresh is already in progress, queue the request
5. **Refresh Token:** Call `POST /auth/refresh` with refresh token
6. **Store New Tokens:** Update localStorage with new access and refresh tokens
7. **Retry Request:** Automatically retry original request with new access token
8. **Process Queue:** All queued requests are retried with new token

#### Request Queuing
- Prevents multiple simultaneous refresh requests
- All failed requests wait for the first refresh to complete
- Once new token is obtained, all queued requests retry automatically

### Token Refresh API

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "userId:deviceId:rawToken"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | MISSING_REFRESH_TOKEN | No refresh token provided |
| 400 | INVALID_REFRESH_TOKEN_FORMAT | Token format is incorrect |
| 400 | INVALID_REFRESH_TOKEN | Token is malformed |
| 401 | INVALID_SESSION | Session is invalid or expired |
| 403 | SESSION_REVOKED | Session has been revoked |
| 401 | RELOGIN_REQUIRED | User must log in again |
| 429 | SESSION_COOLDOWN | Suspicious activity detected |

## Implementation Details

### axiosRequest.js
```javascript
// Key features:
- isRefreshing flag: Prevents multiple refresh attempts
- failedQueue: Stores requests waiting for token refresh
- processQueue(): Retries queued requests after refresh
- refreshAccessToken(): Calls backend refresh endpoint
- Response interceptor: Handles 401 and triggers refresh flow
```

### Request Interceptor
```javascript
// Adds access token to every request
config.headers.Authorization = `Bearer ${accessToken}`;
```

### Response Interceptor
```javascript
// On 401 error:
1. Check if already refreshing
2. If yes, queue the request
3. If no, attempt token refresh
4. Retry original request with new token
5. Process all queued requests
```

## Security Features

✅ **Token Rotation:** New refresh token issued on each refresh
✅ **Device Tracking:** Refresh token includes device ID
✅ **Session Management:** Backend can revoke sessions
✅ **Cooldown Protection:** Prevents rapid refresh attempts
✅ **Automatic Cleanup:** Clears tokens on refresh failure
✅ **Secure Storage:** Tokens stored in localStorage (consider httpOnly cookies for production)

## Error Handling

### Refresh Success
- Original request is automatically retried
- User continues working without interruption
- All queued requests are processed

### Refresh Failure
- All tokens are cleared from localStorage
- User is redirected to login page
- All queued requests are rejected
- Error is logged for debugging

## Best Practices

### Token Storage
```javascript
// Store after login
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Clear on logout
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### Manual Token Refresh
```javascript
// If needed, you can manually trigger refresh
import axiosRequest from './services/axiosRequest';

// Just make any request - refresh happens automatically on 401
```

### Logout Implementation
```javascript
const logout = () => {
  // Clear tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  
  // Optional: Call backend logout endpoint
  // await axiosRequest.post('/auth/logout');
  
  // Redirect to login
  window.location.href = '/login';
};
```

## Token Lifecycle

```
[Login]
   ↓
[Store Tokens]
   ↓
[Make API Requests] ──→ [Access Token Valid] ──→ [Success]
   ↓                           ↑
[Access Token Expired]         |
   ↓                           |
[401 Intercepted]              |
   ↓                           |
[Refresh Token Call]           |
   ↓                           |
[New Tokens Received] ─────────┘
   ↓
[Retry Original Request]
   ↓
[Refresh Failed?] ──→ [Redirect to Login]
```

## Testing Checklist

- [ ] Login stores both tokens correctly
- [ ] API requests include access token in header
- [ ] 401 error triggers automatic refresh
- [ ] Original request retries after successful refresh
- [ ] Multiple simultaneous 401s queue properly
- [ ] All queued requests retry after refresh
- [ ] Refresh failure clears tokens and redirects
- [ ] Logout clears all tokens
- [ ] Token rotation works (new refresh token on each refresh)
- [ ] Session revocation redirects to login
- [ ] Cooldown handling works correctly

## Production Considerations

### Security Enhancements
1. **HttpOnly Cookies:** Store refresh token in httpOnly cookie instead of localStorage
2. **CSRF Protection:** Implement CSRF tokens for refresh endpoint
3. **Token Fingerprinting:** Add device/browser fingerprinting
4. **Rate Limiting:** Limit refresh requests per session
5. **Encryption:** Consider encrypting tokens in localStorage

### Monitoring
- Log refresh attempts for security auditing
- Track refresh success/failure rates
- Monitor for suspicious refresh patterns
- Alert on high failure rates

### User Experience
- Show loading indicator during refresh
- Handle offline scenarios gracefully
- Provide clear error messages
- Allow manual re-login option

## Troubleshooting

### Issue: Infinite Refresh Loop
**Cause:** Refresh endpoint also returns 401
**Solution:** Ensure refresh endpoint doesn't require valid access token

### Issue: Tokens Not Persisting
**Cause:** localStorage not saving properly
**Solution:** Check browser settings, use sessionStorage as fallback

### Issue: Multiple Refresh Calls
**Cause:** Queue mechanism not working
**Solution:** Check `isRefreshing` flag and queue processing

### Issue: Redirect Loop
**Cause:** Login page makes authenticated requests
**Solution:** Exclude login/public pages from auth requirements
