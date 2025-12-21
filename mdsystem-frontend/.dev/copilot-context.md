# MDSystem Frontend - Development Guidelines

## Project Overview
This is a React-based healthcare management system frontend for TIP (Technological Institute of the Philippines). It features a multi-portal architecture with subdomain-based role detection (patient portal: www.mdsystemtip.space, staff portal: staff.mdsystemtip.space).

## Technology Stack
- **Framework**: React 19.2.3
- **Build Tool**: Vite 7.2.7
- **Routing**: React Router DOM 7.10.1
- **Compiler**: React Compiler (babel-plugin-react-compiler)
- **Styling**: Tailwind CSS 3.4.19 with custom design system
- **HTTP Client**: Axios 1.13.2 with interceptors
- **Icons**: Lucide React 0.562.0
- **Linting**: ESLint 9.39.2

---

## Code Style & Conventions

### File Naming
- **Components**: lowercase with hyphens (e.g., `user-menu.jsx`, `top-bar.jsx`, `banner-context.jsx`)
- **Pages**: PascalCase (e.g., `Auth.jsx`, `Dashboard.jsx`)
- **Utilities/Services**: camelCase (e.g., `axiosRequestHandler.js`, `refreshTokenService.js`)
- **CSS Modules**: Match component name (e.g., `Banner.module.css`, `NavBar.module.css`)
- **Context Objects**: PascalCase (e.g., `RoleContextObject.js`)
- **Constants**: camelCase file with SCREAMING_SNAKE_CASE exports (e.g., `bannerConfig.js`)

### Component Structure
```jsx
// 1. Imports (external libraries first, then internal modules)
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Settings, LogOut } from 'lucide-react';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';
import { useBanner } from '../../context/banner-context';

// 2. Component definition
const ComponentName = ({ title, onAction }) => {
  // 3. Hooks (state, context, effects)
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showBanner } = useBanner();

  useEffect(() => {
    // Side effects
  }, []);

  // 4. Event handlers and helper functions
  const handleAction = async () => {
    setIsLoading(true);
    try {
      const response = await axiosRequest.post('/endpoint', { data });
      if (response.data.ok) {
        // Handle success
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Render with Tailwind CSS
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700">
      {error && (
        <div className="mb-4 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 rounded-lg">
          <p className="text-error-600 dark:text-error-400 text-sm">{error}</p>
        </div>
      )}
      {/* JSX content */}
    </div>
  );
};

export default ComponentName;
```

