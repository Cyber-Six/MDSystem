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
import { UserAvatar } from '../../components/common/UserAvatar';
import { formatYearLevel } from '../../utils/formatYearLevel';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
  const isStudent = profile?.profileType === 'StudentProfile';
  const isEmployee = profile?.profileType === 'EmployeeProfile';
  const identityLabel = isStudent ? 'Student' : isEmployee ? 'Employee' : (profile?.identity || null);
  const identifierLabel = isEmployee ? 'Employee ID' : 'Student ID';
  const yearLabel = isStudent ? formatYearLevel(profile?.yearLevel) : null;

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
          <View style={{ marginBottom: 12 }}>
            <UserAvatar name={displayName} size="lg" />
          </View>
          <Text
            style={[
              styles.name,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            {displayName}
          </Text>
          {identityLabel && (
            <Text
              style={[
                styles.role,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              {identityLabel}
            </Text>
          )}
          {/* Student: year level + program pills */}
          {isStudent && (yearLabel || profile?.program) && (
            <View style={styles.pillRow}>
              {yearLabel ? (
                <View style={[styles.pill, { backgroundColor: isDark ? colors.primary[900] + '4d' : '#eff6ff', borderColor: isDark ? colors.primary[700] + '80' : '#bfdbfe' }]}>
                  <Text style={[styles.pillText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>{yearLabel}</Text>
                </View>
              ) : null}
              {profile?.program ? (
                <View style={[styles.pill, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100], borderColor: isDark ? colors.neutral[600] : colors.neutral[300], maxWidth: 200 }]}>
                  <Text style={[styles.pillText, { color: isDark ? colors.neutral[200] : colors.secondary[700] }]} numberOfLines={1}>{profile.program}</Text>
                </View>
              ) : null}
            </View>
          )}
          {/* Employee: department pill */}
          {isEmployee && profile?.department ? (
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: isDark ? '#78350f26' : '#fffbeb', borderColor: isDark ? '#92400e80' : '#fde68a', maxWidth: 220 }]}>
                <Text style={[styles.pillText, { color: isDark ? '#fcd34d' : '#92400e' }]} numberOfLines={1}>{profile.department}</Text>
              </View>
            </View>
          ) : null}
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
          <ProfileField
            icon="card"
            label={identifierLabel}
            value={profile?.identifier || '—'}
            isDark={isDark}
          />
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
  name: { fontSize: 22, fontWeight: 'bold' },
  role: { fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '500' },
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
