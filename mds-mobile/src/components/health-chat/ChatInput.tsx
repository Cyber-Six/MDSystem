/**
 * ChatInput - Message composition area
 * Handles text input, typing indicators, and send button
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';

interface ChatInputProps {
  ticketStatus: string;
  inputValue: string;
  isLoading: boolean;
  isSocketConnected: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  // Media attachment
  onPickImage?: () => void;
  onPickFile?: () => void;
  pendingAttachment?: { uri: string; name: string; type: string; kind: 'image' | 'file' } | null;
  onClearPendingAttachment?: () => void;
  isUploading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  ticketStatus,
  inputValue,
  isLoading,
  isSocketConnected,
  onChangeText,
  onSend,
  onPickImage,
  onPickFile,
  pendingAttachment,
  onClearPendingAttachment,
  isUploading = false,
}) => {
  const { isDark } = useTheme();
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const isFrozen = ['Closed', 'Expired'].includes(ticketStatus);
  const isPending = ticketStatus === 'Open';
  const isActive = ticketStatus === 'Ongoing';
  const canSend = isActive && !isLoading && !isUploading;
  const hasPendingContent = Boolean(inputValue.trim()) || Boolean(pendingAttachment);
  const isPendingImage = pendingAttachment?.kind === 'image';
  const isPendingVideo = pendingAttachment?.type?.startsWith('video/');

  useEffect(() => {
    if (!canSend) {
      setShowAttachMenu(false);
    }
  }, [canSend]);

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
          <Ionicons
            name="lock-closed"
            size={14}
            color={isDark ? colors.neutral[400] : colors.neutral[500]}
          />
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
      {/* Pending attachment preview strip */}
      {pendingAttachment && (
        <View
          style={[
            styles.previewStrip,
            {
              backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
              borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
            },
          ]}
        >
          {isPendingImage ? (
            <Image source={{ uri: pendingAttachment.uri }} style={styles.previewThumb} resizeMode="cover" />
          ) : (
            <View
              style={[
                styles.filePreviewIcon,
                { backgroundColor: isDark ? colors.neutral[600] : colors.neutral[200] },
              ]}
            >
              <Ionicons
                name={isPendingVideo ? 'videocam' : 'document-text'}
                size={18}
                color={isDark ? colors.primary[300] : colors.primary[700]}
              />
            </View>
          )}
          <Text
            style={[styles.previewLabel, { color: isDark ? colors.neutral[300] : colors.secondary[700] }]}
            numberOfLines={1}
          >
            {isPendingImage ? 'Image ready to send' : `File ready: ${pendingAttachment.name}`}
          </Text>
          <TouchableOpacity
            onPress={onClearPendingAttachment}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <Ionicons
              name="close"
              size={18}
              color={isDark ? colors.neutral[400] : colors.neutral[500]}
            />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Attachment menu */}
        {(onPickImage || onPickFile) && (
          <View style={styles.attachMenuWrap}>
            {showAttachMenu && (
              <View
                style={[
                  styles.attachMenu,
                  {
                    backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                    borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                  },
                ]}
              >
                {onPickImage && (
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={() => {
                      setShowAttachMenu(false);
                      onPickImage();
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Attach image"
                  >
                    <Ionicons
                      name="image"
                      size={16}
                      color={isDark ? colors.primary[300] : colors.primary[700]}
                    />
                    <Text style={[styles.attachMenuLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      Attach Image
                    </Text>
                  </TouchableOpacity>
                )}

                {onPickImage && onPickFile && (
                  <View
                    style={[
                      styles.attachMenuDivider,
                      { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                    ]}
                  />
                )}

                {onPickFile && (
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={() => {
                      setShowAttachMenu(false);
                      onPickFile();
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Attach file"
                  >
                    <Ionicons
                      name="document-attach"
                      size={16}
                      color={isDark ? colors.primary[300] : colors.primary[700]}
                    />
                    <Text style={[styles.attachMenuLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      Attach File
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.attachButton,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
                  borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                },
              ]}
              onPress={() => setShowAttachMenu((prev) => !prev)}
              disabled={!canSend}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open attachment options"
            >
              <Ionicons
                name="add"
                size={20}
                color={isDark ? colors.neutral[300] : colors.neutral[500]}
              />
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          value={inputValue}
          onChangeText={onChangeText}
          onFocus={() => setShowAttachMenu(false)}
          placeholder={pendingAttachment ? 'Add a caption (optional)...' : 'Type a message...'}
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
                canSend && hasPendingContent
                  ? '#F4C430'
                  : isDark
                    ? colors.neutral[700]
                    : colors.neutral[200],
            },
          ]}
          onPress={onSend}
          disabled={!canSend || !hasPendingContent}
          activeOpacity={0.7}
        >
          {isLoading || isUploading ? (
            <ActivityIndicator size="small" color={colors.secondary[900]} />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={
                canSend && hasPendingContent
                  ? colors.secondary[900]
                  : isDark
                    ? colors.neutral[500]
                    : colors.neutral[400]
              }
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Connection warning */}
      {isActive && !isSocketConnected && (
        <View style={styles.connectionWarning}>
          <Ionicons name="flash" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={styles.warningText}>
            Reconnecting... Messages may be delayed
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
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  filePreviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  attachMenuWrap: {
    position: 'relative',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  attachMenu: {
    position: 'absolute',
    left: 0,
    bottom: 48,
    width: 156,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    zIndex: 20,
    elevation: 8,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  attachMenuLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
  },
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  warningText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
});

export default React.memo(ChatInput);
