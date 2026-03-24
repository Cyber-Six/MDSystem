/**
 * Theme Context for Dark Mode Support
 * Mirrors the frontend's dark mode implementation using TIP brand colors
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@mdsystem/theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Calculate actual theme
  const theme: 'light' | 'dark' = 
    themeMode === 'system' 
      ? (systemColorScheme || 'light') 
      : themeMode;

  const isDark = theme === 'dark';

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Color palette matching the frontend tailwind config
 * Use these for dynamic theming in components
 */
export const colors = {
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
    DEFAULT: '#F1C526',
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
    DEFAULT: '#3a3733',
  },
  // Accent - Blue
  accent: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    DEFAULT: '#2563eb',
  },
  // Success - Green
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    DEFAULT: '#22c55e',
  },
  // Error - Red
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    DEFAULT: '#ef4444',
  },
  // Neutral - Warm Stone tones
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
    DEFAULT: '#78716c',
  },
  // Dark mode specific
  dark: {
    bg: {
      primary: '#171717',
      secondary: '#1e293b',
      tertiary: '#334155',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
    },
    border: {
      primary: '#334155',
      secondary: '#475569',
    },
  },
};
