# Tailwind CSS Setup Guide for MDSystem Frontend

## Overview
This guide walks you through setting up Tailwind CSS in your React + Vite project. The CSS files have been created with Tailwind directives and a comprehensive design system with CSS custom properties.

---

## 📋 Current Status

✅ **Created Files:**
- `src/styles/index.css` - Global styles with Tailwind directives and design system
- `src/styles/App.css` - App-specific component styles
- `tailwind.config.js` - Tailwind configuration file (empty, ready for customization)

---

## 🚀 Installation Steps

### Step 1: Install Tailwind CSS and Dependencies

Run the following command in your terminal:

```bash
cd mdsystem-frontend
npm install -D tailwindcss postcss autoprefixer
```

### Step 2: Initialize Tailwind Configuration (Optional)

If you want to regenerate the Tailwind config file:

```bash
npx tailwindcss init -p
```

This will create:
- `tailwind.config.js` (already created)
- `postcss.config.js` (will be auto-created)

### Step 3: Update `tailwind.config.js`

The file is already created, but you can customize it further:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Extend with your custom colors matching CSS variables
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#2563eb',
        },
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          DEFAULT: '#0d9488',
        },
        tertiary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          DEFAULT: '#9333ea',
        },
      },
    },
  },
  plugins: [],
}
```

### Step 4: Create `postcss.config.js`

Create this file in the root directory (`mdsystem-frontend/`):

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Step 5: Verify CSS Files Are Imported

Your `main.jsx` already imports the CSS:

```javascript
import './styles/index.css'
```

This is correct! The index.css file includes Tailwind directives.

---

## 🎨 Design System Features

### Color Variables

The design system includes comprehensive color palettes:

**Primary Colors (Blue):** Medical/Professional theme
- Use: `var(--color-primary)` or Tailwind's `bg-primary`

**Secondary Colors (Teal/Emerald):** Healthcare/Trust theme
- Use: `var(--color-secondary)` or Tailwind's `bg-secondary`

**Tertiary Colors (Purple/Violet):** Accent/Highlight theme
- Use: `var(--color-tertiary)` or Tailwind's `bg-tertiary`

### Typography System

**Headings:**
```html
<h1>Heading 1 - 36px, Bold</h1>
<h2>Heading 2 - 30px, Bold</h2>
<h3>Heading 3 - 24px, Semibold</h3>
<h4>Heading 4 - 20px, Semibold</h4>
<h5>Heading 5 - 18px, Medium</h5>
<h6>Heading 6 - 16px, Medium</h6>
```

**CSS Variable Usage:**
```css
.custom-heading {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
```

**Tailwind Classes:**
```html
<h1 className="text-4xl font-bold text-gray-900">Title</h1>
<p className="text-base text-gray-700">Body text</p>
```

---

## 💡 Usage Examples

### Using CSS Variables

```jsx
// In your component styles
<div style={{
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-text-inverse)',
  padding: 'var(--spacing-lg)',
  borderRadius: 'var(--radius-md)'
}}>
  Content
</div>
```

### Using Tailwind Classes

```jsx
// Tailwind utility classes
<div className="bg-primary text-white p-6 rounded-lg shadow-md">
  Content
</div>
```

### Using Component Classes

```jsx
// Pre-built component classes from App.css
<button className="btn btn-primary">
  Click Me
</button>

<div className="card">
  <div className="card-header">
    <h3 className="card-title">Card Title</h3>
  </div>
  <div className="card-body">
    Card content here
  </div>
</div>
```

### Combining Both Approaches

```jsx
// Best of both worlds
<div className="card bg-white shadow-lg hover:shadow-xl transition-shadow">
  <h2 style={{ color: 'var(--color-primary)' }} className="text-2xl font-bold mb-4">
    Hybrid Styling
  </h2>
</div>
```

---

## 🔧 Troubleshooting

### Issue: `@tailwind` unknown at rule warnings

**Solution:** These are expected until you install Tailwind CSS. Run:
```bash
npm install -D tailwindcss postcss autoprefixer
```

### Issue: Styles not applying

**Solutions:**
1. Restart the Vite dev server: `npm run dev`
2. Clear browser cache
3. Check that `index.css` is imported in `main.jsx`
4. Verify `content` paths in `tailwind.config.js`

### Issue: CSS variables not working

**Check:**
- Browser DevTools > Computed styles
- Ensure `:root` selector is not overridden
- Use modern browsers (Chrome, Firefox, Edge, Safari)

---

## 📚 Color Reference

### Primary Colors (Blue)
- `--color-primary-50` to `--color-primary-900`
- Main: `--color-primary` (#2563eb)

### Secondary Colors (Teal)
- `--color-secondary-50` to `--color-secondary-900`
- Main: `--color-secondary` (#0d9488)

### Tertiary Colors (Purple)
- `--color-tertiary-50` to `--color-tertiary-900`
- Main: `--color-tertiary` (#9333ea)

### Semantic Colors
- Success: `--color-success` (#10b981)
- Warning: `--color-warning` (#f59e0b)
- Error: `--color-error` (#ef4444)
- Info: `--color-info` (#3b82f6)

---

## 📝 Next Steps

1. **Install Tailwind** (run the npm install command above)
2. **Restart dev server** (`npm run dev`)
3. **Start using Tailwind classes** in your components
4. **Customize** `tailwind.config.js` to match your design needs
5. **Consider adding Tailwind plugins:**
   - `@tailwindcss/forms` - Better form styling
   - `@tailwindcss/typography` - Rich text styling
   - `@tailwindcss/aspect-ratio` - Aspect ratio utilities

---

## 🎯 Quick Commands

```bash
# Install Tailwind
npm install -D tailwindcss postcss autoprefixer

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📖 Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind with Vite Guide](https://tailwindcss.com/docs/guides/vite)
- [CSS Variables Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

**Your design system is ready!** Install Tailwind CSS and start building beautiful, consistent UIs. 🎨
