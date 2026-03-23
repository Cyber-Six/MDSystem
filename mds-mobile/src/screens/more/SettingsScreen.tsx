/**
 * Settings Screen — Display preferences & dark mode toggle
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

export const SettingsScreen: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

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
                {isDark ? '🌙' : '☀️'} Dark Mode
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
              1.0.0
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
              Platform
            </Text>
            <Text style={[styles.aboutValue, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              MDSystem Mobile
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
