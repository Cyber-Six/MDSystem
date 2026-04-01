/**
 * ChatHeader - Health chat header with connection status
 * Shows Medical Staff info, connection dot, and close button
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

interface ChatHeaderProps {
  ticketStatus: string;
  isSocketConnected: boolean;
  isStaffTyping: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCloseModal: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  ticketStatus,
  isSocketConnected,
  isStaffTyping,
  isLoading,
  onRefresh,
  onOpenCloseModal,
}) => {
  const { isDark } = useTheme();
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';

  const getStatusDot = () => {
    if (isFrozen) return colors.neutral[400];
    if (isPending) return '#F4C430';
    if (isActive && isSocketConnected) return '#22c55e';
    return '#F4C430';
  };

  const getStatusLabel = () => {
    if (isFrozen) return 'Conversation closed';
    if (isPending) return 'Waiting for staff';
    if (isStaffTyping) return 'Typing...';
    if (isSocketConnected) return 'Online';
    return 'Connecting...';
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.neutral[900] : '#FFFFFF',
          borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
        },
      ]}
    >
      {/* Left: avatar + name + status */}
      <View style={styles.leftSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>🩺</Text>
          <View style={[styles.statusDot, { backgroundColor: getStatusDot() }]} />
        </View>
        <View>
          <Text
            style={[
              styles.name,
              { color: isDark ? '#FFFFFF' : colors.secondary[800] },
            ]}
          >
            Medical Staff
          </Text>
          <Text
            style={[
              styles.status,
              isStaffTyping
                ? { color: colors.primary[500], fontWeight: '500' }
                : { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            {getStatusLabel()}
          </Text>
        </View>
      </View>

      {/* Right: actions */}
      <View style={styles.rightSection}>
        {!isSocketConnected && isActive && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={isLoading}
            activeOpacity={0.6}
          >
            <Text style={{ fontSize: 16, color: isDark ? colors.neutral[500] : colors.neutral[400] }}>
              ↻
            </Text>
          </TouchableOpacity>
        )}

        {isActive && (
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
              },
            ]}
            onPress={onOpenCloseModal}
            disabled={isLoading}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.closeBtnText,
                { color: isDark ? colors.neutral[300] : colors.neutral[600] },
              ]}
            >
              ✕ Close
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(244,196,48,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,196,48,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default React.memo(ChatHeader);
