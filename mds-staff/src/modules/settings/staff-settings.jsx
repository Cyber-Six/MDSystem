import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/settings-context';
import TotpSettings from './totp-settings';
import ChangePasswordSettings from './change-password-settings';

/**
 * Unsaved-changes guard dialog
 */
const DiscardDialog = ({ onDiscard, onApply, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 w-full max-w-sm mx-4 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-full bg-warning-100 dark:bg-warning-900/30">
          <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Unsaved Changes</h3>
      </div>
      <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-5">
        You have unsaved changes. Would you like to apply them or discard?
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          Stay
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-sm font-medium rounded-lg text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
        >
          Discard
        </button>
        <button
          onClick={onApply}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
        >
          Save &amp; Leave
        </button>
      </div>
    </div>
  </div>
);

/**
 * Toggle switch component
 */
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
    } ${checked ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

/**
 * Section wrapper
 */
const Section = ({ icon, title, description, children }) => (
  <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
    <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
      <div className="flex items-center gap-2.5">
        <span className="text-secondary-500 dark:text-neutral-400">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </div>
    <div className="px-5 py-3 divide-y divide-neutral-100 dark:divide-neutral-700/50">
      {children}
    </div>
  </div>
);

/**
 * Settings row
 */
const SettingRow = ({ label, description, children, indent }) => (
  <div className={`flex items-center justify-between gap-4 py-3 ${indent ? 'pl-6' : ''}`}>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium text-secondary-700 dark:text-neutral-200 ${indent ? 'text-xs' : ''}`}>{label}</p>
      {description && (
        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">{description}</p>
      )}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const MODULE_LABELS = {
  healthChat: 'Health Chat',
  appointments: 'Appointments',
  medicineRequests: 'Medicine Requests',
  inventory: 'Inventory Alerts',
  general: 'General / Announcements',
};

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

/**
 * Staff Settings Page
 */
const StaffSettings = () => {
  const navigate = useNavigate();
  const { settings: savedSettings, updateSettings, DEFAULT_SETTINGS } = useSettings();

  // Local draft state — only committed on save
  const [draft, setDraft] = useState(() => structuredClone(savedSettings));
  const [saved, setSaved] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  // 'back' = user hit browser back; null = user clicked Cancel in save bar
  const pendingActionRef = useRef(null);

  // Sync draft when savedSettings change externally (e.g. another tab)
  useEffect(() => {
    setDraft(structuredClone(savedSettings));
  }, [savedSettings]);

  // Always-current ref for cleanup purposes
  const savedThemeModeRef = useRef(savedSettings.themeMode);
  useEffect(() => { savedThemeModeRef.current = savedSettings.themeMode; }, [savedSettings.themeMode]);

  // Live theme preview — applies draft.themeMode immediately without saving.
  // On unmount (navigating away without saving) the DOM is restored to the saved theme.
  useEffect(() => {
    const applyTheme = (mode) => {
      document.documentElement.classList.toggle(
        'dark',
        mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
      );
    };
    applyTheme(draft.themeMode);
    return () => applyTheme(savedThemeModeRef.current);
  }, [draft.themeMode]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedSettings);
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);

  // ── Intercept browser back button when there are unsaved changes ──
  const guardPushedRef = useRef(false);

  // Push a guard history entry when unsaved changes first appear.
  useEffect(() => {
    if (hasChanges && !guardPushedRef.current) {
      window.history.pushState(null, '', window.location.href);
      guardPushedRef.current = true;
    }
  }, [hasChanges]);

  useEffect(() => {
    const onPopState = () => {
      if (hasChangesRef.current) {
        // Re-push so the URL stays, then show the dialog.
        window.history.pushState(null, '', window.location.href);
        pendingActionRef.current = 'back';
        setShowDiscardDialog(true);
      } else {
        guardPushedRef.current = false;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ── Draft updaters ──
  const set = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const setModuleSound = useCallback((moduleKey, value) => {
    setDraft((prev) => ({
      ...prev,
      soundByModule: { ...prev.soundByModule, [moduleKey]: value },
    }));
    setSaved(false);
  }, []);

  // ── Save / Reset ──
  const handleSave = () => {
    updateSettings(structuredClone(draft));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults = { ...DEFAULT_SETTINGS, soundByModule: { ...DEFAULT_SETTINGS.soundByModule } };
    setDraft(defaults);
    setSaved(false);
  };

  // ── Dialog handlers ──
  const handleDiscard = () => {
    setShowDiscardDialog(false);
    setDraft(structuredClone(savedSettings));
    if (pendingActionRef.current === 'back') {
      guardPushedRef.current = false;
      window.history.go(-2);
    }
    pendingActionRef.current = null;
  };

  const handleApplyAndGo = () => {
    updateSettings(structuredClone(draft));
    setShowDiscardDialog(false);
    if (pendingActionRef.current === 'back') {
      guardPushedRef.current = false;
      window.history.go(-2);
    }
    pendingActionRef.current = null;
  };

  const handleCancelNav = () => {
    setShowDiscardDialog(false);
    pendingActionRef.current = null;
  };

  // Also expose a way for the Cancel button in the save bar to trigger the dialog.
  const handleCancelBar = () => {
    if (hasChanges) {
      pendingActionRef.current = null;
      setShowDiscardDialog(true);
    }
  };

  // Warn on browser tab close / hard refresh
  useEffect(() => {
    const handler = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-secondary-800 dark:text-white">Settings</h2>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
            Customize your staff portal experience. Stored locally on this device.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-200 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {/* ── Sound Settings ── */}
      <Section
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        }
        title="Sound & Audio"
        description="Control notification sounds for the portal"
      >
        <SettingRow
          label="Enable notification sounds"
          description="Play a sound when new notifications arrive"
        >
          <Toggle checked={draft.soundEnabled} onChange={(v) => set('soundEnabled', v)} />
        </SettingRow>

        {/* Volume slider */}
        <SettingRow
          label="Sound volume"
          indent
        >
          <div className="flex items-center gap-2 w-36">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={draft.soundVolume}
              onChange={(e) => set('soundVolume', parseFloat(e.target.value))}
              disabled={!draft.soundEnabled}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-600 accent-primary-500 disabled:opacity-40"
            />
            <span className="text-xs text-secondary-500 dark:text-neutral-400 w-8 text-right tabular-nums">
              {Math.round(draft.soundVolume * 100)}%
            </span>
          </div>
        </SettingRow>

        {/* Per-module toggles */}
        <div className="pt-1">
          <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1 pl-6">
            By Module
          </p>
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <SettingRow key={key} label={label} indent>
              <Toggle
                checked={draft.soundByModule[key]}
                onChange={(v) => setModuleSound(key, v)}
                disabled={!draft.soundEnabled}
              />
            </SettingRow>
          ))}
        </div>
      </Section>

      {/* ── Notification Display ── */}
      <Section
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        title="Notification Display"
        description="Configure how notifications appear in the portal"
      >
        <SettingRow
          label="Show badges"
          description="Display unread count badges on sidebar and header icons"
        >
          <Toggle checked={draft.showBadges} onChange={(v) => set('showBadges', v)} />
        </SettingRow>
        <SettingRow
          label="Show banners"
          description="Show success/error banners for API requests"
        >
          <Toggle checked={draft.showBanners} onChange={(v) => set('showBanners', v)} />
        </SettingRow>
        <SettingRow
          label="Errors only"
          description="Suppress success banners — only show failed requests"
          indent
        >
          <Toggle
            checked={draft.bannerErrorsOnly}
            onChange={(v) => set('bannerErrorsOnly', v)}
            disabled={!draft.showBanners}
          />
        </SettingRow>
        <SettingRow
          label="Compact banners"
          description="Cap the number of banners shown at once"
          indent
        >
          <Toggle
            checked={draft.bannerCompact}
            onChange={(v) => set('bannerCompact', v)}
            disabled={!draft.showBanners}
          />
        </SettingRow>
        <SettingRow
          label="Auto-dismiss banners"
          description="Automatically dismiss banners after a delay"
          indent
        >
          <Toggle
            checked={draft.bannerAutoDismiss}
            onChange={(v) => set('bannerAutoDismiss', v)}
            disabled={!draft.showBanners}
          />
        </SettingRow>
        <SettingRow
          label="Banner dismiss delay"
          description="Seconds before a banner auto-dismisses"
          indent
        >
          <div className="flex items-center gap-2">
            <select
              value={draft.bannerDismissDelay}
              onChange={(e) => set('bannerDismissDelay', parseInt(e.target.value, 10))}
              disabled={!draft.showBanners || !draft.bannerAutoDismiss}
              className="text-sm px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 disabled:opacity-40"
            >
              {[3, 5, 8, 10, 15].map((s) => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
          </div>
        </SettingRow>
      </Section>

      {/* ── Security ── */}
      <Section
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
        title="Security"
        description="Manage two-factor authentication for your account"
      >
        <TotpSettings />
        <ChangePasswordSettings />
      </Section>

      {/* ── Appearance ── */}
      <Section
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        }
        title="Appearance"
        description="Adjust the look and feel of the portal"
      >
        {/* Theme */}
        <SettingRow
          label="Color theme"
          description="Choose light, dark, or follow your system preference"
        >
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden">
            {[
              { value: 'light', label: 'Light', icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )},
              { value: 'dark', label: 'Dark', icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )},
              { value: 'system', label: 'System', icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )},
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('themeMode', opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  draft.themeMode === opt.value
                    ? 'bg-primary-500 text-white'
                    : 'text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          label="Font size"
          description="Adjust the base font size across the portal"
        >
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden">
            {FONT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('fontSize', opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  draft.fontSize === opt.value
                    ? 'bg-primary-500 text-white'
                    : 'text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          label="Minimized sidebar"
          description="Keep the sidebar collapsed by default"
        >
          <Toggle checked={draft.compactSidebar} onChange={(v) => set('compactSidebar', v)} />
        </SettingRow>
      </Section>

      {/* ── Save Bar ── */}
      <div
        className={`sticky bottom-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-md rounded-xl border transition-all duration-200 ${
          hasChanges
            ? 'border-primary-300 dark:border-primary-700 shadow-lg'
            : 'border-neutral-200 dark:border-neutral-700'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <span className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
                <p className="text-xs font-medium text-warning-600 dark:text-warning-400">You have unsaved changes</p>
              </>
            )}
            {saved && !hasChanges && (
              <>
                <svg className="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs font-medium text-success-600 dark:text-success-400">Settings saved</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleCancelBar}
                className="px-4 py-2 text-sm font-medium rounded-lg text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                hasChanges
                  ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Navigation guard dialog */}
      {showDiscardDialog && (
        <DiscardDialog
          onCancel={handleCancelNav}
          onDiscard={handleDiscard}
          onApply={handleApplyAndGo}
        />
      )}
    </div>
  );
};

export default StaffSettings;
