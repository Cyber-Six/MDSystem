import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, colors } from '../../context/ThemeContext';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { getUpdateTicketStatus } from '../../services/emr-service';
import { toggleAppDrawer } from '../../navigation/drawer-utils';
import { TopBar } from '../../components/layout/TopBar';
import { SectionLabel } from '../../components/common/SectionLabel';
import { Badge, BadgeVariant } from '../../components/common/Badge';
import { ActivityCard } from '../../components/common/ActivityCard';
import { EmptyState } from '../../components/common/EmptyState';

type TicketStatus = {
  id: string;
  status: string;
  scope: string;
  notes?: string;
};

type RecordsScreenProps = {
  navigation: any;
};

type RecordActivity = {
  key: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconBg: string;
  title: string;
  subtitle: string;
  timeAgo?: string;
  badge?: {
    label: string;
    variant: BadgeVariant;
  };
  onPress?: () => void;
};

const ShieldIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="shield-checkmark-outline" size={size} color={color} />
);

const ClipboardIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="clipboard-outline" size={size} color={color} />
);

const NoteIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ionicons name="document-text-outline" size={size} color={color} />
);

const normalizeStatusLabel = (status: string | null | undefined) => {
  const value = String(status || '').trim();
  if (!value) return 'No submission';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
};

const getTicketBadgeVariant = (status: string | null | undefined): BadgeVariant => {
  const normalized = String(status || '').toLowerCase();
  if (!normalized) return 'neutral';
  if (normalized.includes('approved')) return 'success';
  if (normalized.includes('pending') || normalized.includes('review')) return 'warning';
  if (normalized.includes('revision')) return 'info';
  return 'neutral';
};

const getCredentialBadgeVariant = (credentialStatus: string | null | undefined): BadgeVariant => {
  const normalized = String(credentialStatus || '').toLowerCase();
  if (!normalized) return 'neutral';
  if (normalized === 'approved' || normalized === 'active') return 'success';
  if (normalized === 'inactive' || normalized === 'unverified') return 'warning';
  return 'neutral';
};

