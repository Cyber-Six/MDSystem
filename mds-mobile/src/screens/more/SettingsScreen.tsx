/**
 * Settings Screen — Display preferences & notification settings
 *
 * Uses SettingsContext for server-synced preferences.
 * Notification channel toggles (email fallback, per-module) mirror
 * the web patient-settings UI adapted for React Native.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { useSettings, NOTIFICATION_MODULE_KEYS, type MobileSettings } from '../../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';

// ── Module labels shown in the per-module section ────────────────────────────
// Patients don't interact with inventory or roleManagement, so those are excluded.
const CHANNEL_MODULE_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  healthChat: 'Health Chat',
  medicineRequests: 'Medicine Requests',
  documents: 'Documents',
  emr: 'EMR Updates',
  general: 'General / Announcements',
};

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  web: 'Push notifications on this device',
  email: 'Always send email for every notification',
  emailFallback: 'Send email as backup when you\'re offline',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  isDark,
  showBorder = false,
}: {
  icon?: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isDark: boolean;
  showBorder?: boolean;
}) {
  return (
    <View style={[
      styles.settingRow,
      showBorder && styles.settingRowBorder,
      showBorder && { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100] },
    ]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
          {icon ? <Ionicons name={icon as any} size={15} color={isDark ? colors.neutral[300] : colors.secondary[600]} /> : null}
          {icon ? ' ' : ''}{label}
        </Text>
        {description ? (
          <Text style={[styles.settingDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
        thumbColor={value ? colors.primary[500] : colors.neutral[100]}
      />
    </View>
  );
}

export const SettingsScreen: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [expandedModules, setExpandedModules] = useState(false);

  // Generic updater for top-level boolean keys
  const setBool = useCallback((key: keyof MobileSettings, value: boolean) => {
    updateSettings((prev) => ({ ...prev, [key]: value }));
  }, [updateSettings]);

  // Global channel toggle
  const setGlobalChannel = useCallback((channel: 'web' | 'email' | 'emailFallback', value: boolean) => {
    updateSettings((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: value },
    }));
  }, [updateSettings]);

  // Per-module channel toggle
  const setModuleChannel = useCallback((moduleKey: string, channel: string, value: boolean) => {
    updateSettings((prev) => ({
      ...prev,
      moduleChannels: {
        ...prev.moduleChannels,
        [moduleKey]: { ...(prev.moduleChannels as any)[moduleKey], [channel]: value },
      },
    }));
  }, [updateSettings]);

  const allDisabled = !settings.channels.web && !settings.channels.email && !settings.channels.emailFallback;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Appearance ──────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Appearance
          </Text>
          <SettingRow
            icon={isDark ? 'moon' : 'sunny'}
            label="Dark Mode"
            description={isDark ? 'Currently using dark theme' : 'Currently using light theme'}
            value={isDark}
            onValueChange={toggleTheme}
            isDark={isDark}
          />
        </View>

        {/* ── General Notification Settings ────────────────────────── */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Notifications
          </Text>
          <SettingRow
            icon="notifications"
            label="In-App Banners"
            description="Show banners for appointments, medicine, and chat events"
            value={settings.showBanners}
            onValueChange={(v) => setBool('showBanners', v)}
            isDark={isDark}
          />
          <SettingRow
            icon="volume-high"
            label="Notification Sound"
            description="Play a sound when push notifications arrive"
            value={settings.soundEnabled}
            onValueChange={(v) => setBool('soundEnabled', v)}
            isDark={isDark}
            showBorder
          />
        </View>

        {/* ── Notification Channels ───────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Notification Channels
          </Text>

          {allDisabled && (
            <View style={[styles.warningBanner, { backgroundColor: isDark ? '#4a2020' : '#FEF2F2' }]}>
              <Ionicons name="warning" size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
              <Text style={[styles.warningText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                All notification channels are disabled. You won't receive any notifications.
              </Text>
            </View>
          )}

          <SettingRow
            icon="globe-outline"
            label="Push Notifications"
            description={CHANNEL_DESCRIPTIONS.web}
            value={settings.channels.web}
            onValueChange={(v) => setGlobalChannel('web', v)}
            isDark={isDark}
          />
          <SettingRow
            icon="mail-outline"
            label="Email (Always)"
            description={CHANNEL_DESCRIPTIONS.email}
            value={settings.channels.email}
            onValueChange={(v) => setGlobalChannel('email', v)}
            isDark={isDark}
            showBorder
          />
          <SettingRow
            icon="mail-unread-outline"
            label="Email Fallback"
            description={CHANNEL_DESCRIPTIONS.emailFallback}
            value={settings.channels.emailFallback}
            onValueChange={(v) => setGlobalChannel('emailFallback', v)}
            isDark={isDark}
            showBorder
          />
        </View>

        {/* ── Per-Module Overrides ─────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <TouchableOpacity
            onPress={() => setExpandedModules(!expandedModules)}
            style={styles.expandHeader}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], marginBottom: 0 }]}>
              Per-Module Overrides
            </Text>
            <Ionicons
              name={expandedModules ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? colors.neutral[400] : colors.neutral[500]}
            />
          </TouchableOpacity>
          <Text style={[styles.settingDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500], marginTop: 4, marginBottom: expandedModules ? 12 : 0 }]}>
            Override global channel settings for specific modules
          </Text>

          {expandedModules && Object.entries(CHANNEL_MODULE_LABELS).map(([moduleKey, moduleLabel]) => {
            const mc = (settings.moduleChannels as any)[moduleKey] || settings.channels;
            return (
              <View key={moduleKey} style={[styles.moduleSection, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
                <Text style={[styles.moduleTitle, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>
                  {moduleLabel}
                </Text>
                <View style={styles.moduleToggles}>
                  <View style={styles.miniToggle}>
                    <Text style={[styles.miniLabel, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Push</Text>
                    <Switch
                      value={mc.web}
                      onValueChange={(v) => setModuleChannel(moduleKey, 'web', v)}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
                      thumbColor={mc.web ? colors.primary[500] : colors.neutral[100]}
                      style={styles.miniSwitch}
                    />
                  </View>
                  <View style={styles.miniToggle}>
                    <Text style={[styles.miniLabel, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Email</Text>
                    <Switch
                      value={mc.email}
                      onValueChange={(v) => setModuleChannel(moduleKey, 'email', v)}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
                      thumbColor={mc.email ? colors.primary[500] : colors.neutral[100]}
                      style={styles.miniSwitch}
                    />
                  </View>
                  <View style={styles.miniToggle}>
                    <Text style={[styles.miniLabel, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Fallback</Text>
                    <Switch
                      value={mc.emailFallback}
                      onValueChange={(v) => setModuleChannel(moduleKey, 'emailFallback', v)}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
                      thumbColor={mc.emailFallback ? colors.primary[500] : colors.neutral[100]}
                      style={styles.miniSwitch}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── About ───────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            About
          </Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
              Version
            </Text>
            <Text style={[styles.aboutValue, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              {process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'}
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
              Platform
            </Text>
            <Text style={[styles.aboutValue, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              MDSystem Mobile ({Platform.OS})
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 12,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingDesc: { fontSize: 12, marginTop: 2 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '500' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 13, fontWeight: '500' },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 4,
  },
  moduleTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  moduleToggles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniToggle: { alignItems: 'center', flex: 1 },
  miniLabel: { fontSize: 11, marginBottom: 4 },
  miniSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
});

export default SettingsScreen;

