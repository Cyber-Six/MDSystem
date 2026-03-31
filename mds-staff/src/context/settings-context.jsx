import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { tokenService } from '../packages-core-adapter';

/**
 * Default settings for new users.
 * All flags are enabled by default to preserve existing behavior.
 */
const DEFAULT_SETTINGS = {
  // ── Sound Settings ──
  soundEnabled: true,
  soundVolume: 0.5,
  soundByModule: {
    healthChat: true,
    appointments: true,
    medicineRequests: true,
    inventory: true,
    general: true,
  },

  // ── Notification Display ──
  showBadges: true,
  showBanners: true,
  bannerAutoDismiss: true,
  bannerDismissDelay: 5, // seconds

  // ── Appearance ──
  fontSize: 'default', // 'small' | 'default' | 'large'

  // ── Sidebar ──
  compactSidebar: false,
};

const SETTINGS_STORAGE_PREFIX = 'staff_settings_';

/**
 * Derive a per-user storage key from the current refresh token.
 * Falls back to a generic key if no user is logged in.
 */
function getUserSettingsKey() {
  try {
    const refreshToken = tokenService.TokenStorage.getRefreshToken();
    if (refreshToken) {
      const userId = refreshToken.split(':')[0];
      if (userId) return `${SETTINGS_STORAGE_PREFIX}${userId}`;
    }
  } catch {
    // token parsing failed
  }
  return `${SETTINGS_STORAGE_PREFIX}default`;
}

function loadSettings() {
  try {
    const key = getUserSettingsKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to pick up any newly-added keys
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        soundByModule: {
          ...DEFAULT_SETTINGS.soundByModule,
          ...(parsed.soundByModule || {}),
        },
      };
    }
  } catch {
    // corrupted data
  }
  return { ...DEFAULT_SETTINGS, soundByModule: { ...DEFAULT_SETTINGS.soundByModule } };
}

/**
 * Standalone function: reads current user settings from localStorage.
 * Can be called outside of React (e.g. from banner component or services).
 */
export function getStaffSettings() {
  return loadSettings();
}

function saveSettings(settings) {
  try {
    const key = getUserSettingsKey();
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // localStorage full or blocked
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Apply font-size class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-large');
    if (settings.fontSize === 'small') {
      root.classList.add('font-size-small');
    } else if (settings.fontSize === 'large') {
      root.classList.add('font-size-large');
    }
  }, [settings.fontSize]);

  const updateSettings = useCallback((next) => {
    const updated = typeof next === 'function' ? next(settingsRef.current) : next;
    setSettings(updated);
    saveSettings(updated);
  }, []);

  /**
   * Check if a particular module's sound is enabled.
   */
  const isModuleSoundEnabled = useCallback((moduleKey) => {
    const s = settingsRef.current;
    if (!s.soundEnabled) return false;
    return s.soundByModule[moduleKey] !== false;
  }, []);

  const value = {
    settings,
    updateSettings,
    isModuleSoundEnabled,
    DEFAULT_SETTINGS,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

export { DEFAULT_SETTINGS };
export default SettingsContext;
