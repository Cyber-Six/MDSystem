# Banner System Documentation

## Overview
Global banner notification system for displaying HTTP responses from the Node.js backend. Banners appear in the upper-right corner with high z-index (9999) to stay above all components.

## Features
- **Success Banners** (Green): 200, 201 status codes
- **Error Banners** (Red): 400, 403, 404, 409, 422, 429, 500, 502, 503
- **Info Banners** (Grey): Configurable custom statuses
- Auto-dismiss after 5 seconds (configurable)
- Manual close button
- Stacking support for multiple notifications
- Responsive design (mobile-friendly)

## Files Created

### 1. Context: `src/context/BannerContext.jsx`
- Provides global state management for banners
- Exports `BannerProvider` component and `useBanner` hook

### 2. Component: `src/components/Banner.jsx`
- Renders banner notifications in upper-right corner
- Displays error code and message from backend
- Fixed position with z-index: 9999

### 3. Styles: `src/components/Banner.module.css`
- Styled banners with animations
- Color-coded by type (success=green, error=red, info=grey)
- Responsive design for mobile

### 4. Config: `src/config/bannerConfig.js`
- **Easily modify which status codes trigger banners**
- Configure SUCCESS_STATUS_CODES, ERROR_STATUS_CODES, INFO_STATUS_CODES
- Add/remove status codes as needed

## Integration

### axiosRequest.js
Enhanced with:
- Response interceptor shows success banners
- Error interceptor shows error banners
- Network error handling
- Token refresh 401 excluded from banners
- Security improvements:
  - Prevents refresh endpoint from retry loop
  - Validates tokens before storing
  - Clears tokens on any refresh failure
  - Uses separate axios instance for refresh to avoid interceptor recursion
  - Shows "Session Expired" banner before redirect

### App.jsx
Wrapped with:
- BannerProvider at root level
- Banner component rendered globally
- Banner callback connected to axios

## Usage

### Automatic (via axios)
All HTTP responses automatically trigger banners based on status code configuration.

### Manual (in components)
```jsx
import { useBanner } from '../context/BannerContext';

function MyComponent() {
  const { showBanner } = useBanner();
  
  showBanner({
    type: 'success', // 'success', 'error', or 'info'
    message: 'Operation completed!',
    error: 'SUCCESS_CODE', // Optional error code
    duration: 5000 // Auto-dismiss after 5s, 0 = no dismiss
  });
}
```

## Configuration

### To add/remove visible status codes:
Edit `src/config/bannerConfig.js`:

```javascript
export const ERROR_STATUS_CODES = [
  400, 403, 404, // existing codes
  418, // add new code (I'm a teapot)
];
```

### To change auto-dismiss duration:
In BannerContext.jsx, modify default:
```javascript
duration: banner.duration !== undefined ? banner.duration : 5000, // 5 seconds
```

### To change banner position:
In Banner.module.css, modify:
```css
.bannerContainer {
  top: 20px;    /* distance from top */
  right: 20px;  /* distance from right */
}
```

## Backend Response Format
Backend should return responses in this format:
```json
{
  "ok": true,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Examples from backend:
- `MISSING_FIELDS` - "Email and password are required."
- `INVALID_CREDENTIALS` - "Email or password is incorrect."
- `SESSION_EXPIRED` - "Your session has expired."
- `2FA_NOT_VERIFIED` - "Email 2FA has not been verified."

## Security Features
1. **Token refresh 401 handling**: Silent, no banner shown
2. **Infinite loop prevention**: Refresh endpoint excluded from retry
3. **Token validation**: Validates tokens before storing
4. **Atomic token updates**: Both tokens updated together
5. **Clean error state**: Clears tokens on any auth failure
6. **Separate axios instance**: Refresh uses plain axios to avoid interceptor recursion
7. **Session expiry notification**: Shows banner before redirect

## Notes
- Fast refresh warning in BannerContext.jsx is non-critical (development only)
- Banner z-index (9999) ensures it stays above modals and other components
- Network errors automatically show banner
- Token refresh failures redirect to /auth after showing banner
