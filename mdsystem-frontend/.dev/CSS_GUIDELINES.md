# CSS Guidelines & Best Practices

## Current CSS Architecture

### What We're Using: **CSS Modules**

CSS Modules are the recommended approach for this project because:
- ✅ **Scoped by default** - No global namespace pollution
- ✅ **Component-focused** - CSS lives near the component
- ✅ **Build-time optimization** - Vite handles it automatically
- ✅ **Type-safe** (with TypeScript) - Can generate types for class names

---

## File Naming Convention

### **Pattern:** `ComponentName.module.css`

```
✅ CORRECT:
- Banner.module.css
- Login.module.css
- Dashboard.module.css
- UserCard.module.css

❌ WRONG:
- banner.css (not a module)
- Banner.css (missing .module)
- banner-styles.module.css (inconsistent naming)
```

### **Why `.module.css`?**
Vite/Webpack recognize this pattern and automatically scope CSS class names to avoid conflicts.

---

## Directory Structure

### **Current Structure (Recommended):**

```
src/
├── styles/                    # Global styles only
│   ├── index.css             # Global resets, fonts, body
│   └── App.css               # App-level layout styles
│
├── components/               # Reusable components
│   └── banner/
│       ├── Banner.jsx
│       └── Banner.module.css  # Component-specific CSS
│
├── modules/                  # Feature modules
│   ├── auth/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── auth.module.css        # Shared auth styles
│   │   ├── login.module.css       # Login-specific
│   │   └── register.module.css    # Register-specific
│   │
│   ├── dashboard/
│   │   ├── Dashboard.jsx (in pages/)
│   │   └── dashboard.module.css   # Dashboard styles
│   │
│   └── landing/
│       ├── Landing.jsx (in pages/)
│       └── landing.module.css     # Landing styles
│
└── pages/                    # Page components
    ├── Auth.jsx
    ├── Dashboard.jsx
    └── Landing.jsx
```

### **Reasoning:**

1. **Component-specific CSS goes with component**
   - `Banner.jsx` → `Banner.module.css` in same folder
   
2. **Module styles live in modules/ folder**
   - Auth styles in `src/modules/auth/`
   - Dashboard styles in `src/modules/dashboard/`
   
3. **Global styles in src/styles/**
   - Only for app-wide resets, fonts, global variables

---

## CSS Module Usage

### **Basic Example:**

```jsx
// Banner.jsx
import styles from './Banner.module.css';

function Banner() {
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.banner}>
        <span className={styles.icon}>✓</span>
      </div>
    </div>
  );
}
```

```css
/* Banner.module.css */
.bannerContainer {
  position: fixed;
  top: 20px;
  right: 20px;
}

.banner {
  background: white;
  border-radius: 8px;
}

.icon {
  font-size: 16px;
}
```

**Generated HTML:**
```html
<div class="Banner_bannerContainer__a3x9f">
  <div class="Banner_banner__k2p1s">
    <span class="Banner_icon__m8n4z">✓</span>
  </div>
</div>
```

**Notice:** Class names are automatically scoped with unique hash!

---

## Naming Conventions

### **Class Names: camelCase**

```css
/* ✅ GOOD - camelCase */
.bannerContainer { }
.errorMessage { }
.submitButton { }
.userProfileCard { }

/* ❌ BAD - kebab-case (harder to use in JS) */
.banner-container { }  /* Requires styles['banner-container'] */
.error-message { }
```

### **Why camelCase?**
Easier to use in JavaScript:
```jsx
✅ styles.bannerContainer
❌ styles['banner-container']  // More typing, error-prone
```

---

## File Organization Guidelines

### **1. Small Components (1 component)**

```
src/components/button/
├── Button.jsx
└── Button.module.css
```

### **2. Complex Components (multiple sub-components)**

```
src/components/modal/
├── Modal.jsx
├── ModalHeader.jsx
├── ModalBody.jsx
├── ModalFooter.jsx
└── modal.module.css        # Shared styles for all modal parts
```

**OR** (if styles are complex):

```
src/components/modal/
├── Modal.jsx
├── Modal.module.css
├── ModalHeader.jsx
├── ModalHeader.module.css
├── ModalBody.jsx
├── ModalBody.module.css
├── ModalFooter.jsx
└── ModalFooter.module.css
```

### **3. Feature Modules (multiple related components)**

```
src/modules/auth/
├── Login.jsx
├── Register.jsx
├── ForgotPassword.jsx
├── auth.module.css          # Shared auth styles
├── login.module.css         # Login-specific
├── register.module.css      # Register-specific
└── forgotPassword.module.css
```

---

## Where to Put CSS?

### **Decision Tree:**

```
Is it a global style (reset, fonts, body)?
├─ YES → src/styles/index.css
└─ NO
    │
    Is it used by multiple components?
    ├─ YES → Shared module CSS (e.g., auth.module.css)
    └─ NO → Component-specific CSS (e.g., Login.module.css)
```

### **Examples:**

**Global Styles (`src/styles/index.css`):**
```css
/* Reset, fonts, body */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background: #f5f5f5;
}

:root {
  --primary-color: #646cff;
  --success-color: #10b981;
  --error-color: #ef4444;
}
```

**Shared Module Styles (`auth.module.css`):**
```css
/* Shared between Login, Register, ForgotPassword */
.formContainer {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
}

.inputField {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
}

.submitButton {
  background: var(--primary-color);
  color: white;
  padding: 0.75rem 2rem;
}
```

**Component-Specific (`Login.module.css`):**
```css
/* Only used in Login.jsx */
.loginHeader {
  text-align: center;
  margin-bottom: 2rem;
}

