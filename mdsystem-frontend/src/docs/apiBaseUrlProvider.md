Flow Diagram:

User visits www.mdsystemtip.space
        ↓
apiBaseUrlProvider.getApiBaseUrl()
        ↓
Returns: "https://www.mdsystemtip.space"
        ↓
axiosRequestHandler.js creates axios instance with this baseURL
        ↓
All API calls use this base:
  - axiosRequest.get('/users') → https://www.mdsystemtip.space/users
  - axiosRequest.post('/login') → https://www.mdsystemtip.space/login
        ↓
refreshTokenService.js uses getApiBaseUrl() for manual URL construction:
  - ${getApiBaseUrl()}/auth/refresh → https://www.mdsystemtip.space/auth/refresh