### Naming Conventions
- **Variables**: camelCase (e.g., `userData`, `isLoading`, `handleSubmit`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `SUCCESS_STATUS_CODES`, `ERROR_STATUS_CODES`)
- **Components**: PascalCase (e.g., `UserMenu`, `DashboardHome`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (e.g., `isVisible`, `hasError`, `isRefreshing`)
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`, `handleSubmit`, `handleViewChange`)
- **Custom hooks**: Prefix with `use` (e.g., `useRole`, `useBanner`, `useDetectRoleFromSubdomain`)
- **Context Providers**: Suffix with `Provider` (e.g., `RoleProvider`, `BannerProvider`)

### React Best Practices

#### Component Design
- Prefer **arrow function components** with hooks
- Keep components **small and focused** (single responsibility)
- Use **default exports** for components
- Use **named exports** for utilities, services, and context hooks
- Extract reusable logic into **custom hooks** in `src/hooks/`
- Use **CSS modules** for component-specific styles that need scoping
- Use **Tailwind CSS** for most styling needs

#### State Management
- Use `useState` for local component state
- Use `useReducer` for complex state logic (e.g., multi-step forms)
- Use Context API for global state:
  - `RoleContext` - Portal role detection (patient/medical)
  - `BannerContext` - Global notifications
- Lift state up only when necessary
- Use `useCallback` for memoized callbacks passed to children (sparingly - React Compiler handles most cases)

#### Performance Optimization
- React Compiler is enabled - avoid manual `useMemo`/`useCallback` unless measuring performance issues
- Use `React.lazy()` and `Suspense` for code splitting on route level
- Avoid inline function definitions in JSX for frequently re-rendering components
- Use CSS animations over JavaScript for better performance

#### Multi-Step Forms Pattern (Login/Register)
```jsx
const [currentStep, setCurrentStep] = useState(1);
const [verificationKey, setVerificationKey] = useState('');

const goToNextStep = () => {
  setError('');
  setCurrentStep(prev => prev + 1);
};

// Render different UI based on step
if (currentStep === 1) return <Step1 />;
if (currentStep === 2) return <Step2 />;
```

---

## Project Structure

```
src/
├── App.jsx              # Main app with routing and providers
├── main.jsx             # Entry point with RoleProvider
│
├── assets/              # Static assets (images, fonts)
│   └── MDSystem.png
│
├── components/          # Reusable UI components
│   ├── banner/          # Global notification banners
│   ├── data-consent/    # Data consent components
│   ├── help-support/    # Help, FAQs, feedback modals
│   ├── layout/          # Layout, Sidebar, TopBar
│   ├── modals/          # Reusable modal components
│   ├── navbar/          # Navigation bar
│   ├── profile/         # Profile modal
│   ├── settings/        # Settings modals (password, 2FA)
│   └── user-menu/       # User dropdown menu
│
├── config/              # Application configuration
│   ├── bannerConfig.js  # HTTP status code to banner mapping
│   └── generated/       # Auto-generated files (git-ignored)
│
├── context/             # React Context providers
│   ├── banner-context.jsx    # Banner state management
│   ├── role-context.jsx      # Role detection provider
│   └── RoleContextObject.js  # Context object
│
├── docs/                # Internal documentation
│
├── hooks/               # Custom React hooks
│   └── useRole.js       # Role detection hook
│
├── modules/             # Feature-specific modules
│   ├── appointment/     # Appointment management
│   ├── auth/            # Login, Register, AuthSlides
│   ├── dashboard/       # Dashboard home
│   ├── landing/         # Landing page
│   ├── medicine-request/# Medicine request
│   └── record-forms/    # Medical record forms
│
├── pages/               # Page-level components (route targets)
│   ├── Auth.jsx         # Authentication page
│   └── Dashboard.jsx    # Dashboard with nested routes
│
├── routes/              # Route configuration
│   └── private-route.jsx # Protected route component
│
├── services/            # API services and business logic
│   ├── apiBaseUrlProvider.js    # Base URL detection
│   ├── axiosRequestHandler.js   # Axios with interceptors
│   └── refreshTokenService.js   # Token management
│
└── styles/              # Global styles
    ├── App.css          # App-specific utilities
    └── index.css        # Tailwind + CSS variables
```

### Directory Guidelines
- **components/**: Small, reusable UI elements organized by feature
- **modules/**: Domain-specific functionality with related components
- **pages/**: Full page components mapped to routes (minimal logic)
- **routes/**: Route guards and configuration
- **hooks/**: Custom hooks for shared logic
- **services/**: API calls, token management, external integrations
- **context/**: React Context providers for global state
- **config/**: Configuration files and constants

---

## Styling Guidelines

### Tailwind CSS (Primary)
This project uses Tailwind CSS with an extensive custom design system defined in `tailwind.config.js`.

#### Custom Color Palette
```jsx
// Primary - TIP Yellow/Gold (#F1C526)
className="bg-primary-500 text-primary-600 border-primary-300"

// Secondary - Dark Gray
className="bg-secondary-700 text-secondary-900"

// Accent - Blue (for links, interactive elements)
className="text-accent-600 hover:text-accent-700"

// Semantic colors
className="bg-success-500"  // Green
className="bg-warning-500"  // Orange
className="bg-error-500"    // Red
className="bg-neutral-100"  // Gray backgrounds
```

#### Dark Mode Support
Use the `dark:` prefix for dark mode variants:
```jsx
className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
className="border-gray-200 dark:border-neutral-700"
className="hover:bg-gray-100 dark:hover:bg-neutral-800"
```

#### Common Patterns
```jsx
// Card component
className="bg-white dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700 shadow-md"

// Button primary
className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"

// Input field
className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary text-secondary-900 dark:text-dark-text-primary border border-neutral-300 dark:border-dark-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"

// Error message
className="mb-4 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg"
```

### CSS Modules (When Needed)
Use CSS modules for complex animations or styles that need scoping:
```jsx
import styles from './Banner.module.css';

<div className={`${styles.banner} ${styles[banner.type]}`}>
```

### CSS Animation Classes (Custom)
```jsx
// From tailwind.config.js
className="animate-fade-in"      // Fade in
className="animate-slide-in"     // Slide from top
className="animate-slide-down"   // Slide from above
className="animate-pulse-slow"   // Slow pulse
```

---

## Routing

### Route Organization
Routes are defined in `App.jsx` with nested routing in page components:

```jsx
// App.jsx - Top-level routes
<Routes>
  <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
  <Route path="/auth/login" element={<Auth />} />
  <Route path="/auth/register" element={<Auth />} />
</Routes>

// Dashboard.jsx - Nested routes
<Routes>
  <Route path="/" element={<DashboardHome />} />
  <Route path="/record-update" element={<RecordUpdateForm />} />
  <Route path="/appointments" element={<AppointmentPage />} />
  <Route path="/medicine-request" element={<MedicineRequestPage />} />
</Routes>
```

### Protected Routes
Use `PrivateRoute` component for authentication:
```jsx
// Validates tokens exist and have correct format
// Redirects to /auth/login if not authenticated
// Supports VITE_BYPASS_AUTH=true for development
<PrivateRoute>
  <Dashboard />
</PrivateRoute>
```

### Route Naming
- Use lowercase with hyphens: `/auth/login`, `/record-update`, `/medicine-request`
- Auth routes: `/auth/login`, `/auth/register`
- Dashboard routes: `/`, `/appointments`, `/e-consultation`

---

## API & Data Fetching

### Axios Request Handler
All API calls use the centralized `axiosRequestHandler.js`:

```javascript
import axiosRequest from '../services/axiosRequestHandler';

// GET request
const response = await axiosRequest.get('/patient/profile');

// POST request
const response = await axiosRequest.post('/auth/login', { 
  email, 
  password,
  recaptchaToken 
});

// Response structure (backend convention)
if (response.data.ok) {
  // Success - response.data contains the payload
}
```

### Features Built Into axiosRequest:
1. **Automatic base URL detection** - Uses subdomain for correct backend
2. **Token injection** - Adds `Authorization: Bearer {token}` header
3. **Token refresh** - Automatically refreshes on 401 errors
4. **Request queuing** - Queues requests during token refresh
5. **Banner integration** - Shows notifications based on status codes
6. **Dev subdomain simulation** - Adds `X-Forwarded-Host` header locally

### Token Management
Use `TokenStorage` from `refreshTokenService.js`:

```javascript
import { TokenStorage, logout, isAuthenticated } from '../services/refreshTokenService';

// Store tokens after login
TokenStorage.setTokens(accessToken, refreshToken);

// Get tokens
const token = TokenStorage.getAccessToken();

// Clear tokens and redirect
logout(true);

// Check authentication
if (isAuthenticated()) { /* ... */ }
```

### API Response Handling
```javascript
try {
  const response = await axiosRequest.post('/auth/login', { email, password });
  
  if (response.data.ok) {
    // Handle success
    const { accessToken, refreshToken, verificationKey } = response.data;
  }
} catch (err) {
  // Handle error codes from backend
  const errorCode = err.response?.data?.error;
  const errorMessage = err.response?.data?.message;
  
  switch (errorCode) {
    case 'INVALID_CREDENTIALS':
      setError('Email or password is incorrect.');
      break;
    case 'INVALID_OTP':
      setError(`Invalid OTP. Attempts: ${err.response?.data?.attempts}/${err.response?.data?.attemptLimit}`);
      break;
    default:
      setError(errorMessage || 'An error occurred');
  }
}
```

### Environment Variables
```bash
# .env.local (git-ignored)
VITE_DEV_PORTAL=www              # or 'staff' for medical portal
VITE_BYPASS_AUTH=true            # Skip auth in development
VITE_PATIENT_API_URL=https://www.mdsystemtip.space
VITE_STAFF_API_URL=https://staff.mdsystemtip.space
```

Access via `import.meta.env.VITE_VARIABLE_NAME`

---

## Error Handling

### Standard Error Pattern with Banner
```jsx
import { useBanner } from '../context/banner-context';

const MyComponent = () => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showBanner } = useBanner();

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/endpoint', data);
      if (response.data.ok) {
        // Success - banner shown automatically by interceptor
      }
    } catch (err) {
      // Local error for form display
      setError(err.response?.data?.message || 'An error occurred');
      
      // Or show manual banner for custom messages
      showBanner({
        type: 'error',
        error: 'CUSTOM_ERROR',
        message: 'Custom error message',
        duration: 5000  // 0 for no auto-dismiss
      });
    } finally {
      setIsLoading(false);
    }
  };
};
```

### Error Display Pattern
```jsx
{error && (
  <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
    <p className="text-error-600 dark:text-error-400 text-sm text-center">
      {error}
    </p>
  </div>
)}
```

### Banner System
The banner system automatically shows notifications for configured HTTP status codes:

```javascript
// config/bannerConfig.js
SUCCESS_STATUS_CODES = [200, 201];  // Green banners
ERROR_STATUS_CODES = [400, 403, 404, 409, 422, 429, 500, 502, 503];  // Red banners
// 401 is handled by token refresh, not shown to user
```

### Manual Banner Usage
```javascript
const { showBanner, dismissBanner, clearAllBanners } = useBanner();

