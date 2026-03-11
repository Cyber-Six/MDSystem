/**
 * Profile Screen
 * Mirrors mds-patient profile-modal.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { TokenStorage } from '../../core';

const decodeJWT = (token: string) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const ProfileField: React.FC<{
  icon: string;
  label: string;
  value: string;
  isDark: boolean;
}> = ({ icon, label, value, isDark }) => (
  <View
    style={[
      styles.field,
      {
        borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
      },
    ]}
  >
    <View style={styles.fieldIcon}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text
        style={[
          styles.fieldLabel,
          { color: isDark ? colors.neutral[400] : colors.neutral[500] },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.fieldValue,
          { color: isDark ? colors.neutral[100] : colors.secondary[900] },
        ]}
      >
        {value}
      </Text>
    </View>
  </View>
);

export const ProfileScreen: React.FC = () => {
  const { isDark } = useTheme();
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const token = await TokenStorage.getAccessToken();
      if (token) {
        const decoded = decodeJWT(token);
        setUserEmail(decoded?.email || '');
      }
    };
    loadUser();
  }, []);

  const displayName = userEmail
    ? userEmail.split('@')[0].replace(/[._]/g, ' ')
    : 'Patient';

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary[500] },
            ]}
          >
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            style={[
              styles.name,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            {displayName}
          </Text>
          <Text
            style={[
              styles.role,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            Patient
          </Text>
        </View>

        {/* Info Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            Personal Information
          </Text>

          <ProfileField
            icon="📧"
            label="Email"
            value={userEmail || '—'}
            isDark={isDark}
          />
          <ProfileField
            icon="📞"
            label="Contact Number"
            value="—"
            isDark={isDark}
          />
          <ProfileField
            icon="🆘"
            label="Emergency Contact"
            value="—"
            isDark={isDark}
          />
          <ProfileField
            icon="🪪"
            label="Student ID"
            value="—"
            isDark={isDark}
          />
        </View>

        <Text
          style={[
            styles.footnote,
            { color: isDark ? colors.neutral[500] : colors.neutral[400] },
          ]}
        >
          Contact the admin to update your profile information.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  name: { fontSize: 22, fontWeight: 'bold' },
  role: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: '500' },
  footnote: { fontSize: 13, textAlign: 'center', marginTop: 8 },
});

export default ProfileScreen;
