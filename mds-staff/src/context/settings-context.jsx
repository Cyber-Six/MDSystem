import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { tokenService, axiosRequest } from '../packages-core-adapter';

// ── DB ↔ Frontend format converters ──────────────────────────────────────────
// Converts between the flat localStorage shape and the nested API shape.

function toBackendPrefs(s) {
  return {
    appearance:   { themeMode: s.themeMode, fontSize: s.fontSize, compactSidebar: s.compactSidebar },
    notification: {
      soundEnabled: s.soundEnabled, soundVolume: s.soundVolume,
      notificationSound: s.notificationSound,
      soundByModule: s.soundByModule,
      soundFileByModule: s.soundFileByModule,
      showBadges: s.showBadges, showBanners: s.showBanners, bannerErrorsOnly: s.bannerErrorsOnly,
      bannerCompact: s.bannerCompact, bannerAutoDismiss: s.bannerAutoDismiss, bannerDismissDelay: s.bannerDismissDelay,
    },
  };
}

function mergeFromBackendPrefs(prefs) {
  const flat = { ...(prefs.appearance || {}), ...(prefs.notification || {}) };
  const merged = sanitizeSettings(flat);
  if (prefs.notification?.soundByModule && typeof prefs.notification.soundByModule === 'object') {
    merged.soundByModule = { ...DEFAULT_SETTINGS.soundByModule, ...merged.soundByModule };
  }
  if (prefs.notification?.soundFileByModule && typeof prefs.notification.soundFileByModule === 'object') {
    merged.soundFileByModule = { ...DEFAULT_SETTINGS.soundFileByModule, ...merged.soundFileByModule };
  }
  return merged;
}

// Returns true only when a valid refresh token is present (user is logged in).
function isAuthenticated() {
  try {
    return !!tokenService.TokenStorage.getRefreshToken();
  } catch {
    return false;
  }
}

/**
 * Default settings for new users.
 * All flags are enabled by default to preserve existing behavior.
 */
const DEFAULT_SETTINGS = {
  // ── Sound Settings ──
  soundEnabled: true,
  soundVolume: 1,
  notificationSound: 'synthesis', // 'synthesis' | any id from AVAILABLE_SOUNDS
  // Per-module sound files — save  mds-staff/public/sounds/<filename>  to activate.
  // Default values match the pre-named files; change in Settings to override.
  soundFileByModule: {
    appointments:    'appointments.mp3',
    medicineRequests: 'requests.mp3',
    inventory:       'inventory.mp3',
    healthChat:      'healthchat.mp3',
    general:         'general.mp3',
  },
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
  bannerErrorsOnly: false,   // show only error/failed banners; suppress success
  bannerCompact: false,
  bannerAutoDismiss: true,
  bannerDismissDelay: 5,     // seconds

  // ── Appearance ──
  themeMode: 'system',       // 'light' | 'dark' | 'system'
  fontSize: 'default',       // 'small' | 'default' | 'large'

  // ── Sidebar ──
  compactSidebar: false,
};

const SETTINGS_STORAGE_PREFIX = 'staff_settings_';

// SECURITY: Only allow alphanumeric, underscore, and hyphen in userId to prevent
// key injection / namespace pollution in localStorage.
const VALID_USER_ID = /^[a-zA-Z0-9_-]{1,128}$/;

