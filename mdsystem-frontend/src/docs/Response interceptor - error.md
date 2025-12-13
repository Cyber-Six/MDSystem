mdsystem-frontend/src/services/axiosRequest.js
- Response Interceptor - Error handling flowchart

┌─────────────────────────────────────┐
│ API Request fails with 401          │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Is it the /auth/refresh endpoint?   │  ← SECURITY: Prevent infinite loop
└──────────────┬──────────────────────┘
               ↓ NO
┌─────────────────────────────────────┐
│ Is another refresh already running? │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
      YES             NO
       │               │
       ↓               ↓
┌─────────────┐  ┌─────────────────────────┐
│ QUEUE THIS  │  │ Set isRefreshing = true │
│ REQUEST     │  │ Set _retry flag         │
└──────┬──────┘  └──────────┬──────────────┘
       │                    ↓
       │         ┌──────────────────────────┐
       │         │ Call refreshAccessToken()│ ← Uses tokenService
       │         │ (from tokenService.js)   │
       │         └──────────┬───────────────┘
       │                    │
       │         ┌──────────┴──────────┐
       │         │                     │
       │      SUCCESS              FAILURE
       │         │                     │
       │         ↓                     ↓
       │  ┌──────────────┐    ┌───────────────────┐
       │  │ Update auth  │    │ Clear all tokens  │
       │  │ header with  │    │ Show error banner │
       │  │ new token    │    │ Reject queued     │
       │  └──────┬───────┘    │ requests          │
       │         │            │ Redirect to /auth │
       │         ↓            └───────────────────┘
       │  ┌──────────────┐
       │  │ Process queue│
       │  │ with new     │
       │  │ token        │
       └─→└──────┬───────┘
                 │
                 ↓
       ┌─────────────────┐
       │ Retry original  │
       │ request with    │
       │ new token       │
       └─────────────────┘


When Token Expires:

User Action
    ↓
axiosRequest.get('/some/endpoint')
    ↓ [Request Interceptor]
    ↓ Adds: Authorization: Bearer <expired_token>
    ↓
Backend returns 401
    ↓ [Response Interceptor - Error]
    ↓ Detects 401
    ↓ Calls tokenService.refreshAccessToken()
    ↓     ↓ Uses plain axios.post('/auth/refresh')
    ↓     ↓ Backend returns new tokens
    ↓     ↓ TokenStorage.setTokens(new tokens)
    ↓ Gets new accessToken
    ↓ Updates Authorization header
    ↓ Retries axiosRequest.get('/some/endpoint')
    ↓ [Request Interceptor]
    ↓ Adds: Authorization: Bearer <new_token>
    ↓
Backend returns 200 with data
    ↓
User gets data (seamlessly, without knowing refresh happened)