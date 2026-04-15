import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { Announcement, fetchAnnouncementById } from '../../services/announcement-service';
import SecureAnnouncementImage from './SecureAnnouncementImage';

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

interface AnnouncementDetailModalProps {
  visible: boolean;
  announcement: Announcement | null;
  onClose: () => void;
}

export const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  visible,
  announcement,
  onClose,
}) => {
  const { isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [announcementDetail, setAnnouncementDetail] = useState<Announcement | null>(announcement);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    setAnnouncementDetail(announcement);
  }, [announcement]);

  useEffect(() => {
    if (!visible || !announcement?.id) return;

    let cancelled = false;
    setIsLoadingDetail(true);

    fetchAnnouncementById(announcement.id)
      .then((fullAnnouncement) => {
        if (cancelled || !fullAnnouncement) return;
        setAnnouncementDetail((prev) => ({
          ...prev,
          ...fullAnnouncement,
        }));
      })
      .catch(() => {
        // Keep currently available announcement data when detail fetch fails.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, announcement?.id]);

  if (!announcement) return null;

  const activeAnnouncement = announcementDetail ?? announcement;
  const computedCardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
      maxHeight: windowHeight * 0.88,
      minHeight: Math.min(windowHeight * 0.55, 380),
    }),
    [isDark, windowHeight]
  );

  const titleColor = isDark ? colors.neutral[100] : colors.secondary[900];
  const textColor = isDark ? colors.neutral[300] : colors.neutral[700];
  const borderColor = isDark ? colors.neutral[700] : colors.neutral[200];
  const backButtonColor = isDark ? colors.neutral[300] : colors.secondary[800];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.modalCard, computedCardStyle]}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={18} color={backButtonColor} />
                <Text style={[styles.backButtonText, { color: backButtonColor }]}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.iconClose}
                accessibilityRole="button"
                accessibilityLabel="Close announcement details"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={isDark ? colors.neutral[300] : colors.neutral[500]}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
                {activeAnnouncement.label || 'Announcement'}
              </Text>
              <Text style={[styles.date, { color: colors.neutral[500] }]}> 
                Posted {formatDate(activeAnnouncement.created_at)}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingDetail && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
              </View>
            )}

            <Text style={[styles.bodyText, { color: textColor }]}>
              {activeAnnouncement.description || 'No description available.'}
            </Text>

            {activeAnnouncement.pubmat ? (
              <SecureAnnouncementImage
                pubmat={activeAnnouncement.pubmat}
                style={styles.image}
                resizeMode="contain"
              />
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.primary[500] }]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  iconClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  image: {
    width: '100%',
    minHeight: 180,
    height: 240,
    borderRadius: 12,
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  footer: {
    borderTopWidth: 1,
    padding: 14,
    alignItems: 'flex-end',
  },
  closeButton: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AnnouncementDetailModal;