// SECURITY: Hash userId with djb2 before embedding it in the localStorage key so
// internal identifiers (e.g. sequential integers) are not exposed in DevTools.
function hashUserId(userId) {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul(h, 33) ^ userId.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derive a per-user storage key from the current refresh token.
 * Falls back to a generic key if no user is logged in.
 */
function getUserSettingsKey() {
  try {
    const refreshToken = tokenService.TokenStorage.getRefreshToken();
    if (refreshToken) {
      const userId = refreshToken.split(':')[0];
      // SECURITY: Validate format before use
      if (userId && VALID_USER_ID.test(userId)) {
        return `${SETTINGS_STORAGE_PREFIX}${hashUserId(userId)}`;
      }
    }
  } catch {
    // token parsing failed
  }
  return `${SETTINGS_STORAGE_PREFIX}default`;
}

// Boolean settings keys — used by sanitizeSettings for strict type checking.
const BOOL_SETTINGS_KEYS = [
  'soundEnabled', 'showBadges', 'showBanners', 'bannerErrorsOnly',
  'bannerCompact', 'bannerAutoDismiss', 'compactSidebar',
];
const SOUND_MODULE_KEYS = Object.keys(DEFAULT_SETTINGS.soundByModule);
const SOUND_FILE_MODULE_KEYS = Object.keys(DEFAULT_SETTINGS.soundFileByModule);
// SECURITY: valid sound id — alphanumeric + dot/hyphen/underscore, max 64 chars.
const VALID_SOUND_ID = /^[a-zA-Z0-9_\-.]{1,64}$/;

/**
 * Strictly validate and sanitize a parsed settings object against known schema.
 * Unknown keys and wrong types are silently dropped — only valid values are kept.
 * SECURITY: Prevents XSS-planted localStorage values from poisoning app state.
 */
function sanitizeSettings(parsed) {
  const safe = {
    ...DEFAULT_SETTINGS,
    soundByModule: { ...DEFAULT_SETTINGS.soundByModule },
    soundFileByModule: { ...DEFAULT_SETTINGS.soundFileByModule },
  };

  // Boolean keys
  BOOL_SETTINGS_KEYS.forEach((key) => {
    if (typeof parsed[key] === 'boolean') safe[key] = parsed[key];
  });

  // Clamped numbers
  if (typeof parsed.soundVolume === 'number' && isFinite(parsed.soundVolume)) {
    safe.soundVolume = Math.min(1, Math.max(0, parsed.soundVolume));
  }
  if (typeof parsed.bannerDismissDelay === 'number' && isFinite(parsed.bannerDismissDelay)) {
    safe.bannerDismissDelay = Math.min(60, Math.max(1, Math.round(parsed.bannerDismissDelay)));
  }

  // Enum keys
  if (['light', 'dark', 'system'].includes(parsed.themeMode)) safe.themeMode = parsed.themeMode;
  if (['small', 'default', 'large'].includes(parsed.fontSize)) safe.fontSize = parsed.fontSize;

  // soundByModule — only accept known boolean keys
  if (parsed.soundByModule && typeof parsed.soundByModule === 'object') {
    SOUND_MODULE_KEYS.forEach((k) => {
      if (typeof parsed.soundByModule[k] === 'boolean') safe.soundByModule[k] = parsed.soundByModule[k];
    });
  }

  // soundFileByModule — validate each value against sound-id pattern
  if (parsed.soundFileByModule && typeof parsed.soundFileByModule === 'object') {
    SOUND_FILE_MODULE_KEYS.forEach((k) => {
      const v = parsed.soundFileByModule[k];
      if (typeof v === 'string' && VALID_SOUND_ID.test(v)) safe.soundFileByModule[k] = v;
    });
  }

  // notificationSound — SECURITY: only allow safe filenames or 'synthesis'
  if (typeof parsed.notificationSound === 'string' && VALID_SOUND_ID.test(parsed.notificationSound)) {
    safe.notificationSound = parsed.notificationSound;
  }

  return safe;
}

function loadSettings(userId) {
  try {
    const key = userId
      ? `${SETTINGS_STORAGE_PREFIX}${hashUserId(userId)}`
      : getUserSettingsKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return sanitizeSettings(parsed);
    }
  } catch {
    // corrupted data — fall through to defaults
  }
  return {
    ...DEFAULT_SETTINGS,
    soundByModule: { ...DEFAULT_SETTINGS.soundByModule },
    soundFileByModule: { ...DEFAULT_SETTINGS.soundFileByModule },
  };
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

  // Track which key we last loaded so we can detect user switches.
  const currentKeyRef = useRef(getUserSettingsKey());

  // ── Sync from DB after login ──────────────────────────────────────────────
  // Only fires when a refresh token is present (user is logged in).
  // localStorage loads instantly; DB values overlay it once fetched.
  useEffect(() => {
    if (!isAuthenticated()) return; // no token — skip to avoid 401/SESSION_EXPIRED
    let cancelled = false;
    axiosRequest.get('/settings')
      .then((res) => {
        if (cancelled || !res.data?.ok) return;
        const fromDb = mergeFromBackendPrefs(res.data.preferences);
        if (!cancelled) { setSettings(fromDb); saveSettings(fromDb); }
      })
      .catch(() => { /* network or auth error — localStorage fallback stays */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload settings whenever the active user changes (login / logout in the same tab
  // or from another tab). This is triggered by:
  //   1. A custom 'mds:auth-changed' event dispatched by login/logout handlers.
  //   2. The browser 'storage' event (cross-tab token changes).
  useEffect(() => {
    const reload = (e) => {
      // SECURITY (storage event): ignore writes to unrelated localStorage keys so
      // that other modules or third-party scripts writing frequently don't cause
      // repeated settings reloads and re-renders.
      if (e?.type === 'storage') {
        if (e.key !== null && !e.key.startsWith(SETTINGS_STORAGE_PREFIX)) return;
      }

      // SECURITY: validate userId from event detail before building a key from it.
      // Any same-origin script can dispatch 'mds:auth-changed' — don't trust the
      // payload blindly.
      const rawUserId = e?.detail?.userId ?? null;
      const userId = (rawUserId && VALID_USER_ID.test(rawUserId)) ? rawUserId : null;

      const newKey = userId
        ? `${SETTINGS_STORAGE_PREFIX}${hashUserId(userId)}`
        : getUserSettingsKey();

      if (newKey !== currentKeyRef.current) {
        currentKeyRef.current = newKey;
        setSettings(loadSettings(userId));
      }
    };

    window.addEventListener('mds:auth-changed', reload);
    window.addEventListener('storage', reload); // cross-tab
    return () => {
      window.removeEventListener('mds:auth-changed', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

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

  // Apply theme mode to <html>
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (mode) => {
      if (mode === 'system') {
        root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else {
        root.classList.toggle('dark', mode === 'dark');
      }
    };
    applyTheme(settings.themeMode);
    // Keep in sync when system preference changes and mode is 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (settings.themeMode === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.themeMode]);

  const updateSettings = useCallback((next) => {
    const updated = typeof next === 'function' ? next(settingsRef.current) : next;
    setSettings(updated);
    saveSettings(updated);
    // Fire-and-forget: persist to DB if logged in (localStorage is the offline fallback)
    if (isAuthenticated()) {
      axiosRequest.patch('/settings', toBackendPrefs(updated)).catch(() => {});
    }
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
