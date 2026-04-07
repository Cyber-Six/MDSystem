/**
 * Announcements Screen
 * Mirrors mds-patient's announcement-carousel + announcement-modal components.
 *
 * Fetches active announcements and shows them as a card list.
 * Tapping an announcement expands a bottom-sheet-style detail view.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { axiosRequest } from '../../core';
import { Ionicons } from '@expo/vector-icons';

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/** Fetches an authenticated media image and renders it inline. */
function SecureAnnouncementImage({ pubmat }: { pubmat: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    axiosRequest
      .get(`/media/record/announcement/${pubmat}`, { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return;
        const uint8 = new Uint8Array(res.data as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        setUri(`data:image/jpeg;base64,${btoa(binary)}`);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pubmat]);
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 12 }}
      resizeMode="contain"
    />
  );
}

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

      {/* Detail modal */}
      {selected && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setSelected(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: cardBg }]}>
              {/* Handle bar */}
              <View style={[styles.handle, { backgroundColor: isDark ? colors.neutral[600] : colors.neutral[300] }]} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>{selected.label}</Text>
                <Text style={[styles.modalDate, { color: textSecondary }]}>
                  Posted {formatDate(selected.created_at)}
                </Text>
                <View style={[styles.divider, { backgroundColor: border }]} />
                <Text style={[styles.modalBody, { color: textPrimary }]}>{selected.description}</Text>

                {selected.pubmat && (
                  <SecureAnnouncementImage pubmat={selected.pubmat} />
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.primary[500] }]}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 4 },
  modalDate: { fontSize: 13, marginBottom: 12 },
  divider: { height: 1, marginBottom: 16 },
  modalBody: { fontSize: 15, lineHeight: 24 },
  closeBtn: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});

export default AnnouncementsScreen;
