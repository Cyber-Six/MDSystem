/**
 * MessageBubble - Individual chat message display
 * Mirrors mds-patient MessageBubble.jsx for React Native
 *
 * Supports:
 * - Patient (gold) and staff (white/dark) bubble styles
 * - System event pills
 * - Grouped message layout (avatar/timestamp only on first/last)
 * - Adaptive border radius for conversation flow
 * - Image messages with authenticated loading and full-screen lightbox
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest, getApiBaseUrl } from '../../core';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Message {
  id: string;
  text?: string;
  userType: 'Patient' | 'Medical';
  promptType?: string;
  stamp?: string;
  filename?: string;
}

interface MessageBubbleProps {
  message: Message;
  formatTime: (date?: string) => string;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

// ─── AuthImage ─────────────────────────────────────────────────────────────
// Fetches an image with JWT auth headers, caches as base64, shows lightbox

interface AuthImageProps {
  filename: string;
  isPatient: boolean;
  isDark: boolean;
}

const AuthImage: React.FC<AuthImageProps> = ({ filename, isPatient, isDark }) => {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = `${getApiBaseUrl()}/media/record/eConsultation/${filename}`;

    axiosRequest
      .get(url, { responseType: 'arraybuffer' })
      .then((response) => {
        if (cancelled) return;
        const bytes = new Uint8Array(response.data as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const contentType =
          (response.headers as Record<string, string>)['content-type'] || 'image/jpeg';
        setUri(`data:${contentType};base64,${base64}`);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filename]);

  const placeholderBg = isPatient
    ? 'rgba(0,0,0,0.08)'
    : isDark
    ? colors.neutral[700]
    : colors.neutral[100];

  if (loading) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: placeholderBg }]}>
        <ActivityIndicator
          size="small"
          color={isPatient ? colors.secondary[900] : colors.primary[500]}
        />
      </View>
    );
  }

  if (hasError || !uri) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: placeholderBg }]}>
        <Text
          style={{
            fontSize: 11,
            color: isPatient
              ? colors.secondary[700]
              : isDark
              ? colors.neutral[400]
              : colors.neutral[500],
          }}
        >
          ⚠ Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={() => setLightboxOpen(true)} activeOpacity={0.85}>
        <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
      </TouchableOpacity>

      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightboxOpen(false)}
      >
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxOpen(false)}>
          <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxOpen(false)}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
};

// ─── MessageBubble ──────────────────────────────────────────────────────────

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  formatTime,
  isFirstInGroup = true,
  isLastInGroup = true,
}) => {
  const { isDark } = useTheme();
  const isPatient = message.userType === 'Patient';
  const isSystem = message.promptType === 'system';
  const hasImage = Boolean(message.filename);

  // System event pill
  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <View
          style={[
            styles.systemPill,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
              borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
            },
          ]}
        >
          <Text style={styles.systemIcon}>ℹ</Text>
          <Text
            style={[
              styles.systemText,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  // Compute border radii for conversation flow
  const getPatientRadius = () => ({
    borderTopLeftRadius: 18,
    borderTopRightRadius: isFirstInGroup ? 18 : 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: isLastInGroup ? 4 : 18,
  });

  const getStaffRadius = () => ({
    borderTopLeftRadius: isFirstInGroup ? 18 : 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: isLastInGroup ? 4 : 18,
    borderBottomRightRadius: 18,
  });

  return (
    <View style={{ marginBottom: isLastInGroup ? 6 : 2 }}>
      <View
        style={[
          styles.messageRow,
          isPatient ? styles.rowRight : styles.rowLeft,
        ]}
      >
        {/* Staff avatar — only visible on last bubble of group */}
        {!isPatient && (
          <View
            style={[
              styles.avatar,
              { opacity: isLastInGroup ? 1 : 0 },
            ]}
          >
            <Text style={styles.avatarText}>🩺</Text>
          </View>
        )}

        <View
          style={[
            styles.bubbleColumn,
            isPatient ? styles.alignEnd : styles.alignStart,
          ]}
        >
          {/* Sender label — first bubble of staff group */}
          {!isPatient && isFirstInGroup && (
            <Text
              style={[
                styles.senderLabel,
                { color: isDark ? colors.neutral[500] : colors.neutral[400] },
              ]}
            >
              Medical Staff
            </Text>
          )}

          {/* Bubble */}
          {isPatient ? (
            <View style={[styles.patientBubble, getPatientRadius(), hasImage && styles.imageBubble]}>
              {hasImage && (
                <AuthImage
                  filename={message.filename!}
                  isPatient={isPatient}
                  isDark={isDark}
                />
              )}
              {message.text ? (
                <Text style={[styles.patientText, hasImage && styles.imageCaption]}>
                  {message.text}
                </Text>
              ) : null}
            </View>
          ) : (
            <View
              style={[
                styles.staffBubble,
                getStaffRadius(),
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
                hasImage && styles.imageBubble,
              ]}
            >
              {hasImage && (
                <AuthImage
                  filename={message.filename!}
                  isPatient={isPatient}
                  isDark={isDark}
                />
              )}
              {message.text ? (
                <Text
                  style={[
                    styles.staffText,
                    { color: isDark ? colors.neutral[100] : colors.secondary[800] },
                    hasImage && styles.imageCaption,
                  ]}
                >
                  {message.text}
                </Text>
              ) : null}
            </View>
          )}

          {/* Timestamp — only on last bubble */}
          {isLastInGroup && (
            <Text
              style={[
                styles.timestamp,
                { color: isDark ? colors.neutral[500] : colors.neutral[400] },
              ]}
            >
              {formatTime(message.stamp)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // System
  systemContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  systemIcon: {
    fontSize: 11,
  },
  systemText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Message layout
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowRight: {
    flexDirection: 'row-reverse',
  },
  rowLeft: {
    flexDirection: 'row',
  },
  // Avatar
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244,196,48,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,196,48,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
  },
  // Column
  bubbleColumn: {
    maxWidth: '76%',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  // Sender label
  senderLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  // Patient bubble
  patientBubble: {
    backgroundColor: '#F4C430',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  patientText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary[900],
  },
  // Staff bubble
  staffBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  staffText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Timestamp
  timestamp: {
    fontSize: 10,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  // Image support
  imageBubble: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: 220,
    height: 155,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: 220,
    height: 155,
  },
  imageCaption: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  // Lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.78,
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default React.memo(MessageBubble);
