/**
 * ChatInput - Message composition area
 * Handles text input, typing indicators, and send button
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

interface ChatInputProps {
  ticketStatus: string;
  inputValue: string;
  isLoading: boolean;
  isSocketConnected: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  ticketStatus,
  inputValue,
  isLoading,
  isSocketConnected,
  onChangeText,
  onSend,
}) => {
  const { isDark } = useTheme();
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';
  const canSend = isActive && !isLoading;

  // Frozen state
  if (isFrozen) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
          },
        ]}
      >
        <View
          style={[
            styles.frozenBar,
            {
              backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
            },
          ]}
        >
          <Text style={{ fontSize: 14 }}>🔒</Text>
          <Text
            style={[
              styles.frozenText,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            This conversation is closed
          </Text>
        </View>
      </View>
    );
  }

  // Pending state
  if (isPending) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
          },
        ]}
      >
        <View
          style={[
            styles.pendingBar,
            {
              backgroundColor: isDark ? 'rgba(244,196,48,0.08)' : 'rgba(244,196,48,0.1)',
            },
          ]}
        >
          <ActivityIndicator size="small" color="#F4C430" />
          <Text
            style={[
              styles.pendingText,
              { color: isDark ? '#FBBF24' : '#92400E' },
            ]}
          >
            Waiting for staff approval...
          </Text>
        </View>
      </View>
    );
  }

  // Active input
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
        },
      ]}
    >
      <View style={styles.inputRow}>
        <TextInput
          value={inputValue}
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
          multiline
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
              color: isDark ? colors.neutral[100] : colors.secondary[800],
              borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
            },
          ]}
          editable={canSend}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor:
                canSend && inputValue.trim()
                  ? '#F4C430'
                  : isDark
                    ? colors.neutral[700]
                    : colors.neutral[200],
            },
          ]}
          onPress={onSend}
          disabled={!canSend || !inputValue.trim()}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.secondary[900]} />
          ) : (
            <Text
              style={[
                styles.sendIcon,
                {
                  color:
                    canSend && inputValue.trim()
                      ? colors.secondary[900]
                      : isDark
                        ? colors.neutral[500]
                        : colors.neutral[400],
                },
              ]}
            >
              ➤
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Connection warning */}
      {isActive && !isSocketConnected && (
        <View style={styles.connectionWarning}>
          <Text style={styles.warningText}>
            ⚡ Reconnecting... Messages may be delayed
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  // Frozen
  frozenBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  frozenText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Pending
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Active input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#F4C430',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Connection warning
  connectionWarning: {
    marginTop: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
});

export default React.memo(ChatInput);