// Show success
showBanner({ type: 'success', message: 'Profile updated!' });

// Show error with code
showBanner({ type: 'error', error: 'VALIDATION_ERROR', message: 'Invalid input' });

// Show persistent notification (no auto-dismiss)
showBanner({ type: 'info', message: 'Session expiring soon', duration: 0 });
```

---

## Authentication Flow

### Login Flow (Multi-Step)
1. **Initial Login** → POST `/auth/login` → Returns `verificationKey`
2. **2FA (if required)** → POST `/auth/email/2fa/verify` → Verifies OTP
3. **Data Consent** → GET/POST `/info/consent/login` → Records consent
4. **Complete Login** → POST `/auth/login/complete` → Returns tokens

### Registration Flow (Multi-Step)
1. **Initial Register** → POST `/auth/register` → Creates pending user
2. **Send OTP** → POST `/auth/email/verification` → Sends email
3. **Verify OTP** → POST `/auth/email/verification/verify` → Returns `verificationKey`
4. **Data Consent** → POST `/info/consent/register` → Records consent
5. **Complete** → POST `/auth/register/complete` → Returns tokens

### Token Structure
- **Access Token**: Short-lived JWT for API authentication
- **Refresh Token**: Format `userId:deviceId:rawToken`
- Stored in `localStorage` via `TokenStorage`

---

## Testing (Future)

### When Tests Are Added
- Place test files adjacent to source: `Component.test.jsx`
- Use descriptive test names: `it('should render user name when data is loaded')`
- Test user behavior, not implementation details
- Context tests go in `src/context/__tests__/`

---

## Git & Version Control

### Commit Messages
Follow conventional commits:
- `feat: add user authentication`
- `fix: resolve routing issue on dashboard`
- `refactor: simplify API client logic`
- `docs: update README with setup instructions`
- `style: format code with prettier`

### Branch Naming
- Feature branches: `frontend-feature-name`
- Bug fixes: `frontend-fix-issue-description`
- Current branch: `frontend-jay`

---

## Development Workflow

### Starting Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Before Committing
1. Run `npm run lint` to check for errors
2. Test all affected functionality
3. Ensure no console errors in browser
4. Write clear, descriptive commit messages

---

## Code Quality Rules

### ESLint Configuration
- Unused variables trigger errors (except those matching `^[A-Z_]`)
- React Hooks rules are enforced
- Fast refresh rules ensure hot reload compatibility

### General Principles
- **DRY**: Don't Repeat Yourself - extract common logic
- **KISS**: Keep It Simple, Stupid - avoid over-engineering
- **YAGNI**: You Aren't Gonna Need It - don't add unused features
- **Readability**: Code is read more than written - prioritize clarity
- **Comments**: Explain *why*, not *what* - code should be self-documenting

---

## Common Patterns

### Role Context Pattern
```javascript
// src/context/role-context.jsx
import { useState } from 'react';
import { RoleContext } from './RoleContextObject';