export const RecordsScreen: React.FC<RecordsScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { recordStatus } = useRecordStatus();

  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(true);

  const loadTicketStatus = useCallback(async () => {
    setIsLoadingTicket(true);
    try {
      const ticket = await getUpdateTicketStatus();
      setTicketStatus(ticket || null);
    } catch {
      setTicketStatus(null);
    } finally {
      setIsLoadingTicket(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTicketStatus();
    }, [loadTicketStatus]),
  );

  const activities = useMemo<RecordActivity[]>(() => {
    const nextActivities: RecordActivity[] = [];
    const ticketLabel = normalizeStatusLabel(ticketStatus?.status || recordStatus?.status);

    nextActivities.push({
      key: 'credential',
      icon: ShieldIcon,
      iconBg: 'bg-accent-500',
      title: 'Credential status updated',
      subtitle: `Current access level: ${recordStatus?.credentialStatus || 'Unknown'}`,
      badge: {
        label: recordStatus?.credentialStatus || 'Unknown',
        variant: getCredentialBadgeVariant(recordStatus?.credentialStatus),
      },
    });

    nextActivities.push({
      key: 'ticket',
      icon: ClipboardIcon,
      iconBg: 'bg-primary-500',
      title: 'Record update ticket',
      subtitle: `Current ticket status: ${ticketLabel}`,
      badge: {
        label: ticketLabel,
        variant: getTicketBadgeVariant(ticketStatus?.status || recordStatus?.status),
      },
      onPress: () => navigation.navigate('UpdateRecordChoice'),
    });

    if (ticketStatus?.notes || recordStatus?.notes) {
      nextActivities.push({
        key: 'notes',
        icon: NoteIcon,
        iconBg: 'bg-warning-500',
        title: 'Staff feedback available',
        subtitle: ticketStatus?.notes || recordStatus?.notes || 'Staff provided notes for your latest update.',
        badge: {
          label: 'Review',
          variant: 'info',
        },
      });
    }

    return nextActivities;
  }, [navigation, recordStatus?.credentialStatus, recordStatus?.notes, recordStatus?.status, ticketStatus?.notes, ticketStatus?.status]);

  const credentialLabel = recordStatus?.credentialStatus || 'Unknown';
  const ticketLabel = normalizeStatusLabel(ticketStatus?.status || recordStatus?.status);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}
      edges={['top', 'left', 'right']}
    >
      <TopBar title="Records" onMenuPress={() => toggleAppDrawer(navigation)} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-4 pt-4">
          <View
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: isDark ? colors.secondary[800] : '#FFFFFF',
              borderColor: isDark ? colors.secondary[700] : colors.neutral[200],
            }}
          >
            <Text className="text-[16px] font-semibold" style={{ color: isDark ? colors.neutral[50] : colors.secondary[900] }}>
              Health record overview
            </Text>
            <Text className="text-[13px] mt-1" style={{ color: isDark ? colors.secondary[500] : colors.secondary[400] }}>
              Review your current record status and start a new update when needed.
            </Text>
          </View>

          <SectionLabel title="Current Status" style="mt-6" />
          <View
            className="rounded-2xl border p-4 gap-4"
            style={{
              backgroundColor: isDark ? colors.secondary[800] : '#FFFFFF',
              borderColor: isDark ? colors.secondary[700] : colors.neutral[200],
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px]" style={{ color: isDark ? colors.secondary[400] : colors.secondary[500] }}>Credential</Text>
              <Badge label={credentialLabel} variant={getCredentialBadgeVariant(recordStatus?.credentialStatus)} />
            </View>

            <View className="h-[0.5px]" style={{ backgroundColor: isDark ? colors.secondary[700] : colors.neutral[200] }} />

            <View className="flex-row items-center justify-between">
              <Text className="text-[13px]" style={{ color: isDark ? colors.secondary[400] : colors.secondary[500] }}>Update ticket</Text>
              <Badge label={ticketLabel} variant={getTicketBadgeVariant(ticketStatus?.status || recordStatus?.status)} />
            </View>

            <View className="h-[0.5px]" style={{ backgroundColor: isDark ? colors.secondary[700] : colors.neutral[200] }} />

            <View className="flex-row items-center justify-between">
              <Text className="text-[13px]" style={{ color: isDark ? colors.secondary[400] : colors.secondary[500] }}>Record access</Text>
              <Badge
                label={recordStatus?.needsInitialRecord ? 'Locked' : 'Unlocked'}
                variant={recordStatus?.needsInitialRecord ? 'warning' : 'success'}
              />
            </View>
          </View>

          <SectionLabel title="Recent Activity" style="mt-6" />

          {isLoadingTicket ? (
            <View
              className="rounded-2xl border p-6 items-center"
              style={{
                backgroundColor: isDark ? colors.secondary[800] : '#FFFFFF',
                borderColor: isDark ? colors.secondary[700] : colors.neutral[200],
              }}
            >
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text className="text-[12px] mt-2" style={{ color: isDark ? colors.secondary[500] : colors.secondary[400] }}>
                Loading record activity...
              </Text>
            </View>
          ) : activities.length ? (
            activities.map((activity) => (
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
              icon={ClipboardIcon}
              message="No record activity yet"
              subMessage="Your record updates will appear here once you submit a request."
            />
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('UpdateRecordChoice')}
        className="absolute bg-primary-500 rounded-full px-5 min-h-[52px] flex-row items-center justify-center gap-1"
        style={{
          right: 10,
          bottom: Math.max(insets.bottom - 16, 2),
        }}
        accessibilityRole="button"
        accessibilityLabel="Start record update"
      >
        <Ionicons name="add" size={18} color={colors.secondary[900]} />
        <Text className="text-[14px] font-semibold text-secondary-900">Update record</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default RecordsScreen;
