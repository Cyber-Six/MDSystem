/**
 * Profile Screen
 * Mirrors mds-patient profile-modal.jsx
 * Fetches real profile data from backend via profile-service
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { useTheme, colors } from '../../context/ThemeContext';
import { getPatientProfile, PatientProfile } from '../../services/profile-service';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ProfileField: React.FC<{
  icon: IoniconName;
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
    <View style={[styles.fieldIcon, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
      <Ionicons name={icon} size={18} color={isDark ? colors.neutral[300] : colors.secondary[600]} />
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
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPatientProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const displayName = profile?.name || profile?.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Patient';
  const identity = profile?.identity || 'Patient';
  const roleLabel = identity;

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
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
            {roleLabel}
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

          <ProfileField icon="mail" label="Email" value={profile?.email || '—'} isDark={isDark} />
          <ProfileField icon="call" label="Contact Number" value={profile?.contactNumber || '—'} isDark={isDark} />
          <ProfileField
            icon="alert-circle"
            label="Emergency Contact 1"
            value={profile?.firstEmergencyContactNumber || '—'}
            isDark={isDark}
          />
          <ProfileField
            icon="alert-circle"
            label="Emergency Contact 2"
            value={profile?.secondEmergencyContactNumber || '—'}
            isDark={isDark}
          />
          <ProfileField icon="card" label="Identifier" value={profile?.identifier || '—'} isDark={isDark} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
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
  role: { fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 },
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
