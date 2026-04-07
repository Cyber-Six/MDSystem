/**
 * Settings Screen — Display preferences & notification settings
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const SETTINGS_KEY = 'mds_mobile_settings';

interface AppSettings {
  soundEnabled: boolean;
  showBanners: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  showBanners: true,
};

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
        showBanners: typeof parsed.showBanners === 'boolean' ? parsed.showBanners : DEFAULT_SETTINGS.showBanners,
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

async function saveSettings(settings: AppSettings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export const SettingsScreen: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Appearance */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            Appearance
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={15} color={isDark ? colors.primary[400] : colors.primary[500]} /> Dark Mode
              </Text>
              <Text style={[styles.settingDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                {isDark ? 'Currently using dark theme' : 'Currently using light theme'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
              thumbColor={isDark ? colors.primary[500] : colors.neutral[100]}
            />
          </View>
        </View>

        {/* Notifications */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            Notifications
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                <Ionicons name="notifications" size={15} color={isDark ? colors.neutral[300] : colors.secondary[600]} /> In-App Banners
              </Text>
              <Text style={[styles.settingDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                Show banners for appointments, medicine, and chat events
              </Text>
            </View>
            <Switch
              value={settings.showBanners}
              onValueChange={(v) => updateSetting('showBanners', v)}
              trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
              thumbColor={settings.showBanners ? colors.primary[500] : colors.neutral[100]}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowBorder, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                <Ionicons name="volume-high" size={15} color={isDark ? colors.neutral[300] : colors.secondary[600]} /> Notification Sound
              </Text>
              <Text style={[styles.settingDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                Play a sound when push notifications arrive
              </Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(v) => updateSetting('soundEnabled', v)}
              trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
              thumbColor={settings.soundEnabled ? colors.primary[500] : colors.neutral[100]}
            />
          </View>
        </View>

        {/* About */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
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
});

export default SettingsScreen;

