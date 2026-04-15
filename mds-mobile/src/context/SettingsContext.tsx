/**
 * Settings Context for React Native
 *
 * Manages user preferences (appearance, notification channels, sound) with:
 *   - AsyncStorage persistence (offline-first)
 *   - Server sync via GET/PATCH /settings
 *   - Per-user storage keys (hashed userId)
 *   - Strict sanitization against known schema
 *
 * Mirrors mds-patient/src/context/settings-context.jsx adapted for React Native.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { axiosRequest, TokenStorage } from '../core';

// ── Constants ────────────────────────────────────────────────────────────────

const NOTIFICATION_MODULE_KEYS = [
  'appointments', 'healthChat', 'medicineRequests', 'documents',
  'emr', 'general',
] as const;

type ModuleKey = (typeof NOTIFICATION_MODULE_KEYS)[number];

interface ChannelPrefs {
  web: boolean;
  email: boolean;
  emailFallback: boolean;
}

export interface MobileSettings {
  // ── Sound ──
  soundEnabled: boolean;
  soundVolume: number;

  // ── Notification Display ──
  showBanners: boolean;

  // ── Notification Channels ──
  channels: ChannelPrefs;
  moduleChannels: Record<ModuleKey, ChannelPrefs>;

  // ── Appearance ──
  themeMode: 'light' | 'dark' | 'system';
}

const DEFAULT_CHANNEL: ChannelPrefs = { web: true, email: false, emailFallback: true };

function buildDefaultModuleChannels(): Record<ModuleKey, ChannelPrefs> {
  const mc: any = {};
  for (const key of NOTIFICATION_MODULE_KEYS) {
    mc[key] = { ...DEFAULT_CHANNEL };
  }
  return mc;
}

export const DEFAULT_SETTINGS: MobileSettings = {
  soundEnabled: true,
  soundVolume: 1,
  showBanners: true,
  channels: { ...DEFAULT_CHANNEL },
  moduleChannels: buildDefaultModuleChannels(),
  themeMode: 'system',
};

// ── Storage helpers ──────────────────────────────────────────────────────────

const SETTINGS_STORAGE_PREFIX = 'mobile_settings_';

// SECURITY: Only allow alphanumeric, underscore, and hyphen in userId.
const VALID_USER_ID = /^[a-zA-Z0-9_-]{1,128}$/;

// SECURITY: Hash userId with djb2 so internal IDs aren't exposed.
function hashUserId(userId: string): string {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul(h, 33) ^ userId.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function getUserSettingsKey(): string {
  try {
    // TokenStorage is synchronous for getRefreshToken in the core package
    const refreshToken = TokenStorage.getRefreshToken?.();
    if (refreshToken && typeof refreshToken === 'string') {
      const userId = refreshToken.split(':')[0];
      if (userId && VALID_USER_ID.test(userId)) {
        return `${SETTINGS_STORAGE_PREFIX}${hashUserId(userId)}`;
      }
    }
  } catch {
    // token parsing failed
  }
  return `${SETTINGS_STORAGE_PREFIX}default`;
}

// ── Sanitisation ─────────────────────────────────────────────────────────────

function sanitizeSettings(parsed: any): MobileSettings {
  const safe: MobileSettings = {
    ...DEFAULT_SETTINGS,
    channels: { ...DEFAULT_SETTINGS.channels },
    moduleChannels: buildDefaultModuleChannels(),
  };

  // Booleans
  if (typeof parsed.soundEnabled === 'boolean') safe.soundEnabled = parsed.soundEnabled;
  if (typeof parsed.showBanners === 'boolean') safe.showBanners = parsed.showBanners;

  // Clamped number
  if (typeof parsed.soundVolume === 'number' && isFinite(parsed.soundVolume)) {
    safe.soundVolume = Math.min(1, Math.max(0, parsed.soundVolume));
  }

  // Enum
  if (['light', 'dark', 'system'].includes(parsed.themeMode)) {
    safe.themeMode = parsed.themeMode;
  }

  // Global channels
  if (parsed.channels && typeof parsed.channels === 'object') {
    if (typeof parsed.channels.web === 'boolean') safe.channels.web = parsed.channels.web;
    if (typeof parsed.channels.email === 'boolean') safe.channels.email = parsed.channels.email;
    if (typeof parsed.channels.emailFallback === 'boolean') safe.channels.emailFallback = parsed.channels.emailFallback;
  }

  // Per-module channels
  if (parsed.moduleChannels && typeof parsed.moduleChannels === 'object') {
    for (const key of NOTIFICATION_MODULE_KEYS) {
      if (parsed.moduleChannels[key] && typeof parsed.moduleChannels[key] === 'object') {
        const mc = parsed.moduleChannels[key];
        if (typeof mc.web === 'boolean') safe.moduleChannels[key].web = mc.web;
        if (typeof mc.email === 'boolean') safe.moduleChannels[key].email = mc.email;
        if (typeof mc.emailFallback === 'boolean') safe.moduleChannels[key].emailFallback = mc.emailFallback;
      }
    }
  }

  return safe;
}

// ── Backend converters ───────────────────────────────────────────────────────

function toBackendPrefs(s: MobileSettings) {
  return {
    appearance: { themeMode: s.themeMode },
    notification: {
      soundEnabled: s.soundEnabled,
      soundVolume: s.soundVolume,
      showBanners: s.showBanners,
      channels: s.channels,
      moduleChannels: s.moduleChannels,
    },
  };
}

function mergeFromBackendPrefs(prefs: any): MobileSettings {
  const flat = { ...(prefs.appearance || {}), ...(prefs.notification || {}) };
  const merged = sanitizeSettings(flat);

  if (prefs.notification?.channels && typeof prefs.notification.channels === 'object') {
    merged.channels = { ...DEFAULT_SETTINGS.channels, ...merged.channels };
  }
  if (prefs.notification?.moduleChannels && typeof prefs.notification.moduleChannels === 'object') {
    merged.moduleChannels = { ...buildDefaultModuleChannels() };
    for (const key of NOTIFICATION_MODULE_KEYS) {
      if (prefs.notification.moduleChannels[key] && typeof prefs.notification.moduleChannels[key] === 'object') {
        merged.moduleChannels[key] = { ...DEFAULT_SETTINGS.channels, ...prefs.notification.moduleChannels[key] };
      }
    }
  }
  return merged;
}

// ── Async storage helpers ────────────────────────────────────────────────────

async function loadSettings(): Promise<MobileSettings> {
  try {
    const key = getUserSettingsKey();
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      return sanitizeSettings(JSON.parse(raw));
    }
  } catch {
    // corrupted — fall through
  }
  return sanitizeSettings({});
}

async function saveSettings(settings: MobileSettings): Promise<void> {
  try {
    const key = getUserSettingsKey();
    await AsyncStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // storage full or blocked
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: MobileSettings;
  updateSettings: (next: MobileSettings | ((prev: MobileSettings) => MobileSettings)) => void;
  DEFAULT_SETTINGS: MobileSettings;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<MobileSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const initialLoadDone = useRef(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      initialLoadDone.current = true;
    });
  }, []);

  // Sync from backend after initial load
  useEffect(() => {
    if (!initialLoadDone.current) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await TokenStorage.getAccessToken?.();
        if (!token || cancelled) return;

        const res = await axiosRequest.get('/settings');
        if (cancelled || !res.data?.ok) return;

        const fromDb = mergeFromBackendPrefs(res.data.preferences);
        setSettings(fromDb);
        await saveSettings(fromDb);
      } catch {
        // network/auth error — local settings stay
      }
    })();
    return () => { cancelled = true; };
  }, [initialLoadDone.current]);

  const updateSettings = useCallback((next: MobileSettings | ((prev: MobileSettings) => MobileSettings)) => {
    const updated = typeof next === 'function' ? next(settingsRef.current) : next;
    setSettings(updated);
    saveSettings(updated);

    // Fire-and-forget: persist to backend
    axiosRequest.patch('/settings', toBackendPrefs(updated)).catch(() => {});
  }, []);

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    DEFAULT_SETTINGS,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

export { NOTIFICATION_MODULE_KEYS };
export default SettingsContext;