.rememberMe {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

---

## CSS Organization Within File

### **Recommended Order:**

```css
/* 1. Layout & Positioning */
.container {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 2. Box Model (size, padding, margin) */
.box {
  width: 100%;
  max-width: 400px;
  padding: 1rem;
  margin: 0 auto;
}

/* 3. Visual Styles (colors, borders, shadows) */
.card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* 4. Typography */
.text {
  font-size: 1rem;
  font-weight: 500;
  color: #333;
  line-height: 1.5;
}

/* 5. Animations & Transitions */
.animated {
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease-out;
}

/* 6. Media Queries (at the end) */
@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }
}
```

---

## Advanced Patterns

### **1. Conditional Classes**

```jsx
// Combining multiple classes
<div className={`${styles.banner} ${styles.error}`}>

// Using classnames library (optional)
import classNames from 'classnames';
<div className={classNames(styles.banner, {
  [styles.error]: hasError,
  [styles.success]: isSuccess
})}>
```

### **2. Global Modifiers (when needed)**

```css
/* Use :global() for global class names */
.banner :global(.antd-button) {
  margin-left: 1rem;
}

/* Or */
:global {
  .global-class-name {
    color: red;
  }
}
```

### **3. CSS Variables (Custom Properties)**

```css
/* Define in global styles */
:root {
  --color-primary: #646cff;
  --color-success: #10b981;
  --color-error: #ef4444;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --border-radius: 8px;
}

/* Use in modules */
.button {
  background: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
}
```

---

## Recommended Folder Structure

### **Current (Good):**
```
src/
├── styles/              ✅ Global styles
├── components/          ✅ Reusable components with CSS modules
├── modules/             ✅ Feature modules with shared/specific CSS
└── pages/               ✅ Page components (use module CSS)
```

### **Future Expansion (Optional):**

If project grows large, consider:

```
src/
├── styles/
│   ├── index.css           # Global resets
│   ├── variables.css       # CSS custom properties
│   └── utilities.css       # Utility classes (if needed)
│
├── components/
│   ├── common/             # Shared UI components
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   └── Button.module.css
│   │   ├── Input/
│   │   └── Card/
│   │
│   └── layout/             # Layout components
│       ├── Header/
│       ├── Footer/
│       └── Sidebar/
│
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── patients/          # New feature module
│   └── reports/
│
└── pages/
    ├── Auth.jsx
    ├── Dashboard.jsx
    └── Patients.jsx
```

---

## Best Practices Summary

### **DO ✅**

1. **Use CSS Modules for components**
   ```jsx
   import styles from './Component.module.css';
   ```

2. **Name files consistently**
   ```
   ComponentName.module.css
   ```

3. **Use camelCase for class names**
   ```css
   .bannerContainer { }
   ```

4. **Keep CSS near components**
   ```
   Banner.jsx + Banner.module.css in same folder
   ```

5. **Use CSS variables for themes**
   ```css
   background: var(--color-primary);
   ```

6. **Mobile-first responsive design**
   ```css
   /* Base styles for mobile */
   .container { padding: 1rem; }
   
   /* Desktop overrides */
   @media (min-width: 768px) {
     .container { padding: 2rem; }
   }
   ```

### **DON'T ❌**

1. **Don't use inline styles (except dynamic values)**
   ```jsx
   ❌ <div style={{ color: 'red', padding: '20px' }}>
   ✅ <div className={styles.errorBox}>
   ```

2. **Don't create global CSS files for components**
   ```
   ❌ components/Banner/styles.css (global)
   ✅ components/Banner/Banner.module.css (scoped)
   ```

3. **Don't use ID selectors**
   ```css
   ❌ #banner { }
   ✅ .banner { }
   ```

4. **Don't over-nest**
   ```css
   ❌ .container .header .nav .item .link { }
   ✅ .navLink { }
   ```

5. **Don't use !important (unless absolutely necessary)**
   ```css
   ❌ .button { color: red !important; }
   ✅ .button { color: red; }
   ```

---

## Migration Path (If Needed)

If you want to migrate to a different CSS solution later:

### **Current: CSS Modules** ✅
- Best for: Most React projects
- Pros: Scoped, simple, no dependencies

### **Future Options:**

1. **Tailwind CSS**
   - Utility-first CSS framework
   - Good for: Rapid prototyping, consistent design
   - Trade-off: Less custom CSS, larger HTML classes

2. **Styled Components**
   - CSS-in-JS solution
   - Good for: Dynamic styling, theming
   - Trade-off: Runtime overhead, larger bundle

3. **Sass/SCSS**
   - CSS preprocessor
   - Good for: Advanced features (mixins, nesting)
   - Works with CSS Modules: `Component.module.scss`

**Recommendation:** Stick with CSS Modules for now. It's the sweet spot between simplicity and scalability.

---

## Quick Reference

### **When to create a new CSS file:**

| Scenario | File Location | Example |
|----------|--------------|---------|
| New component | Same folder as component | `Button.jsx` + `Button.module.css` |
| New page | Module folder | `Dashboard.jsx` uses `modules/dashboard/dashboard.module.css` |
| Shared module styles | Module folder | `auth.module.css` for Login + Register |
| Global styles | `src/styles/` | `index.css` for resets |
| Theme variables | `src/styles/variables.css` | CSS custom properties |

### **File naming checklist:**

- ✅ Ends with `.module.css`
- ✅ PascalCase for components: `Button.module.css`
- ✅ camelCase for modules: `auth.module.css`
- ✅ Lives with component or in module folder
- ✅ Uses camelCase class names inside

---

## Summary

**Current Setup:** ✅ Already following best practices!

**Recommendations:**
1. Continue using CSS Modules
2. Keep CSS files with components
3. Use `src/styles/` only for global styles
4. Use CSS variables for theming
5. Follow camelCase naming convention
6. Keep files small and focused

Your current structure is solid and scales well for medium-large projects! 🎨
