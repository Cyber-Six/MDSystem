import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { getPatientProfile, clearProfileCache } from '../../services/profile-service';
import { fetchActiveAnnouncements, Announcement } from '../../services/announcement-service';
import { getAppointmentStatus, ACTIVE_STATUSES } from '../../services/appointment-service';
import { getCurrentActiveTicket } from '../../services/health-chat-service';
import { getMedicineStatus } from '../../services/medicine-service';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { useHealthChatBadge } from '../../context/HealthChatNotificationProvider';
import { toggleAppDrawer } from '../../navigation/drawer-utils';
import AnnouncementDetailModal from '../../components/announcements/AnnouncementDetailModal';
import SecureAnnouncementImage from '../../components/announcements/SecureAnnouncementImage';
import { TopBar } from '../../components/layout/TopBar';
import { SectionLabel } from '../../components/common/SectionLabel';
import { StatTile } from '../../components/common/StatTile';
import { ActivityCard } from '../../components/common/ActivityCard';
import { EmptyState } from '../../components/common/EmptyState';
import { AnnouncementCarousel, AnnouncementCarouselItem } from '../../components/common/AnnouncementCarousel';

interface DashboardHomeScreenProps {
  navigation: any;
}

type ActivityItem = {
  key: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconBg: string;
  title: string;
  subtitle: string;
  timeAgo?: string;
  badge?: {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  };
  onPress: () => void;
};

const CalendarIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="calendar-outline" size={size} color={color} />
);

const ChatIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
);

const RecordIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="clipboard-outline" size={size} color={color} />
);

const MedicineIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <MaterialCommunityIcons name="pill" size={size} color={color} />
);

const AnnouncementIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="megaphone-outline" size={size} color={color} />
);

const greetingByTime = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const countPendingMedicineRequests = (requests: Array<{ status?: string }>) => {
  return requests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length;
};

