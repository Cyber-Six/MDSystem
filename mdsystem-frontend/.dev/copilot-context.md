# MDSystem Frontend - Development Guidelines

## Project Overview
This is a React-based frontend application using Vite as the build tool, React Router for navigation, and the React Compiler for optimization.

## Technology Stack
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Routing**: React Router DOM 7.9.6
- **Compiler**: React Compiler (babel-plugin-react-compiler)
- **Linting**: ESLint 9.39.1

---

## Code Style & Conventions

### File Naming
- **Components**: PascalCase (e.g., `UserProfile.jsx`, `NavigationBar.jsx`)
- **Utilities/Helpers**: camelCase (e.g., `formatDate.js`, `apiClient.js`)
- **Styles**: Match component name (e.g., `UserProfile.css`)
- **Constants**: SCREAMING_SNAKE_CASE in files named `constants.js`

### Component Structure
```jsx
// 1. Imports (external libraries first, then internal modules)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { API_BASE_URL } from '../constants';
import './ComponentName.css';

// 2. Component definition with JSDoc
/**
 * ComponentName - Brief description
 * @param {Object} props - Component props
 * @param {string} props.title - Description of prop
 */
export default function ComponentName({ title, onAction }) {
  // 3. Hooks (state, effects, etc.)
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Side effects
  }, []);

  // 4. Event handlers and helper functions
  const handleAction = () => {
    // Handler logic
  };

  // 5. Render
  return (
    <div className="component-name">
      {/* JSX content */}
    </div>
  );
}
```

### Naming Conventions
- **Variables**: camelCase (e.g., `userData`, `isLoading`, `handleSubmit`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_RETRY_ATTEMPTS`)
- **Components**: PascalCase (e.g., `UserProfile`, `DashboardLayout`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (e.g., `isVisible`, `hasError`, `shouldRender`)
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`, `handleSubmit`, `handleChange`)
- **Custom hooks**: Prefix with `use` (e.g., `useAuth`, `useFetch`, `useLocalStorage`)

### React Best Practices

#### Component Design
- Prefer **function components** with hooks over class components
- Keep components **small and focused** (single responsibility)
- Use **default exports** for components
- Use **named exports** for utilities and helpers
- Extract reusable logic into **custom hooks**

#### State Management
- Use `useState` for local component state
- Use `useReducer` for complex state logic
- Lift state up only when necessary
- Consider context for deeply nested prop drilling (create context files in `src/context/`)

#### Performance Optimization
- React Compiler is enabled - avoid manual `useMemo`/`useCallback` unless measuring performance issues
- Use `React.lazy()` and `Suspense` for code splitting on route level
- Avoid inline function definitions in JSX for frequently re-rendering components

#### Prop Validation
- Add JSDoc comments for props documentation
- Consider TypeScript migration for better type safety in the future

---

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page-level components (route targets)
├── features/        # Feature-specific modules
├── routes/          # Route configuration
├── styles/          # Global styles and CSS modules
├── assets/          # Static assets (images, fonts)
├── hooks/           # Custom React hooks
├── utils/           # Helper functions and utilities
├── services/        # API services and data fetching
├── context/         # React Context providers
└── constants/       # Application constants
```

### Directory Guidelines
- **components/**: Small, reusable UI elements (Button, Card, Modal, etc.)
- **pages/**: Full page components mapped to routes
- **features/**: Domain-specific functionality (auth, dashboard, etc.)
- **routes/**: Centralized routing configuration
- **hooks/**: Custom hooks for shared logic
- **services/**: API calls and external integrations
- **utils/**: Pure functions and helpers

---

## Styling Guidelines

### CSS Organization
- Use **CSS Modules** or **plain CSS** with BEM-like naming
- Global styles go in `src/styles/`
- Component-specific styles colocate with components
- Use semantic class names: `.user-profile__header`, `.button--primary`

### CSS Class Naming (BEM-inspired)
```css
/* Block */
.user-profile { }

/* Element */
.user-profile__header { }
.user-profile__avatar { }

/* Modifier */
.button--primary { }
.button--disabled { }
```

---

## Routing

### Route Organization
- Define routes in `src/routes/`
- Use React Router's latest features (loaders, actions)
- Implement lazy loading for page components:

```jsx
import { lazy } from 'react';

const Dashboard = lazy(() => import('../pages/Dashboard'));
```

### Route Naming
- Use descriptive paths: `/users/:id`, `/dashboard/settings`
- Keep URLs lowercase with hyphens: `/user-profile`, `/admin-panel`

---

## API & Data Fetching

### API Client
- Centralize API calls in `src/services/`
- Use consistent error handling
- Create service modules by domain (e.g., `userService.js`, `authService.js`)

```javascript
// src/services/userService.js
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function fetchUser(id) {
  const response = await fetch(`${API_BASE}/users/${id}`);
  if (!response.ok) throw new Error('Failed to fetch user');
  return response.json();
}
```

### Environment Variables
- Use `VITE_` prefix for environment variables
- Access via `import.meta.env.VITE_VARIABLE_NAME`
- Store in `.env` files (never commit secrets)

---

## Error Handling

### Standard Error Patterns
```jsx
// Component error states
const [error, setError] = useState(null);
const [isLoading, setIsLoading] = useState(false);

try {
  setIsLoading(true);
  const data = await fetchData();
  setData(data);
} catch (err) {
  setError(err.message);
  console.error('Error fetching data:', err);
} finally {
  setIsLoading(false);
}
```

### Error Boundaries
- Implement error boundaries for production
- Create in `src/components/ErrorBoundary.jsx`

---

## Testing (Future)

### When Tests Are Added
- Place test files adjacent to source: `Component.test.jsx`
- Use descriptive test names: `it('should render user name when data is loaded')`
- Test user behavior, not implementation details

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

### Custom Hook Example
```javascript
// src/hooks/useFetch.js
import { useState, useEffect } from 'react';

export function useFetch(url) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [url]);

  return { data, isLoading, error };
}
```

### Context Pattern
```javascript
// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

---

## Accessibility

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)
- Add `aria-label` for icons and non-text elements
- Ensure keyboard navigation works
- Maintain color contrast ratios (WCAG AA minimum)

---

## Performance Checklist

- [ ] Images are optimized and properly sized
- [ ] Routes are lazy-loaded where appropriate
- [ ] No unnecessary re-renders (check React DevTools Profiler)
- [ ] API calls are debounced/throttled when needed
- [ ] Large lists use virtualization if necessary

---

## Resources & References

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [React Router Documentation](https://reactrouter.com)
- [ESLint Rules](https://eslint.org/docs/rules/)

---

**Remember**: Write code as if the next person to maintain it knows where you live. Make it clean, clear, and well-documented.
