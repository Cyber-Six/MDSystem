/**
 * Announcements Screen
 * Mirrors mds-patient's announcement-carousel + announcement-modal components.
 *
 * Fetches active announcements and shows them as a card list.
 * Tapping an announcement opens a full-view detail modal.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Announcement, fetchActiveAnnouncements } from '../../services/announcement-service';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AnnouncementDetailModal from '../../components/announcements/AnnouncementDetailModal';

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

interface AnnouncementsScreenProps {
  navigation: any;
}

export const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = () => {
  const { isDark } = useTheme();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await fetchActiveAnnouncements();
      setAnnouncements(data);
    } catch {
      setError('Could not load announcements. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bg = isDark ? colors.neutral[900] : colors.neutral[50];
  const cardBg = isDark ? colors.neutral[800] : '#FFFFFF';
  const textPrimary = isDark ? colors.neutral[100] : colors.secondary[900];
  const textSecondary = isDark ? colors.neutral[400] : colors.neutral[500];
  const border = isDark ? colors.neutral[700] : colors.neutral[200];

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary[500]}
          />
        }
      >
        {error && (
          <View style={[styles.errorBox, { borderColor: colors.error?.[400] ?? '#F87171' }]}>
            <Text style={{ color: colors.error?.[600] ?? '#DC2626', fontSize: 14 }}>{error}</Text>
          </View>
        )}

        {!error && announcements.length === 0 && (
          <View style={styles.centered}>
            <Ionicons name="megaphone" size={40} color={isDark ? colors.neutral[600] : colors.neutral[300]} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: textSecondary }]}>No announcements at this time.</Text>
          </View>
        )}

        {announcements.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => setSelected(item)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: textPrimary }]} numberOfLines={2}>
                {item.label}
              </Text>
              <Text style={[styles.cardDate, { color: textSecondary }]}>
                {formatDate(item.created_at)}
              </Text>
            </View>
            <Text style={[styles.cardBody, { color: textSecondary }]} numberOfLines={3}>
              {item.description}
            </Text>
            <Text style={[styles.readMore, { color: colors.primary[500] }]}>Read more →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AnnouncementDetailModal
        visible={Boolean(selected)}
        announcement={selected}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  errorBox: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },

  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: { gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  cardDate: { fontSize: 12 },
  cardBody: { fontSize: 14, lineHeight: 20 },
  readMore: { fontSize: 13, fontWeight: '500' },
});

export default AnnouncementsScreen;
