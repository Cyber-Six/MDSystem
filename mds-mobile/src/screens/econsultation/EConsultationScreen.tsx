/**
 * E-Consultation Screen - AI Chat
 * Mirrors mds-patient e-consultation module
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import {
  ChatMessage,
  checkHealth,
  createNewSession,
  fetchHistory,
  getSessionId,
  sendMessageStreaming,
  cancelGeneration,
  clearChat,
} from '../../services/econsultation-service';

const GUIDELINES = [
  'This AI assistant provides general health information only.',
  'It does not replace professional medical advice.',
  'Do not share sensitive personal information.',
  'In case of emergency, contact your healthcare provider immediately.',
];

export const EConsultationScreen: React.FC = () => {
  const { isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthOk, setHealthOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(true);

  // ── Initialize ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const ok = await checkHealth();
        setHealthOk(ok);
        if (!ok) { setLoading(false); return; }

        const existing = await getSessionId();
        if (existing) {
          setSessionId(existing);
          const history = await fetchHistory(existing);
          setMessages(history);
          if (history.length > 0) setShowGuidelines(false);
        }
      } catch {
        // No existing session
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Scroll to end ──────────────────────────────────────────────────────────

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput('');
    setError(null);
    setShowGuidelines(false);

    let currentSession = sessionId;
    if (!currentSession) {
      try {
        const result = await createNewSession();
        currentSession = result.sessionId;
        setSessionId(currentSession);
        setMessages(result.messages);
      } catch (err: any) {
        setError('Failed to create session: ' + err.message);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToEnd();

    // Streaming placeholder
    const streamingId = 'streaming-' + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: streamingId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendMessageStreaming(
        currentSession!,
        trimmed,
        (content) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === streamingId ? { ...m, content } : m))
          );
          scrollToEnd();
        },
        (finalMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingId ? { ...finalMsg, isStreaming: false } : m
            )
          );
          setIsStreaming(false);
          abortRef.current = null;
          scrollToEnd();
        },
        (errMsg) => {
          setMessages((prev) => prev.filter((m) => m.id !== streamingId));
          setError(errMsg);
          setIsStreaming(false);
          abortRef.current = null;
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== streamingId));
        setError('Connection failed. Please try again.');
      }
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (sessionId) {
      try { await cancelGeneration(sessionId); } catch {}
    }
    setIsStreaming(false);
    // Remove incomplete streaming message
    setMessages((prev) => prev.filter((m) => !m.isStreaming));
  };

  const handleClear = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const result = await clearChat(sessionId);
      setSessionId(result.sessionId);
      setMessages(result.messages);
      setShowGuidelines(true);
    } catch (err: any) {
      setError('Failed to clear chat');
    } finally {
      setLoading(false);
    }
  };

  // ── Render message ─────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary[500] }]
            : [
                styles.assistantBubble,
                {
                  backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ],
        ]}
      >
        {!isUser && (
          <Text
            style={[
              styles.roleLabel,
              { color: isDark ? colors.accent[400] : colors.accent[600] },
            ]}
          >
            AI Assistant
          </Text>
        )}
        <Text
          style={[
            styles.messageText,
            {
              color: isUser
                ? '#FFFFFF'
                : isDark
                ? colors.neutral[200]
                : colors.neutral[800],
            },
          ]}
        >
          {item.content || (item.isStreaming ? '...' : '')}
        </Text>
        {item.isStreaming && (
          <ActivityIndicator
            size="small"
            color={isDark ? colors.accent[400] : colors.accent[600]}
            style={{ marginTop: 6, alignSelf: 'flex-start' }}
          />
        )}
      </View>
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
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
            Loading consultation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Service unavailable ────────────────────────────────────────────────────

  if (!healthOk) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
        ]}
        edges={['top']}
      >
        <View style={styles.centeredContainer}>
          <Text style={styles.unavailableIcon}>🔧</Text>
          <Text
            style={[
              styles.unavailableTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            Service Unavailable
          </Text>
          <Text
            style={[
              styles.unavailableText,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            The AI consultation service is currently unavailable. Please try again
            later.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={async () => {
              const ok = await checkHealth();
              setHealthOk(ok);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
              borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerEmoji}>🤖</Text>
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                ]}
              >
                AI Consultation
              </Text>
              <View style={styles.statusDot}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colors.success[500] },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  Online
                </Text>
              </View>
            </View>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              style={[
                styles.clearButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(239,68,68,0.15)'
                    : colors.error[50],
                },
              ]}
              onPress={handleClear}
            >
              <Text
                style={[styles.clearButtonText, { color: colors.error[500] }]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Error bar */}
        {error && (
          <View
            style={[
              styles.errorBar,
              {
                backgroundColor: isDark
                  ? 'rgba(239,68,68,0.15)'
                  : colors.error[50],
              },
            ]}
          >
            <Text style={{ color: colors.error[500], flex: 1, fontSize: 13 }}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text
                style={{
                  color: colors.error[500],
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages / Guidelines */}
        {showGuidelines && messages.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.guidelinesContainer}
          >
            <View
              style={[
                styles.guidelinesCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                },
              ]}
            >
              <Text style={styles.guidelinesIcon}>📋</Text>
              <Text
                style={[
                  styles.guidelinesTitle,
                  { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                ]}
              >
                Before you start
              </Text>
              {GUIDELINES.map((text, i) => (
                <View key={i} style={styles.guidelineRow}>
                  <View
                    style={[
                      styles.guidelineBullet,
                      { backgroundColor: colors.primary[500] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.guidelineText,
                      {
                        color: isDark
                          ? colors.neutral[300]
                          : colors.neutral[600],
                      },
                    ]}
                  >
                    {text}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={[
                styles.startHint,
                { color: isDark ? colors.neutral[500] : colors.neutral[400] },
              ]}
            >
              Type a message below to begin your consultation
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={scrollToEnd}
          />
        )}

        {/* Input bar */}
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
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
                color: isDark ? colors.neutral[100] : colors.neutral[900],
              },
            ]}
            placeholder="Type your health question..."
            placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            value={input}
            onChangeText={setInput}
            editable={!isStreaming}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          {isStreaming ? (
            <TouchableOpacity style={styles.cancelSendButton} onPress={handleCancel}>
              <Text style={styles.cancelSendText}>■</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    input.trim().length > 0
                      ? colors.primary[500]
                      : isDark
                      ? colors.neutral[700]
                      : colors.neutral[200],
                },
              ]}
              onPress={handleSend}
              disabled={!input.trim()}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  {
                    color:
                      input.trim().length > 0
                        ? '#FFFFFF'
                        : isDark
                        ? colors.neutral[500]
                        : colors.neutral[400],
                  },
                ]}
              >
                ↑
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },

  // Unavailable
  unavailableIcon: { fontSize: 48, marginBottom: 16 },
  unavailableTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  unavailableText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },
  clearButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  clearButtonText: { fontWeight: '600', fontSize: 13 },

  // Error
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },

  // Guidelines
  guidelinesContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  guidelinesCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  guidelinesIcon: { fontSize: 36, marginBottom: 12 },
  guidelinesTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  guidelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10, width: '100%' },
  guidelineBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  guidelineText: { flex: 1, fontSize: 14, lineHeight: 20 },
  startHint: { fontSize: 13, textAlign: 'center' },

  // Messages
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: { fontSize: 20, fontWeight: 'bold' },
  cancelSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSendText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default EConsultationScreen;
