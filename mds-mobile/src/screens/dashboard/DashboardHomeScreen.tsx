/**
 * Dashboard Home Screen - Main screen after authentication
 * Mirrors mds-patient dashboard-home.jsx
 *
 * Fetches real data: profile name, announcements, appointment status, health chat status.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { getPatientProfile, clearProfileCache } from '../../services/profile-service';
import { fetchActiveAnnouncements, Announcement } from '../../services/announcement-service';
import { getAppointmentStatus, ACTIVE_STATUSES } from '../../services/appointment-service';
import { getCurrentActiveTicket } from '../../services/health-chat-service';
import { checkInitialRecordStatus, type RecordStatus } from '../../services/emr-service';

interface DashboardHomeScreenProps {
  navigation: any;
}

const StatCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  isDark: boolean;
}> = ({ icon, label, value, color, isDark }) => (
  <View
    style={[
      styles.statCard,
      { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
    ]}
  >
    <View style={[styles.statIcon, { backgroundColor: color }]}>
      <Text style={styles.statIconText}>{icon}</Text>
    </View>
    <Text
      style={[
        styles.statValue,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] },
      ]}
    >
      {value}
    </Text>
    <Text
      style={[
        styles.statLabel,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] },
      ]}
    >
      {label}
    </Text>
  </View>
);

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.quickAction, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.quickActionIcon}>{icon}</Text>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({
  navigation,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Real data state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState<RecordStatus | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Auto-rotate announcement carousel
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [profile, annList, apptResult, chatResult, recordResult] = await Promise.allSettled([
        getPatientProfile(),
        fetchActiveAnnouncements(),
        getAppointmentStatus(),
        getCurrentActiveTicket(),
        checkInitialRecordStatus(),
      ]);

      if (profile.status === 'fulfilled' && profile.value?.firstName) {
        setUserName(profile.value.firstName);
      } else if (profile.status === 'fulfilled' && profile.value?.name) {
        setUserName(profile.value.name.split(' ')[0]);
      }

      if (annList.status === 'fulfilled') {
        setAnnouncements(annList.value || []);
      }

      if (apptResult.status === 'fulfilled' && apptResult.value) {
        const status = apptResult.value.status;
        setAppointmentStatus(ACTIVE_STATUSES.includes(status) ? status : null);
      }

      if (chatResult.status === 'fulfilled' && chatResult.value) {
        setChatStatus(chatResult.value.status);
      }

      if (recordResult.status === 'fulfilled' && recordResult.value) {
        setRecordStatus(recordResult.value);
      }
    } catch {
      // Silently fail — dashboard still works without data
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto-rotate announcements
  useEffect(() => {
    if (announcements.length <= 1) return;
    carouselTimer.current = setInterval(() => {
      setAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [announcements.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearProfileCache();
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
        },
      ]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.greeting,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              Welcome back
            </Text>
            <Text
              style={[
                styles.userName,
                {
                  color: isDark ? colors.neutral[100] : colors.secondary[900],
                },
              ]}
            >
              {userName || 'Patient'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeToggle,
              {
                backgroundColor: isDark
                  ? colors.neutral[800]
                  : colors.neutral[200],
              },
            ]}
          >
            <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="📅"
            label="Appointment"
            value={appointmentStatus || '—'}
            color={colors.accent[500]}
            isDark={isDark}
          />
          <StatCard
            icon="💬"
            label="Health Chat"
            value={chatStatus || '—'}
            color={colors.primary[500]}
            isDark={isDark}
          />
          <StatCard
            icon="📋"
            label="Records"
            value={recordStatus?.needsInitialRecord ? 'Required' : recordStatus?.status || 'Complete'}
            color={colors.success[500]}
            isDark={isDark}
          />
        </View>

        {/* Initial Record Required Banner */}
        {recordStatus?.needsInitialRecord && (
          <TouchableOpacity
            style={[
              styles.recordBanner,
              {
                backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
              },
            ]}
            onPress={() => navigation.navigate('More', {
              screen: 'InitialRecordForm',
              params: { isRevision: recordStatus?.status === 'revision_requested' },
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.recordBannerIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.recordBannerTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                {recordStatus?.status === 'revision_requested' ? 'Revision Requested' : 'Medical Record Required'}
              </Text>
              <Text style={[styles.recordBannerDesc, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                {recordStatus?.status === 'revision_requested'
                  ? (recordStatus?.notes || 'Please revise your medical record.')
                  : 'Complete your initial medical record to access all features.'}
              </Text>
            </View>
            <Text style={{ color: colors.primary[500], fontSize: 20, fontWeight: '600' }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Announcements Carousel */}
        {announcements.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                ]}
              >
                Announcements
              </Text>
              <Text
                style={[
                  styles.carouselCounter,
                  { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                ]}
              >
                {announcementIndex + 1}/{announcements.length}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.announcementCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(241,197,38,0.06)'
                    : 'rgba(241,197,38,0.08)',
                  borderColor: isDark
                    ? 'rgba(241,197,38,0.15)'
                    : 'rgba(241,197,38,0.2)',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.announcementIcon}>📢</Text>
              <View style={styles.announcementTextContainer}>
                <Text
                  style={[
                    styles.announcementTitle,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                  numberOfLines={1}
                >
                  {announcements[announcementIndex]?.title}
                </Text>
                <Text
                  style={[
                    styles.announcementDesc,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                  numberOfLines={2}
                >
                  {announcements[announcementIndex]?.description}
                </Text>
              </View>
            </TouchableOpacity>
            {/* Dot indicators */}
            {announcements.length > 1 && (
              <View style={styles.dotRow}>
                {announcements.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setAnnouncementIndex(i)}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i === announcementIndex
                            ? colors.primary[500]
                            : isDark
                              ? colors.neutral[700]
                              : colors.neutral[300],
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color: isDark ? colors.neutral[100] : colors.secondary[900],
              },
            ]}
          >
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              icon="📅"
              label="Book Appointment"
              color={colors.accent[500]}
              onPress={() => navigation.navigate('Appointments')}
            />
            <QuickActionButton
              icon="💬"
              label="Health Chat"
              color={colors.primary[500]}
              onPress={() => navigation.navigate('HealthChat')}
            />
            <QuickActionButton
              icon="💊"
              label="Medicine Request"
              color={colors.success[500]}
              onPress={() => navigation.navigate('Medicine')}
            />
            <QuickActionButton
              icon="👤"
              label="My Profile"
              color={colors.secondary[600]}
              onPress={() =>
                navigation.navigate('More', { screen: 'Profile' })
              }
            />
          </View>
        </View>

        {/* Active Status */}
        {(appointmentStatus || chatStatus) && (
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
              Active
            </Text>

            {appointmentStatus && (
              <TouchableOpacity
                style={[
                  styles.statusRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(59,130,246,0.08)'
                      : 'rgba(59,130,246,0.06)',
                    borderColor: isDark
                      ? 'rgba(59,130,246,0.2)'
                      : 'rgba(59,130,246,0.15)',
                  },
                ]}
                onPress={() => navigation.navigate('Appointments')}
                activeOpacity={0.7}
              >
                <Text style={styles.statusRowIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.statusRowLabel,
                      { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                    ]}
                  >
                    Appointment
                  </Text>
                  <Text
                    style={[
                      styles.statusRowValue,
                      { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                    ]}
                  >
                    Status: {appointmentStatus}
                  </Text>
                </View>
                <Text
                  style={{ color: isDark ? colors.neutral[600] : colors.neutral[300], fontSize: 18 }}
                >
                  ›
                </Text>
              </TouchableOpacity>
            )}

            {chatStatus && (
              <TouchableOpacity
                style={[
                  styles.statusRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(241,197,38,0.06)'
                      : 'rgba(241,197,38,0.06)',
                    borderColor: isDark
                      ? 'rgba(241,197,38,0.15)'
                      : 'rgba(241,197,38,0.12)',
                    marginTop: appointmentStatus ? 8 : 0,
                  },
                ]}
                onPress={() => navigation.navigate('HealthChat')}
                activeOpacity={0.7}
              >
                <Text style={styles.statusRowIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.statusRowLabel,
                      { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                    ]}
                  >
                    Health Chat
                  </Text>
                  <Text
                    style={[
                      styles.statusRowValue,
                      { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                    ]}
                  >
                    Status: {chatStatus}
                  </Text>
                </View>
                <Text
                  style={{ color: isDark ? colors.neutral[600] : colors.neutral[300], fontSize: 18 }}
                >
                  ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* No activity state */}
        {!appointmentStatus && !chatStatus && !isDataLoading && (
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
              Recent Activity
            </Text>
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                },
              ]}
            >
              <Text style={styles.emptyIcon}>📭</Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: isDark ? colors.neutral[400] : colors.neutral[600] },
                ]}
              >
                No recent activity
              </Text>
            </View>
          </View>
        )}

        {/* App Info */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              {
                color: isDark ? colors.neutral[500] : colors.neutral[400],
              },
            ]}
          >
            MDSystem Mobile v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: { fontSize: 22 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: { fontSize: 20 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  quickActionIcon: { fontSize: 28, marginBottom: 8 },
  quickActionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14 },
  // Announcements
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  carouselCounter: { fontSize: 12, fontWeight: '500' },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  announcementIcon: { fontSize: 22 },
  announcementTextContainer: { flex: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  announcementDesc: { fontSize: 12, lineHeight: 17 },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  // Status rows
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  statusRowIcon: { fontSize: 22 },
  statusRowLabel: { fontSize: 14, fontWeight: '600' },
  statusRowValue: { fontSize: 12, marginTop: 2 },
  recordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  recordBannerIcon: { fontSize: 28 },
  recordBannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  recordBannerDesc: { fontSize: 12, lineHeight: 16 },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: { fontSize: 12 },
});

export default DashboardHomeScreen;
