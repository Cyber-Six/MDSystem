import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { axiosRequest } from '../../core';
import { useTheme, colors } from '../../context/ThemeContext';
import type { Announcement } from '../../services/announcement-service';

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
        for (let i = 0; i < uint8.length; i += 1) binary += String.fromCharCode(uint8[i]);
        setUri(`data:image/jpeg;base64,${btoa(binary)}`);
      })
      .catch(() => {
        setUri(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pubmat]);

  if (!uri) return null;

  return (
    <Image
      source={{ uri }}
      style={styles.image}
      resizeMode="contain"
    />
  );
}

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

  if (!announcement) return null;

  const bg = isDark ? colors.neutral[800] : '#FFFFFF';
  const titleColor = isDark ? colors.neutral[100] : colors.secondary[900];
  const textColor = isDark ? colors.neutral[300] : colors.neutral[700];
  const borderColor = isDark ? colors.neutral[700] : colors.neutral[200];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.modalCard, { backgroundColor: bg, borderColor }]}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
                {announcement.label || 'Announcement'}
              </Text>
              <Text style={[styles.date, { color: colors.neutral[500] }]}>
                Posted {formatDate(announcement.created_at)}
              </Text>
            </View>

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

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.bodyText, { color: textColor }]}>
              {announcement.description || 'No description available.'}
            </Text>

            {announcement.pubmat ? (
              <SecureAnnouncementImage pubmat={announcement.pubmat} />
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
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
