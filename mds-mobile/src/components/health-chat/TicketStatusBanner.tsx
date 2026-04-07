/**
 * TicketStatusBanner - Shows ticket lifecycle status
 * Mirrors mds-patient TicketStatusBanner.jsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

interface TicketStatusBannerProps {
  status: string;
  purpose?: string;
  isLoading?: boolean;
  onCancel?: () => void;
}

const TicketStatusBanner: React.FC<TicketStatusBannerProps> = ({
  status,
  purpose,
  isLoading,
  onCancel,
}) => {
  const { isDark } = useTheme();

  const configs: Record<string, {
    icon: string;
    title: string;
    message: string;
    bgColor: string;
    bgColorDark: string;
    borderColor: string;
    borderColorDark: string;
    titleColor: string;
    titleColorDark: string;
  }> = {
    Open: {
      icon: '⏳',
      title: 'Waiting for medical staff...',
      message: 'Your request is being reviewed. You will be connected soon.',
      bgColor: '#FFFBEB',
      bgColorDark: 'rgba(245,158,11,0.08)',
      borderColor: '#FDE68A',
      borderColorDark: 'rgba(245,158,11,0.2)',
      titleColor: '#92400E',
      titleColorDark: '#FBBF24',
    },
    Ongoing: {
      icon: '✅',
      title: 'Connected with medical staff',
      message: purpose ? `Purpose: ${purpose}` : 'Your consultation is active.',
      bgColor: '#F0FDF4',
      bgColorDark: 'rgba(34,197,94,0.08)',
      borderColor: '#BBF7D0',
      borderColorDark: 'rgba(34,197,94,0.2)',
      titleColor: '#166534',
      titleColorDark: '#4ADE80',
    },
    Closed: {
      icon: '✕',
      title: 'Conversation closed',
      message: 'This consultation has ended. You can start a new one anytime.',
      bgColor: colors.neutral[50],
      bgColorDark: 'rgba(120,113,108,0.08)',
      borderColor: colors.neutral[200],
      borderColorDark: colors.neutral[700],
      titleColor: colors.neutral[600],
      titleColorDark: colors.neutral[400],
    },
    Expired: {
      icon: '⚠',
      title: 'Session expired',
      message: 'This consultation expired due to inactivity.',
      bgColor: '#FEF2F2',
      bgColorDark: 'rgba(239,68,68,0.08)',
      borderColor: '#FECACA',
      borderColorDark: 'rgba(239,68,68,0.2)',
      titleColor: '#991B1B',
      titleColorDark: '#FCA5A5',
    },
  };

  const config = configs[status];
  if (!config) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? config.bgColorDark : config.bgColor,
          borderColor: isDark ? config.borderColorDark : config.borderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: isDark ? config.titleColorDark : config.titleColor },
            ]}
          >
            {config.title}
          </Text>
          <Text
            style={[
              styles.message,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            {config.message}
          </Text>
        </View>
      </View>

      {/* Cancel button for Open status */}
      {status === 'Open' && onCancel && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          disabled={isLoading}
          activeOpacity={0.6}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={styles.cancelText}>Cancel Request</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    fontSize: 20,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  cancelBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
});

export default React.memo(TicketStatusBanner);
