/**
 * My Documents Screen
 * Mirrors mds-patient/src/modules/my-documents/my-documents-page.jsx
 *
 * Lists patient documents (prescriptions, medical certs, diagnosis reports,
 * staff reports) and opens them via the device browser.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions } from '@react-navigation/native';
import { useTheme, colors } from '../../context/ThemeContext';
import {
  getMyDocuments,
  downloadAndOpenDocument,
  type PatientDocument,
} from '../../services/documents-service';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  'medical-certificate': 'Medical Certificate',
  'diagnosis-report': 'Diagnosis Report',
  'staff-report': 'Staff Report',
};

type DocIconConfig = { lib: 'Ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] } | { lib: 'MCI'; name: string };

const TYPE_ICON: Record<string, DocIconConfig> = {
  prescription: { lib: 'MCI', name: 'pill' },
  'medical-certificate': { lib: 'Ionicons', name: 'medkit' },
  'diagnosis-report': { lib: 'Ionicons', name: 'flask' },
  'staff-report': { lib: 'Ionicons', name: 'document-text' },
};

const TYPE_COLOR: Record<string, string> = {
  prescription: colors.primary[500],
  'medical-certificate': colors.accent[500],
  'diagnosis-report': colors.success[500],
  'staff-report': colors.neutral[500],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Document Card ──────────────────────────────────────────────────────────

const DocumentCard: React.FC<{
  doc: PatientDocument;
  isDark: boolean;
  onView: () => void;
  isDownloading?: boolean;
}> = ({ doc, isDark, onView, isDownloading = false }) => {
  const label = TYPE_LABELS[doc.templateType] || doc.templateType;
  const iconConfig: DocIconConfig = TYPE_ICON[doc.templateType] ?? { lib: 'Ionicons', name: 'document' };
  const badgeColor = TYPE_COLOR[doc.templateType] || colors.neutral[500];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
        },
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.cardIcon,
          {
            backgroundColor: isDark
              ? `${badgeColor}22`
              : `${badgeColor}18`,
          },
        ]}
      >
        {iconConfig.lib === 'MCI' ? (
          <MaterialCommunityIcons name={iconConfig.name as any} size={22} color={badgeColor} />
        ) : (
          <Ionicons name={iconConfig.name} size={22} color={badgeColor} />
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: `${badgeColor}20`, borderColor: `${badgeColor}40` },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
          </View>
        </View>

        {doc.description ? (
          <Text
            style={[
              styles.description,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
            numberOfLines={2}
          >
            {doc.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text
            style={[
              styles.metaText,
              { color: isDark ? colors.neutral[500] : colors.neutral[400] },
            ]}
          >
            Issued: {formatDateTime(doc.createdAt)}
          </Text>

          {doc.issuedBy?.name ? (
            <Text
              style={[
                styles.metaText,
                { color: isDark ? colors.neutral[500] : colors.neutral[400] },
              ]}
            >
              By: {doc.issuedBy.name}
            </Text>
          ) : null}

          {doc.expiredAt ? (
            <Text
              style={[
                styles.metaText,
                { color: isDark ? colors.accent[400] : colors.accent[600] },
              ]}
            >
              Expires: {formatDate(doc.expiredAt)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Action */}
      <TouchableOpacity
        style={[
          styles.viewBtn,
          { backgroundColor: colors.primary[500], opacity: isDownloading ? 0.6 : 1 },
        ]}
        onPress={onView}
        activeOpacity={0.8}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.viewBtnText}>Open</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ── Screen ─────────────────────────────────────────────────────────────────

interface MyDocumentsScreenProps {
  navigation: any;
}

export const MyDocumentsScreen: React.FC<MyDocumentsScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const docs = await getMyDocuments();
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleView = async (doc: PatientDocument) => {
    if (downloadingId !== null) return; // prevent simultaneous downloads
    setDownloadingId(doc.id);
    try {
      await downloadAndOpenDocument(doc);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const uniqueTypes = [...new Set(documents.map((d) => d.templateType))];
  const filtered =
    filter === 'all' ? documents : documents.filter((d) => d.templateType === filter);

  const bg = isDark ? colors.neutral[900] : colors.neutral[50];
  const textPrimary = isDark ? colors.neutral[100] : colors.secondary[900];
  const textMuted = isDark ? colors.neutral[400] : colors.neutral[500];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.menuButton,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
            onPress={() => navigation.getParent()?.dispatch(DrawerActions.toggleDrawer())}
            accessibilityRole="button"
            accessibilityLabel="Open sidebar"
          >
            <Ionicons
              name="menu"
              size={22}
              color={isDark ? colors.neutral[100] : colors.secondary[900]}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>My Documents</Text>
        </View>

        {/* Sub-header */}
        <Text style={[styles.subtitle, { color: textMuted }]}>
          Tap a document to open it on your device.
        </Text>

        {/* Filter chips */}
        {uniqueTypes.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={{ marginBottom: 12 }}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                filter === 'all'
                  ? { backgroundColor: colors.primary[500], borderColor: colors.primary[500] }
                  : {
                      backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                    },
              ]}
              onPress={() => setFilter('all')}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: filter === 'all' ? '#FFFFFF' : textMuted },
                ]}
              >
                All ({documents.length})
              </Text>
            </TouchableOpacity>

            {uniqueTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chip,
                  filter === type
                    ? { backgroundColor: colors.primary[500], borderColor: colors.primary[500] }
                    : {
                        backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                        borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                      },
                ]}
                onPress={() => setFilter(type)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: filter === type ? '#FFFFFF' : textMuted },
                  ]}
                >
                  {TYPE_LABELS[type] || type} ({documents.filter((d) => d.templateType === type).length})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Error */}
        {error && (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
              },
            ]}
          >
            <Ionicons name="warning" size={16} color={isDark ? '#F87171' : '#DC2626'} style={{ marginRight: 4 }} />
            <Text style={{ color: isDark ? '#F87171' : '#DC2626', fontSize: 13, flex: 1 }}>
              {error}
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={[styles.loadingText, { color: textMuted }]}>Loading documents…</Text>
          </View>
        ) : filtered.length === 0 && !error ? (
          /* Empty state */
          <View style={styles.centered}>
            <Ionicons name="document" size={48} color={isDark ? colors.neutral[600] : colors.neutral[300]} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No Documents</Text>
            <Text style={[styles.emptyDesc, { color: textMuted }]}>
              Documents issued by your healthcare provider will appear here.
            </Text>
          </View>
        ) : (
          /* Document list */
          <View style={styles.list}>
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isDark={isDark}
                isDownloading={downloadingId === doc.id}
                onView={() => handleView(doc)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, flexGrow: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: { fontSize: 13, marginBottom: 12 },

  filterRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  errorBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 8, fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: 'center', maxWidth: 260 },

  list: { gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  description: { fontSize: 12 },
  metaRow: { gap: 2 },
  metaText: { fontSize: 11 },

  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  viewBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

export default MyDocumentsScreen;