export function RoleProvider({ children }) {
  const getInitialRole = () => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.startsWith('staff.')) return 'medical';
    return 'patient';  // Default for www, localhost, etc.
  };

  const [role] = useState(getInitialRole);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
}

// Usage in components
import { useDetectRoleFromSubdomain } from '../hooks/useRole';

const { role } = useDetectRoleFromSubdomain();
if (role === 'medical') { /* Staff-only features */ }
```

### Banner Context Pattern
```javascript
// src/context/banner-context.jsx
export const BannerProvider = ({ children }) => {
  const [banners, setBanners] = useState([]);

  const showBanner = useCallback((banner) => {
    const id = Date.now() + Math.random();
    const newBanner = {
      id,
      type: banner.type || 'info',
      message: banner.message,
      error: banner.error || null,
      duration: banner.duration ?? 5000,
    };
    setBanners((prev) => [...prev, newBanner]);
    
    if (newBanner.duration > 0) {
      setTimeout(() => dismissBanner(id), newBanner.duration);
    }
    return id;
  }, []);

  return (
    <BannerContext.Provider value={{ banners, showBanner, dismissBanner, clearAllBanners }}>
      {children}
    </BannerContext.Provider>
  );
};
```

### Modal Pattern
```jsx
const [activeModal, setActiveModal] = useState(null);

