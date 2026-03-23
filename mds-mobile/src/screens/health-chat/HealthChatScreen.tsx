/**
 * Health Chat Screen - Patient-to-Staff Chat
 * Mirrors mds-patient/src/modules/health-chat/health-chat.jsx
 *
 * Ticket-based health consultation system using GraphQL.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
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
} from '../../services/health-chat-service';

export const HealthChatScreen: React.FC = () => {
  const { isDark } = useTheme();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [ticketPurpose, setTicketPurpose] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const hasInitialized = useRef(false);

  // Load messages for a ticket
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const fetchedMessages = await getTicketMessages(chatId);
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeHealthChat();
  }, []);

  // Poll for ticket status when pending (Open)
  useEffect(() => {
    if (!ticket?.id || ticket?.status !== 'Open') return;

    const pollInterval = setInterval(async () => {
      try {
        const updatedTicket = await getCurrentActiveTicket();
        if (updatedTicket && updatedTicket.status !== 'Open') {
          setTicket(updatedTicket);
          if (updatedTicket.id) {
            await loadMessages(updatedTicket.id);
          }
        }
      } catch (err) {
        console.error('[HealthChat] Polling failed:', err);
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [ticket?.id, ticket?.status, loadMessages]);

  // Poll for new messages when ticket is Ongoing
  useEffect(() => {
    if (!ticket?.id || ticket?.status !== 'Ongoing') return;

    const pollInterval = setInterval(async () => {
      try {
        await loadMessages(ticket.id);
      } catch (err) {
        console.error('[HealthChat] Message polling failed:', err);
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [ticket?.id, ticket?.status, loadMessages]);

  async function initializeHealthChat() {
    try {
      setIsInitializing(true);
      setError(null);

      // Try to get an active ticket
      const activeTicket = await getCurrentActiveTicket();
      if (activeTicket) {
        setTicket(activeTicket);
        await loadMessages(activeTicket.id);
        return;
      }

      // If no active ticket, load most recent
      const mostRecent = await getMostRecentTicket();
      if (mostRecent) {
        setTicket(mostRecent);
        await loadMessages(mostRecent.id);
      }
    } catch (err) {
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
    const hasText = inputValue.trim().length > 0;
    if (!hasText || !ticket?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await sendMessage(ticket.id, inputValue.trim(), null, 'text');
      if (result.success && result.message) {
        setMessages(prev => [...prev, result.message!]);
        setInputValue('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCloseTicket() {
    if (!ticket?.id) return;
    setShowCloseModal(false);

    try {
      setIsLoading(true);
      const result = await closeTicket(ticket.id);
      if (result.success) {
        setTicket(prev => (prev ? { ...prev, status: 'Closed' } : null));
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

  function formatTime(dateStr?: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const shouldShowCreateForm =
    !isInitializing &&
    (!ticket || ['Closed', 'Expired'].includes(ticket?.status));

  // ── Loading State ──
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

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary[500] }]}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>💬</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Health Chat</Text>
          <Text style={styles.headerSubtitle}>Talk to our medical team, anytime</Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
            },
          ]}
        >
          <Text style={[styles.errorBannerText, { color: colors.error[600] }]}>
            ⚠ {error}
          </Text>
        </View>
      )}

      {/* Create Ticket CTA / Previous conversation */}
      {shouldShowCreateForm && !showCreateForm && (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.ctaContainer}
        >
          {/* Previous conversation preview */}
          {ticket && ['Closed', 'Expired'].includes(ticket.status) && messages.length > 0 && (
            <View
              style={[
                styles.card,
                { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
              ]}
            >
              <Text
                style={[
                  styles.sectionLabel,
                  { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                ]}
              >
                Previous conversation
              </Text>
              <View
                style={[
                  styles.previousMessages,
                  { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : colors.neutral[50] },
                ]}
              >
                {messages.slice(-5).map((msg) => (
                  <View key={msg.id} style={styles.previewMessage}>
                    {msg.promptType === 'system' ? (
                      <View style={styles.systemMsgContainer}>
                        <Text
                          style={[
                            styles.systemMsgText,
                            { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.previewBubble,
                          msg.userType === 'Patient'
                            ? styles.patientBubble
                            : [
                                styles.staffBubble,
                                {
                                  backgroundColor: isDark
                                    ? colors.neutral[700]
                                    : '#FFFFFF',
                                  borderColor: isDark
                                    ? colors.neutral[600]
                                    : colors.neutral[200],
                                },
                              ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.previewBubbleText,
                            msg.userType === 'Patient'
                              ? styles.patientBubbleText
                              : {
                                  color: isDark
                                    ? colors.neutral[100]
                                    : colors.secondary[800],
                                },
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Closed/Expired divider */}
              <View style={styles.ticketDivider}>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                  ]}
                />
                <Text
                  style={[
                    styles.dividerLabel,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  {ticket.status === 'Expired' ? 'Session expired' : 'Session closed'}
                  {ticket.session_end && ` · ${formatTime(ticket.session_end)}`}
                </Text>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                  ]}
                />
              </View>
            </View>
          )}

          {/* CTA */}
          <View
            style={[
              styles.card,
              styles.ctaCard,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
          >
            <View style={styles.ctaIconCircle}>
              <Text style={styles.ctaIcon}>🩺</Text>
            </View>
            <Text
              style={[
                styles.ctaTitle,
                { color: isDark ? colors.neutral[100] : colors.secondary[800] },
              ]}
            >
              {ticket ? 'Start a new consultation' : 'Need to talk to our medical team?'}
            </Text>
            <Text
              style={[
                styles.ctaSubtitle,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              Ask questions, share concerns — we're here to help.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => setShowCreateForm(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>
                + {ticket ? 'New Consultation' : 'Start Health Chat'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Create Ticket Form */}
      {shouldShowCreateForm && showCreateForm && (
        <View style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <View
              style={[
                styles.card,
                { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
              ]}
            >
              <Text
                style={[
                  styles.formTitle,
                  { color: isDark ? colors.neutral[100] : colors.secondary[800] },
                ]}
              >
                Tell us what's on your mind
              </Text>
              <Text
                style={[
                  styles.formSubtitle,
                  { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                ]}
              >
                Be as detailed as you'd like — the more context, the better we can help.
              </Text>

              <TextInput
                value={ticketPurpose}
                onChangeText={setTicketPurpose}
                placeholder="e.g. I've had a headache for 3 days and it's not getting better..."
                placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                multiline
                numberOfLines={4}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
                    color: isDark ? colors.neutral[100] : colors.secondary[800],
                    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                  },
                ]}
                editable={!isLoading}
              />

              <Text
                style={[
                  styles.charCount,
                  { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                ]}
              >
                {ticketPurpose.length > 0
                  ? `${ticketPurpose.length} characters`
                  : 'Tip: include duration, severity, and any relevant history'}
              </Text>

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[
                    styles.cancelFormBtn,
                    {
                      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                    },
                  ]}
                  onPress={() => {
                    setShowCreateForm(false);
                    setTicketPurpose('');
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.cancelFormText,
                      { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitFormBtn,
                    {
                      opacity: isLoading || !ticketPurpose.trim() ? 0.4 : 1,
                    },
                  ]}
                  onPress={handleCreateTicket}
                  disabled={isLoading || !ticketPurpose.trim()}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.secondary[900]} />
                  ) : (
                    <Text style={styles.submitFormText}>Send Request →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Active Chat - Open (pending) or Ongoing */}
      {!isInitializing && ticket && ['Open', 'Ongoing'].includes(ticket.status) && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex1}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Status Banner */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor:
                  ticket.status === 'Open'
                    ? isDark
                      ? 'rgba(245, 158, 11, 0.1)'
                      : '#FFFBEB'
                    : isDark
                      ? 'rgba(34, 197, 94, 0.1)'
                      : '#F0FDF4',
                borderColor:
                  ticket.status === 'Open'
                    ? isDark
                      ? 'rgba(245, 158, 11, 0.3)'
                      : '#FDE68A'
                    : isDark
                      ? 'rgba(34, 197, 94, 0.3)'
                      : '#BBF7D0',
              },
            ]}
          >
            <View style={styles.statusBannerContent}>
              <Text style={styles.statusIcon}>
                {ticket.status === 'Open' ? '⏳' : '✅'}
              </Text>
              <View style={styles.statusTextContainer}>
                <Text
                  style={[
                    styles.statusTitle,
                    {
                      color:
                        ticket.status === 'Open'
                          ? isDark
                            ? '#FBBF24'
                            : '#92400E'
                          : isDark
                            ? '#4ADE80'
                            : '#166534',
                    },
                  ]}
                >
                  {ticket.status === 'Open'
                    ? 'Waiting for medical staff...'
                    : 'Connected with medical staff'}
                </Text>
                <Text
                  style={[
                    styles.statusMessage,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  {ticket.status === 'Open'
                    ? 'Your request is being reviewed. You will be connected soon.'
                    : `Purpose: ${ticket.purpose}`}
                </Text>
              </View>
            </View>
            {ticket.status === 'Open' && (
              <TouchableOpacity
                style={styles.cancelTicketBtn}
                onPress={handleCancelTicket}
                disabled={isLoading}
              >
                <Text style={styles.cancelTicketText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => ticket?.id && loadMessages(ticket.id)}
              />
            }
          >
            {/* Purpose header */}
            <View style={styles.purposeHeader}>
              <Text
                style={[
                  styles.purposeLabel,
                  { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                ]}
              >
                Consultation started {ticket.session_start && formatTime(ticket.session_start)}
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

            {/* Messages list */}
            {messages.map((msg) => (
              <View key={msg.id}>
                {msg.promptType === 'system' ? (
                  <View style={styles.systemMsgContainer}>
                    <Text
                      style={[
                        styles.systemMsgText,
                        { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.messageRow,
                      msg.userType === 'Patient'
                        ? styles.messageRowRight
                        : styles.messageRowLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        msg.userType === 'Patient'
                          ? styles.patientBubble
                          : [
                              styles.staffBubble,
                              {
                                backgroundColor: isDark
                                  ? colors.neutral[800]
                                  : '#FFFFFF',
                                borderColor: isDark
                                  ? colors.neutral[700]
                                  : colors.neutral[200],
                              },
                            ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          msg.userType === 'Patient'
                            ? styles.patientBubbleText
                            : {
                                color: isDark
                                  ? colors.neutral[100]
                                  : colors.secondary[800],
                              },
                        ]}
                      >
                        {msg.text}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.messageTime,
                        msg.userType === 'Patient'
                          ? styles.timeRight
                          : styles.timeLeft,
                        { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                      ]}
                    >
                      {formatTime(msg.stamp)}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {messages.length === 0 && ticket.status === 'Ongoing' && (
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
            )}
          </ScrollView>

          {/* Input Bar (only for Ongoing tickets) */}
          {ticket.status === 'Ongoing' && (
            <View
              style={[
                styles.inputBar,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            >
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
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
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: colors.primary[500],
                    opacity: !inputValue.trim() || isLoading ? 0.4 : 1,
                  },
                ]}
                onPress={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.secondary[900]} />
                ) : (
                  <Text style={styles.sendButtonText}>→</Text>
                )}
              </TouchableOpacity>

              {/* Close ticket button */}
              <TouchableOpacity
                style={styles.closeTicketBtn}
                onPress={() => setShowCloseModal(true)}
              >
                <Text style={styles.closeTicketIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Close Ticket Confirmation Modal */}
          {showCloseModal && (
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                >
                  End Consultation?
                </Text>
                <Text
                  style={[
                    styles.modalMessage,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  This will close the current health chat session. You can start a new one
                  anytime.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalCancelBtn,
                      {
                        borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                      },
                    ]}
                    onPress={() => setShowCloseModal(false)}
                  >
                    <Text
                      style={[
                        styles.modalCancelText,
                        { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                      ]}
                    >
                      Keep Open
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalCloseBtn, { backgroundColor: colors.error[500] }]}
                    onPress={handleCloseTicket}
                  >
                    <Text style={styles.modalCloseText}>End Session</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
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
  // CTA
  ctaContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  ctaCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  previousMessages: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    maxHeight: 200,
  },
  previewMessage: {
    marginBottom: 4,
  },
  previewBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '85%',
  },
  previewBubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  ctaIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(244,196,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaIcon: {
    fontSize: 28,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#F4C430',
    elevation: 3,
    shadowColor: '#F4C430',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary[900],
  },
  // Create Form
  formContainer: {
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  textArea: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelFormText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitFormBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F4C430',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#F4C430',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  submitFormText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary[900],
  },
  // Status Banner
  statusBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusMessage: {
    fontSize: 12,
    marginTop: 2,
  },
  cancelTicketBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cancelTicketText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
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
  systemMsgContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  systemMsgText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageRow: {
    marginBottom: 4,
  },
  messageRowRight: {
    alignItems: 'flex-end',
  },
  messageRowLeft: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  patientBubble: {
    backgroundColor: '#F4C430',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  patientBubbleText: {
    color: colors.secondary[900],
  },
  staffBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 2,
  },
  timeRight: {
    textAlign: 'right',
  },
  timeLeft: {
    textAlign: 'left',
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
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
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary[900],
  },
  closeTicketBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTicketIcon: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HealthChatScreen;
