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
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, colors } from '../../context/ThemeContext';
import { useHealthChatBadge } from '../../context/HealthChatNotificationProvider';
import {
  Ticket,
  TicketMessage,
  getCurrentActiveTicket,
  getMostRecentTicket,
  getMyTickets,
  getTicketMessages,
  createTicket,
  sendMessage,
  closeTicket,
  uploadFile,
  extendSession,
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
  const { clearBadge } = useHealthChatBadge();

  // Clear notification badge whenever this screen comes into focus
  useFocusEffect(useCallback(() => {
    clearBadge();
  }, [clearBadge]));

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

  // ── Previous tickets history (for landing view) ───────────────────────────
  const [previousTickets, setPreviousTickets] = useState<Ticket[]>([]);

  // ── Session expiry warning ────────────────────────────────────────────────
  const [isSessionExpiringSoon, setIsSessionExpiringSoon] = useState(false);
  const [isExtendingSession, setIsExtendingSession] = useState(false);

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

  // ── Session expiry warning: show if < 24h remaining ───────────────────────
  useEffect(() => {
    if (!ticket?.expiresAt || ticket.status !== 'Ongoing') {
      setIsSessionExpiringSoon(false);
      return;
    }
    const msRemaining = new Date(ticket.expiresAt).getTime() - Date.now();
    setIsSessionExpiringSoon(msRemaining > 0 && msRemaining < 24 * 60 * 60 * 1000);
  }, [ticket?.expiresAt, ticket?.status]);

  // ── Load previous tickets when landing is visible ─────────────────────────
  const loadPreviousTickets = useCallback(async () => {
    try {
      const [closedResult, expiredResult] = await Promise.allSettled([
        getMyTickets('Closed', 0, 10),
        getMyTickets('Expired', 0, 10),
      ]);
      const closed = closedResult.status === 'fulfilled' ? (closedResult.value?.chats ?? []) : [];
      const expired = expiredResult.status === 'fulfilled' ? (expiredResult.value?.chats ?? []) : [];
      const merged = [...closed, ...expired].sort(
        (a, b) =>
          new Date(b.session_start ?? b.session_end ?? '').getTime() -
          new Date(a.session_start ?? a.session_end ?? '').getTime(),
      );
      setPreviousTickets(merged.slice(0, 5));
    } catch {}
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

  // ── Session extension ─────────────────────────────────────────────────────
  async function handleExtendSession() {
    if (!ticket?.id) return;
    setIsExtendingSession(true);
    setError(null);
    try {
      const result = await extendSession(ticket.id);
      if (result.success && result.chat?.expiresAt) {
        setTicket((prev) =>
          prev ? { ...prev, expiresAt: result.chat!.expiresAt } : null,
        );
        setIsSessionExpiringSoon(false);
      } else {
        setError(result.message || 'Failed to extend session.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extend session.');
    } finally {
      setIsExtendingSession(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const shouldShowLanding =
    !isInitializing &&
    (!ticket || ['Closed', 'Expired'].includes(ticket?.status));

  // Load previous tickets when landing is visible
  useEffect(() => {
    if (shouldShowLanding) loadPreviousTickets();
  }, [shouldShowLanding, loadPreviousTickets]);

  const groupedMessages = computeGrouping(messages);

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
        ]}
        edges={['top']}
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
      edges={['top']}
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

      {/* Landing: No active ticket → previous tickets list + CTA */}
      {shouldShowLanding && !showCreateForm && (
        <>
          <NewChatCTA
            ticket={ticket}
            messages={messages}
            onStartNew={() => setShowCreateForm(true)}
            formatTime={formatTime}
          />
          {/* Previous sessions list (mirrors mds-patient previous tickets section) */}
          {previousTickets.length > 0 && (
            <View style={[styles.prevTicketsContainer, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
              <Text style={[styles.prevTicketsLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                PREVIOUS SESSIONS
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {previousTickets.map((t) => (
                  <View
                    key={t.id}
                    style={[
                      styles.prevTicketCard,
                      { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
                    ]}
                  >
                    <View style={[
                      styles.prevTicketBadge,
                      { backgroundColor: t.status === 'Expired' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)' },
                    ]}>
                      <Text style={[
                        styles.prevTicketStatus,
                        { color: t.status === 'Expired' ? colors.error[600] : colors.success[600] },
                      ]}>
                        {t.status}
                      </Text>
                    </View>
                    <Text style={[styles.prevTicketPurpose, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]} numberOfLines={2}>
                      {t.purpose}
                    </Text>
                    {(t.session_end ?? t.session_start) && (
                      <Text style={[styles.prevTicketDate, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
                        {formatTime(t.session_end ?? t.session_start)}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </>
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
          behavior="padding"
          style={styles.flex1}
          keyboardVerticalOffset={0}
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

          {/* Session expiry warning banner */}
          {isSessionExpiringSoon && ticket.status === 'Ongoing' && (
            <View
              style={[
                styles.expiryBanner,
                {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB',
                  borderColor: isDark ? 'rgba(245,158,11,0.4)' : '#FDE68A',
                },
              ]}
            >
              <Text style={{ fontSize: 16 }}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.expiryTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Session expiring soon
                </Text>
                {ticket.expiresAt && (
                  <Text style={[styles.expirySubtitle, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                    Expires {new Date(ticket.expiresAt).toLocaleString('en-PH', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.extendBtn, { opacity: isExtendingSession ? 0.6 : 1 }]}
                onPress={handleExtendSession}
                disabled={isExtendingSession}
                activeOpacity={0.8}
              >
                {isExtendingSession ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.extendBtnText}>Extend</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

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
                colors={[colors.primary[500]]}
                tintColor={colors.primary[500]}
                progressBackgroundColor={colors.secondary[900]}
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

  // Session expiry warning banner
  expiryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  expiryTitle: { fontSize: 13, fontWeight: '600' },
  expirySubtitle: { fontSize: 12 },
  extendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.accent[500],
    minWidth: 64,
    alignItems: 'center',
  },
  extendBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  // Previous tickets
  prevTicketsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  prevTicketsLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  prevTicketCard: {
    width: 180,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    gap: 6,
  },
  prevTicketBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prevTicketStatus: { fontSize: 11, fontWeight: '700' },
  prevTicketPurpose: { fontSize: 13, lineHeight: 18 },
  prevTicketDate: { fontSize: 11 },
});

export default HealthChatScreen;