const handleOpenModal = (modalName) => {
  setActiveModal(modalName);
};

const handleCloseModal = () => {
  setActiveModal(null);
};

// Render modals
{activeModal === 'profile' && <ProfileModal onClose={handleCloseModal} />}
{activeModal === 'settings' && <SettingsModal onClose={handleCloseModal} />}
```

### Layout Pattern
```jsx
// components/layout/Layout.jsx
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-neutral-800">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-24">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
```

### Form with Loading State
```jsx
<button 
  type="submit" 
  disabled={isLoading}
  className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
>
  {isLoading ? (
    <>
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Processing...
    </>
  ) : (
    'Submit'
  )}
</button>
```

---

## Accessibility

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<header>`, `<aside>`)
- Add `aria-label` for icons and non-text elements
- Ensure keyboard navigation works (ESC to close modals, arrow keys for carousels)
- Maintain color contrast ratios (WCAG AA minimum)
- Use `role="alert"` for banner notifications
- Add `aria-expanded` for dropdowns and menus

---

## Performance Checklist

- [ ] Images are optimized (use assets folder, proper sizing)
- [ ] Routes are lazy-loaded where appropriate
- [ ] No unnecessary re-renders (check React DevTools Profiler)
- [ ] API calls use request queuing to prevent duplicate requests
- [ ] CSS animations use `transform` and `opacity` (GPU-accelerated)
- [ ] Tailwind purges unused CSS in production
- [ ] Token refresh prevents unnecessary logouts
- [ ] Click-outside handlers are properly cleaned up

---

## Icons (Lucide React)

Use Lucide icons consistently:
```jsx
import { User, Settings, Moon, Sun, LogOut, ChevronRight, Lock, ShieldCheck } from 'lucide-react';

<User className="w-6 h-6 text-gray-600" />
<Settings className="w-5 h-5" strokeWidth={2} />
```

Common icons used:
- Navigation: `User`, `Settings`, `LogOut`, `ChevronRight`, `ChevronLeft`
- Actions: `Lock`, `ShieldCheck`, `Activity`, `Send`
- Status: `Moon`, `Sun`, `HelpCircle`, `MessageSquare`
- Auth: `Shield`, `FileText`, `Zap`

---

## Resources & References

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [React Router Documentation](https://reactrouter.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons)
- [Axios Documentation](https://axios-http.com/docs/intro)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main routing and provider setup |
| `src/main.jsx` | Entry point with RoleProvider |
| `src/services/axiosRequestHandler.js` | Axios instance with interceptors |
| `src/services/refreshTokenService.js` | Token management (TokenStorage) |
| `src/services/apiBaseUrlProvider.js` | Base URL detection |
| `src/context/role-context.jsx` | Role detection provider |
| `src/context/banner-context.jsx` | Banner notification system |
| `src/config/bannerConfig.js` | HTTP status to banner mapping |
| `src/routes/private-route.jsx` | Authentication guard |
| `tailwind.config.js` | Custom design system |

---

**Remember**: Write code as if the next person to maintain it knows where you live. Make it clean, clear, and well-documented.
