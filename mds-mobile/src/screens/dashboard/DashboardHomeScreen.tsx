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
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { getPatientProfile, clearProfileCache } from '../../services/profile-service';
import { fetchActiveAnnouncements, Announcement } from '../../services/announcement-service';
import { getAppointmentStatus, ACTIVE_STATUSES } from '../../services/appointment-service';
import { getCurrentActiveTicket } from '../../services/health-chat-service';
import { useRecordStatus } from '../../context/RecordStatusContext';
import type { RecordStatus } from '../../services/emr-service';
import PendingRecordGate from '../../components/PendingRecordGate';
import { toggleAppDrawer } from '../../navigation/drawer-utils';

interface DashboardHomeScreenProps {
  navigation: any;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const StatCard: React.FC<{
  icon: IoniconName;
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
      <Ionicons name={icon} size={20} color="#FFFFFF" />
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
  iconLib?: 'Ionicons' | 'MCI';
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, iconLib = 'Ionicons', label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.quickAction, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    {iconLib === 'MCI' ? (
      <MaterialCommunityIcons name={icon as any} size={26} color="#FFFFFF" style={styles.quickActionIcon} />
    ) : (
      <Ionicons name={icon as IoniconName} size={26} color="#FFFFFF" style={styles.quickActionIcon} />
    )}
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({
  navigation,
}) => {
  const { isDark } = useTheme();
  const { recordStatus } = useRecordStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Real data state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Auto-rotate announcement carousel
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [profile, annList, apptResult, chatResult] = await Promise.allSettled([
        getPatientProfile(),
        fetchActiveAnnouncements(),
        getAppointmentStatus(),
        getCurrentActiveTicket(),
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
    <PendingRecordGate>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
            progressBackgroundColor={colors.secondary[900]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.menuButton,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
            onPress={() => toggleAppDrawer(navigation)}
            accessibilityRole="button"
            accessibilityLabel="Open sidebar"
          >
            <Ionicons
              name="menu"
              size={22}
              color={isDark ? colors.neutral[100] : colors.secondary[900]}
            />
          </TouchableOpacity>
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
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="calendar"
            label="Appointment"
            value={appointmentStatus || '—'}
            color={colors.accent[500]}
            isDark={isDark}
          />
          <StatCard
            icon="chatbubbles"
            label="Health Chat"
            value={chatStatus || '—'}
            color={colors.primary[500]}
            isDark={isDark}
          />
          <StatCard
            icon="clipboard"
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
              params: { isRevision: recordStatus?.status === 'Revision' },
            })}
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard" size={22} color={colors.primary[500]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recordBannerTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                {recordStatus?.status === 'Revision' ? 'Revision Requested' : 'Medical Record Required'}
              </Text>
              <Text style={[styles.recordBannerDesc, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                {recordStatus?.status === 'Revision'
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
              <Ionicons name="megaphone" size={22} color={colors.primary[500]} />
              <View style={styles.announcementTextContainer}>
                <Text
                  style={[
                    styles.announcementTitle,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                  numberOfLines={1}
                >
                  {announcements[announcementIndex]?.label}
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
              icon="calendar"
              label="Book Appointment"
              color={colors.accent[500]}
              onPress={() => navigation.navigate('Appointments')}
            />
            <QuickActionButton
              icon="chatbubbles"
              label="Health Chat"
              color={colors.primary[500]}
              onPress={() => navigation.navigate('HealthChat')}
            />
            <QuickActionButton
              icon="pill"
              iconLib="MCI"
              label="Medicine Request"
              color={colors.success[500]}
              onPress={() => navigation.navigate('Medicine')}
            />
            <QuickActionButton
              icon="person"
              label="My Profile"
              color={colors.secondary[600]}
              onPress={() =>
                navigation.navigate('More', { screen: 'Profile' })
              }
            />
          </View>
        </View>

        {/* Record Update Options — only when initial record is approved */}
        {!recordStatus?.needsInitialRecord && (
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
              Update Records
            </Text>
            <View style={styles.updateRow}>
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => navigation.navigate('More', {
                  screen: 'InitialRecordForm',
                  params: { isUpdate: true, recordType: 'medical' },
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="medkit" size={22} color="#FFFFFF" style={styles.updateIcon} />
                <Text style={styles.updateLabel}>Medical</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: '#22C55E' }]}
                onPress={() => navigation.navigate('More', {
                  screen: 'InitialRecordForm',
                  params: { isUpdate: true, recordType: 'dental' },
                })}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="tooth" size={22} color="#FFFFFF" style={styles.updateIcon} />
                <Text style={styles.updateLabel}>Dental</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => navigation.navigate('More', {
                  screen: 'InitialRecordForm',
                  params: { isUpdate: true, recordType: 'both' },
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="clipboard" size={22} color="#FFFFFF" style={styles.updateIcon} />
                <Text style={styles.updateLabel}>Both</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                <Ionicons name="calendar" size={22} color={colors.accent[500]} />
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
                <Ionicons name="chatbubbles" size={22} color={colors.primary[500]} />
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
              <Ionicons name="mail-open-outline" size={36} color={isDark ? colors.neutral[600] : colors.neutral[300]} style={{ marginBottom: 8 }} />
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
            MDSystem Mobile {process.env.EXPO_PUBLIC_APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
    </PendingRecordGate>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  statValue: { fontSize: 14, fontWeight: 'bold' },
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
  quickActionIcon: { marginBottom: 8 },
  quickActionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  // Record update row
  updateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  updateButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateIcon: { marginBottom: 4 },
  updateLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
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
  announcementIcon: { marginRight: 2 },
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
