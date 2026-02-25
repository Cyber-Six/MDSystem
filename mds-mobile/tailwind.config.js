/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Primary - TIP Yellow/Gold Brand Color
        primary: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F1C526',
          600: '#DDB322',
          700: '#C9A01E',
          800: '#B58D1A',
          900: '#8B6914',
        },
        // Secondary - Warm Dark Gray/Black
        secondary: {
          50: '#faf9f7',
          100: '#f0eeeb',
          200: '#e2dfd9',
          300: '#cec9c2',
          400: '#a8a29e',
          500: '#6e6a64',
          600: '#4d4944',
          700: '#3a3733',
          800: '#28251f',
          900: '#1c1a17',
        },
        // Accent - Blue
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        // Success - Green
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        // Error - Red
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Warning - Orange
        warning: {
          500: '#f97316',
        },
        // Neutral - Warm Stone tones (easy on the eyes)
        neutral: {
          50: '#faf9f7',
          100: '#f4f2ef',
          200: '#e8e5e0',
          300: '#d5d1cb',
          400: '#a19b93',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
      },
    },
  },
  plugins: [],
}
