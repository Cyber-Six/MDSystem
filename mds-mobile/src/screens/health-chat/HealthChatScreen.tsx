/**
 * Health Chat Screen - Patient-to-Staff Chat
 * Refactored to use modular sub-components + WebSocket integration
 *
 * Ticket lifecycle: Create → Open (pending) → Ongoing (active) → Closed/Expired
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, colors } from '../../context/ThemeContext';
import {
  Ticket,
  TicketMessage,
  getCurrentActiveTicket,
  getMostRecentTicket,
  getTicketMessages,
  createTicket,
  sendMessage,
  closeTicket,
  uploadFile,
} from '../../services/health-chat-service';
import { useHealthChatSocket } from '../../hooks/useHealthChatSocket';
import {
  MessageBubble,
  TypingIndicator,
  ChatHeader,
  ChatInput,
  TicketStatusBanner,
  ConfirmModal,
  CreateTicketForm,
  NewChatCTA,
} from '../../components/health-chat';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compute message grouping (isFirstInGroup / isLastInGroup) */
function computeGrouping(messages: TicketMessage[]) {
  return messages.map((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const isFirstInGroup =
      msg.promptType === 'system' ||
      !prev ||
      prev.promptType === 'system' ||
      prev.userType !== msg.userType;
    const isLastInGroup =
      msg.promptType === 'system' ||
      !next ||
      next.promptType === 'system' ||
      next.userType !== msg.userType;
    return { ...msg, isFirstInGroup, isLastInGroup };
  });
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export const HealthChatScreen: React.FC = () => {
  const { isDark } = useTheme();

  // ── State ─────────────────────────────────────────────────────────────────
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [ticketPurpose, setTicketPurpose] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isStaffTyping, setIsStaffTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const hasInitialized = useRef(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const fetchedMessages = await getTicketMessages(chatId);
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    }
  }, []);

  // ── Socket integration ────────────────────────────────────────────────────
  const { isConnected: isSocketConnected, emitTyping } = useHealthChatSocket({
    chatId: ticket?.id ?? null,
    chatStatus: ticket?.status ?? '',
    onNewMessage: useCallback((message: TicketMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(message.id))) return prev;
        return [...prev, message];
      });
    }, []),
    onTyping: useCallback((isTyping: boolean) => {
      setIsStaffTyping(isTyping);
    }, []),
    onTicketApproved: useCallback((chat: Ticket) => {
      setTicket(chat);
      if (chat.id) loadMessages(chat.id);
    }, [loadMessages]),
    onTicketClosed: useCallback(() => {
      setTicket((prev) => (prev ? { ...prev, status: 'Closed' } : null));
      setIsStaffTyping(false);
    }, []),
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeHealthChat();
  }, []);

  // Poll for ticket status when pending (Open) — 15s
  useEffect(() => {
    if (!ticket?.id || ticket?.status !== 'Open') return;

    const pollInterval = setInterval(async () => {
      try {
        const updatedTicket = await getCurrentActiveTicket();
        if (updatedTicket && updatedTicket.status !== 'Open') {
          setTicket(updatedTicket);
          if (updatedTicket.id) await loadMessages(updatedTicket.id);
        }
      } catch (err) {
        console.error('[HealthChat] Polling failed:', err);
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [ticket?.id, ticket?.status, loadMessages]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function initializeHealthChat() {
    try {
      setIsInitializing(true);
      setError(null);

      const activeTicket = await getCurrentActiveTicket();
      if (activeTicket) {
        setTicket(activeTicket);
        await loadMessages(activeTicket.id);
        return;
      }

      const mostRecent = await getMostRecentTicket();
      if (mostRecent) {
        setTicket(mostRecent);
        await loadMessages(mostRecent.id);
      }
    } catch {
      setError('Failed to load health chat. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleCreateTicket() {
    if (!ticketPurpose.trim()) {
      setError('Please describe your health concern.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await createTicket(ticketPurpose.trim());
      if (result.success && result.chat) {
        setTicket(result.chat);
        setMessages([]);
        setShowCreateForm(false);
        setTicketPurpose('');
        if (result.chat.id) {
          await loadMessages(result.chat.id);
        }
      } else {
        setError(result.message || 'Failed to create ticket.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage() {
    const text = inputValue.trim();
    if (!ticket?.id) return;
    if (!text && !pendingImage) return;

    try {
      setIsLoading(true);
      setError(null);
      emitTyping(false);

      if (pendingImage) {
        setIsUploading(true);
        let filename: string;
        try {
          filename = await uploadFile(pendingImage.uri, pendingImage.name, pendingImage.type);
        } finally {
          setIsUploading(false);
        }
        const result = await sendMessage(ticket.id, text || null, filename, 'file');
        if (result.success && result.message) {
          setMessages((prev) => [...prev, result.message!]);
          setPendingImage(null);
          setInputValue('');
        }
      } else {
        const result = await sendMessage(ticket.id, text, null, 'text');
        if (result.success && result.message) {
          setMessages((prev) => [...prev, result.message!]);
          setInputValue('');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access your photo library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'image.jpg';
      const type = asset.mimeType ?? 'image/jpeg';
      setPendingImage({ uri: asset.uri, name, type });
    }
  }

  async function handleCloseTicket() {
    if (!ticket?.id) return;
    setShowCloseModal(false);

    try {
      setIsLoading(true);
      const result = await closeTicket(ticket.id);
      if (result.success) {
        setTicket((prev) => (prev ? { ...prev, status: 'Closed' } : null));
        await loadMessages(ticket.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to close ticket.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelTicket() {
    if (!ticket?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await closeTicket(ticket.id);
      if (result.success) {
        setTicket(null);
        setMessages([]);
      } else {
        setError(result.message || 'Failed to cancel request.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      if (text.length > 0) {
        emitTyping(true);
      } else {
        emitTyping(false);
      }
    },
    [emitTyping],
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const shouldShowLanding =
    !isInitializing &&
    (!ticket || ['Closed', 'Expired'].includes(ticket?.status));

  const groupedMessages = computeGrouping(messages);

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
        ]}
      >
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text
            style={[
              styles.loadingText,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            Loading health chat...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
    >
      {/* Error Banner */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : colors.error[50],
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : colors.error[200],
            },
          ]}
        >
          <Text style={[styles.errorBannerText, { color: isDark ? colors.error[400] : colors.error[600] }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Landing: No active ticket → CTA + previous conversation */}
      {shouldShowLanding && !showCreateForm && (
        <NewChatCTA
          ticket={ticket}
          messages={messages}
          onStartNew={() => setShowCreateForm(true)}
          formatTime={formatTime}
        />
      )}

      {/* Create Ticket Form */}
      {shouldShowLanding && showCreateForm && (
        <CreateTicketForm
          purpose={ticketPurpose}
          onPurposeChange={setTicketPurpose}
          onSubmit={handleCreateTicket}
          onCancel={() => {
            setShowCreateForm(false);
            setTicketPurpose('');
            setError(null);
          }}
          isLoading={isLoading}
          error={error}
        />
      )}

      {/* Active Chat — Open (pending) or Ongoing */}
      {!isInitializing && ticket && ['Open', 'Ongoing'].includes(ticket.status) && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex1}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Chat Header */}
          <ChatHeader
            ticketStatus={ticket.status}
            isSocketConnected={isSocketConnected}
            isStaffTyping={isStaffTyping}
            isLoading={isLoading}
            onRefresh={() => ticket?.id && loadMessages(ticket.id)}
            onOpenCloseModal={() => setShowCloseModal(true)}
          />

          {/* Status Banner */}
          <TicketStatusBanner
            status={ticket.status}
            purpose={ticket.purpose}
            isLoading={isLoading}
            onCancel={handleCancelTicket}
          />

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={scrollToBottom}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={async () => {
                  if (!ticket?.id) return;
                  setIsRefreshing(true);
                  await loadMessages(ticket.id);
                  setIsRefreshing(false);
                }}
                tintColor={colors.primary[500]}
              />
            }
            ListHeaderComponent={
              ticket.status === 'Ongoing' ? (
                <View style={styles.purposeHeader}>
                  <Text
                    style={[
                      styles.purposeLabel,
                      { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                    ]}
                  >
                    Consultation started{' '}
                    {ticket.session_start && formatTime(ticket.session_start)}
                  </Text>
                  <Text
                    style={[
                      styles.purposeText,
                      { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                    ]}
                  >
                    {ticket.purpose}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              ticket.status === 'Ongoing' ? (
                <View style={styles.emptyMessages}>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                    ]}
                  >
                    No messages yet. Start the conversation!
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              <TypingIndicator isTyping={isStaffTyping} />
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                formatTime={formatTime}
                isFirstInGroup={item.isFirstInGroup}
                isLastInGroup={item.isLastInGroup}
              />
            )}
          />

          {/* Input */}
          <ChatInput
            ticketStatus={ticket.status}
            inputValue={inputValue}
            isLoading={isLoading}
            isSocketConnected={isSocketConnected}
            onChangeText={handleInputChange}
            onSend={handleSendMessage}
            onPickImage={handlePickImage}
            pendingImage={pendingImage}
            onClearPendingImage={() => setPendingImage(null)}
            isUploading={isUploading}
          />

          {/* Close Ticket Confirmation Modal */}
          <ConfirmModal
            isOpen={showCloseModal}
            onClose={() => setShowCloseModal(false)}
            onConfirm={handleCloseTicket}
            title="End Consultation?"
            message="This will close the current health chat session. You can start a new one anytime."
            confirmText="End Session"
            cancelText="Keep Open"
            variant="danger"
          />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  // Error
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 13,
  },
  // Messages
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  purposeHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
  },
  purposeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  purposeText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default HealthChatScreen;