const normalizeSentenceCase = (value: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Announcement';

  if (normalized === normalized.toUpperCase()) {
    const lower = normalized.toLowerCase();
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

export const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { recordStatus, isRecordLoading } = useRecordStatus();
  const { badgeCount } = useHealthChatBadge();
  const shouldSkipProtectedRequests = isRecordLoading
    || !recordStatus
    || (recordStatus.credentialStatus == null && recordStatus.status == null)
    || Boolean(recordStatus.needsInitialRecord)
    || recordStatus?.credentialStatus === 'Inactive'
    || recordStatus?.credentialStatus === 'Unverified';

  const [refreshing, setRefreshing] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [userName, setUserName] = useState<string>('Patient');
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [medicinePendingCount, setMedicinePendingCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const firstName = useMemo(() => {
    const trimmed = String(userName || '').trim();
    if (!trimmed) return 'Patient';
    return trimmed.split(/\s+/)[0] || 'Patient';
  }, [userName]);

  const navigateToSecondaryScreen = useCallback((screen: string) => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('MoreStack', { screen });
      return;
    }
    navigation.navigate('MoreStack', { screen });
  }, [navigation]);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsDataLoading(true);

      const [profile, annList, appointment, activeTicket, medicine] = await Promise.allSettled([
        getPatientProfile(),
        fetchActiveAnnouncements(),
        shouldSkipProtectedRequests ? Promise.resolve(null) : getAppointmentStatus(),
        shouldSkipProtectedRequests ? Promise.resolve(null) : getCurrentActiveTicket(),
        shouldSkipProtectedRequests ? Promise.resolve(null) : getMedicineStatus(),
      ]);

      if (profile.status === 'fulfilled') {
        const profileName = profile.value?.name || profile.value?.firstName || 'Patient';
        setUserName(profileName);
      }

      if (annList.status === 'fulfilled') {
        setAnnouncements(annList.value || []);
      } else {
        setAnnouncements([]);
      }

      if (shouldSkipProtectedRequests) {
        setAppointmentStatus(null);
      } else if (appointment.status === 'fulfilled' && appointment.value) {
        const status = appointment.value.status;
        setAppointmentStatus(ACTIVE_STATUSES.includes(status) ? status : null);
      } else {
        setAppointmentStatus(null);
      }

      if (shouldSkipProtectedRequests) {
        setChatStatus(null);
      } else if (activeTicket.status === 'fulfilled' && activeTicket.value) {
        setChatStatus(activeTicket.value.status || null);
      } else {
        setChatStatus(null);
      }

      if (shouldSkipProtectedRequests) {
        setMedicinePendingCount(0);
      } else if (medicine.status === 'fulfilled') {
        setMedicinePendingCount(countPendingMedicineRequests(medicine.value || []));
      } else {
        setMedicinePendingCount(0);
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [shouldSkipProtectedRequests]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearProfileCache();
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  const normalizedRecordStatus = String(recordStatus?.status || '').toLowerCase();
  const isAwaitingInitialApproval = Boolean(recordStatus?.needsInitialRecord)
    && (
      normalizedRecordStatus === 'pending'
      || normalizedRecordStatus === 'revisionsubmitted'
      || normalizedRecordStatus === 'underreview'
      || normalizedRecordStatus === 'in review'
    );

  const appointmentCount = appointmentStatus ? 1 : 0;
  const messageCount = badgeCount > 0 ? badgeCount : chatStatus ? 1 : 0;
  const recordCount = recordStatus?.needsInitialRecord ? 0 : 1;

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    if (chatStatus || messageCount > 0) {
      items.push({
        key: 'chat',
        icon: ChatIcon,
        iconBg: 'bg-primary-500',
        title: 'Health chat update',
        subtitle: chatStatus
          ? `Conversation status: ${chatStatus}`
          : `${messageCount} unread message${messageCount > 1 ? 's' : ''}`,
        timeAgo: 'Now',
        badge: messageCount > 0
          ? {
              label: messageCount > 99 ? '99+ unread' : `${messageCount} unread`,
              variant: 'info',
            }
          : undefined,
        onPress: () => navigation.navigate('HealthChat'),
      });
    }

    if (medicinePendingCount > 0) {
      items.push({
        key: 'medicine',
        icon: MedicineIcon,
        iconBg: 'bg-success-500',
        title: 'Medicine request update',
        subtitle: `${medicinePendingCount} pending request${medicinePendingCount > 1 ? 's' : ''}`,
        timeAgo: 'Today',
        badge: {
          label: 'Pending',
          variant: 'warning',
        },
        onPress: () => navigation.navigate('Medicine'),
      });
    }

    if (isAwaitingInitialApproval) {
      items.push({
        key: 'record-pending',
        icon: RecordIcon,
        iconBg: 'bg-warning-500',
        title: 'Initial record under review',
        subtitle: 'Please wait for staff verification. We will notify you once approved.',
        timeAgo: 'Today',
        badge: {
          label: 'Pending approval',
          variant: 'info',
        },
        onPress: () => navigation.navigate('Records'),
      });
    } else if (recordStatus?.needsInitialRecord || recordStatus?.credentialStatus === 'Inactive') {
      items.push({
        key: 'record',
        icon: RecordIcon,
        iconBg: 'bg-accent-500',
        title: 'Record update required',
        subtitle: 'Complete your profile record to unlock full app access.',
        timeAgo: 'Today',
        badge: {
          label: 'Action needed',
          variant: 'warning',
        },
        onPress: () => navigation.navigate('Records', { screen: 'UpdateRecordChoice' }),
      });
    }

    if (announcements.length > 0) {
      items.push({
        key: 'announcement',
        icon: AnnouncementIcon,
        iconBg: 'bg-warning-500',
        title: 'New clinic announcements',
        subtitle: `${announcements.length} active announcement${announcements.length > 1 ? 's' : ''}`,
        timeAgo: 'Today',
        badge: {
          label: 'Info',
          variant: 'info',
        },
        onPress: () => navigateToSecondaryScreen('Announcements'),
      });
    }

    return items;
  }, [announcements.length, chatStatus, isAwaitingInitialApproval, medicinePendingCount, messageCount, navigateToSecondaryScreen, navigation, recordStatus?.credentialStatus, recordStatus?.needsInitialRecord]);

  const announcementCarouselItems = useMemo<AnnouncementCarouselItem[]>(() => {
    return announcements.map((item) => {
      const pubmat = item.pubmat;

      return {
        id: item.id,
        title: normalizeSentenceCase(item.label),
        body: item.description,
        onPress: () => setSelectedAnnouncement(item),
        renderImage: pubmat
          ? () => (
              <SecureAnnouncementImage
                pubmat={pubmat}
                style={{ width: '100%', height: 144 }}
                resizeMode="cover"
              />
            )
          : undefined,
      };
    });
  }, [announcements]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-secondary-900" edges={['top', 'left', 'right']}>
      <TopBar
        title={`Welcome back, ${firstName}`}
        onMenuPress={() => toggleAppDrawer(navigation)}
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
            progressBackgroundColor={isDark ? colors.secondary[800] : colors.neutral[50]}
          />
        }
        contentContainerStyle={{ paddingBottom: 108 }}
      >
        <View className="px-4 pt-4">
          <View className="mb-5">
            <Text className="text-[26px] font-bold text-secondary-900 dark:text-neutral-50">
              {greetingByTime()}, {firstName}
            </Text>
            <Text className="text-[14px] text-secondary-400 dark:text-secondary-500 mt-1">
              Here's your health summary
            </Text>
          </View>

          {isAwaitingInitialApproval ? (
            <TouchableOpacity
              className="bg-primary-50 dark:bg-secondary-800 rounded-2xl border border-primary-200 dark:border-secondary-700 p-4 mb-5"
              onPress={() => navigation.navigate('Records')}
              accessibilityRole="button"
              accessibilityLabel="View record approval status"
            >
              <View className="flex-row items-start">
                <View className="w-9 h-9 rounded-xl bg-primary-500 items-center justify-center mr-3 mt-0.5">
                  <Ionicons name="time-outline" size={18} color={colors.secondary[900]} />
                </View>

                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-secondary-800 dark:text-neutral-100">
                    Initial record submitted - waiting for approval
                  </Text>
                  <Text className="text-[12px] text-secondary-500 dark:text-secondary-400 mt-1 leading-5">
                    Please wait for clinic staff verification. You will be notified once your record is approved.
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}

          <View className="flex-row gap-3 mb-6">
            <StatTile
              icon={CalendarIcon}
              label="Appointments"
              count={appointmentCount}
              loading={isDataLoading}
              badge={appointmentCount > 0 ? { label: 'Upcoming', variant: 'warning' } : undefined}
              onPress={() => navigation.navigate('Appointments')}
            />

            <StatTile
              icon={ChatIcon}
              label="Messages"
              count={messageCount}
              loading={isDataLoading}
              badge={messageCount > 0 ? { label: 'Unread', variant: 'info' } : undefined}
              onPress={() => navigation.navigate('HealthChat')}
            />

            <StatTile
              icon={RecordIcon}
              label="Records"
              count={recordCount}
              loading={isDataLoading}
              badge={recordCount > 0 ? { label: 'Approved', variant: 'success' } : { label: 'Pending', variant: 'warning' }}
              onPress={() => navigation.navigate('Records')}
            />
          </View>

          <SectionLabel title="Upcoming" />
          {appointmentStatus ? (
            <TouchableOpacity
              className="bg-white dark:bg-secondary-800 rounded-2xl border border-neutral-200 dark:border-secondary-700 p-4 mb-1"
              onPress={() => navigation.navigate('Appointments')}
              accessibilityRole="button"
              accessibilityLabel="View upcoming appointment"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-xl bg-accent-500 items-center justify-center mr-3 flex-shrink-0">
                    <Ionicons name="calendar-outline" size={18} color={colors.neutral[50]} />
                  </View>

                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-secondary-800 dark:text-neutral-100" numberOfLines={1}>
                      Upcoming appointment
                    </Text>
                    <Text className="text-[12px] text-secondary-400 dark:text-secondary-500 mt-0.5" numberOfLines={1}>
                      Status: {appointmentStatus}
                    </Text>
                  </View>
                </View>

                <View className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-800 ml-3">
                  <Text className="text-[10px] font-semibold text-primary-800 dark:text-primary-100">Upcoming</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <EmptyState
              icon={CalendarIcon}
              message="No upcoming appointments"
              subMessage="Book an appointment with the clinic"
              actionLabel="Book appointment"
              onAction={() => navigation.navigate('Appointments')}
            />
          )}

          <SectionLabel title="Recent Activity" style="mt-6" />
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <ActivityCard
                key={activity.key}
                icon={activity.icon}
                iconBg={activity.iconBg}
                title={activity.title}
                subtitle={activity.subtitle}
                timeAgo={activity.timeAgo}
                badge={activity.badge}
                onPress={activity.onPress}
              />
            ))
          ) : (
            <EmptyState
              icon={ChatIcon}
              message="No recent activity"
              subMessage="Updates across chat, medicine, and records will appear here."
            />
          )}

          <SectionLabel
            title="Announcements"
            action={() => navigateToSecondaryScreen('Announcements')}
            actionLabel={`${announcements.length} total`}
            style="mt-6"
          />

          {announcementCarouselItems.length > 0 ? (
            <AnnouncementCarousel items={announcementCarouselItems} />
          ) : (
            <EmptyState
              icon={AnnouncementIcon}
              message="No announcements right now"
              subMessage="Clinic updates will appear here when available."
            />
          )}
        </View>
      </ScrollView>

      <AnnouncementDetailModal
        visible={Boolean(selectedAnnouncement)}
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </SafeAreaView>
  );
};

export default DashboardHomeScreen;
