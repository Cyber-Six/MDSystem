/**
 * EmptyState & NewChatCTA - Landing view when no active ticket
 * Shows previous conversation preview + start new consultation button
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import type { Ticket, TicketMessage } from '../../services/health-chat-service';

interface NewChatCTAProps {
  ticket: Ticket | null;
  messages: TicketMessage[];
  isHistoryLoading?: boolean;
  onStartNew: () => void;
  formatTime: (date?: string) => string;
}

const NewChatCTA: React.FC<NewChatCTAProps> = ({
  ticket,
  messages,
  isHistoryLoading = false,
  onStartNew,
  formatTime,
}) => {
  const { isDark } = useTheme();
  const hasPreviousTicket = !!(ticket && ['Closed', 'Expired'].includes(ticket.status));
  const hasPreviousConvo = hasPreviousTicket && messages.length > 0;
  const closedAt = ticket?.session_end ?? ticket?.archived_at ?? ticket?.expiresAt;

  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
      {/* Previous conversation preview */}
      {hasPreviousTicket && (
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
            PREVIOUS CONVERSATION
          </Text>

          <View
            style={[
              styles.previewBox,
              {
                backgroundColor: isDark
                  ? 'rgba(0,0,0,0.2)'
                  : colors.neutral[50],
              },
            ]}
          >
            {isHistoryLoading ? (
              <View style={styles.loadingHistoryBox}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text
                  style={[
                    styles.loadingHistoryText,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  Loading conversation history...
                </Text>
              </View>
            ) : hasPreviousConvo ? (
              <ScrollView
                nestedScrollEnabled
                style={styles.previewScroll}
                contentContainerStyle={styles.previewScrollContent}
                showsVerticalScrollIndicator
              >
                {messages.map((msg) => (
                  <View key={msg.id} style={styles.previewMsgRow}>
                    {msg.promptType === 'system' ? (
                      <View style={styles.systemPill}>
                        <Text
                          style={[
                            styles.systemText,
                            { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                          ]}
                        >
                          {msg.text || 'System message'}
                        </Text>
                      </View>
                    ) : (
                      <>
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
                            msg.userType === 'Patient'
                              ? { alignSelf: 'flex-end' }
                              : { alignSelf: 'flex-start' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.previewText,
                              msg.userType === 'Patient'
                                ? { color: colors.secondary[900] }
                                : {
                                    color: isDark
                                      ? colors.neutral[100]
                                      : colors.secondary[800],
                                  },
                            ]}
                          >
                            {msg.text || (msg.filename ? 'Attachment sent' : 'Message')}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.previewTime,
                            {
                              color: isDark ? colors.neutral[500] : colors.neutral[400],
                              alignSelf: msg.userType === 'Patient' ? 'flex-end' : 'flex-start',
                            },
                          ]}
                        >
                          {formatTime(msg.stamp)}
                        </Text>
                      </>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text
                style={[
                  styles.noHistoryText,
                  { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                ]}
              >
                No previous message history for this consultation.
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor: isDark
                    ? colors.neutral[700]
                    : colors.neutral[200],
                },
              ]}
            />
            <Text
              style={[
                styles.dividerText,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              {ticket!.status === 'Expired' ? 'Session expired' : 'Session closed'}
              {closedAt && ` · ${formatTime(closedAt)}`}
            </Text>
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor: isDark
                    ? colors.neutral[700]
                    : colors.neutral[200],
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* CTA Card */}
      <View
        style={[
          styles.card,
          styles.ctaCard,
          { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
        ]}
      >
        <View style={styles.ctaIconCircle}>
          <MaterialCommunityIcons name="stethoscope" size={30} color={colors.primary[500]} />
        </View>
        <Text
          style={[
            styles.ctaTitle,
            { color: isDark ? colors.neutral[100] : colors.secondary[800] },
          ]}
        >
          {hasPreviousTicket
            ? 'Start a new consultation'
            : 'Need to talk to our medical team?'}
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
          onPress={onStartNew}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>
            + {hasPreviousTicket ? 'New Consultation' : 'Start Health Chat'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollContent: {
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
    paddingVertical: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  previewBox: {
    borderRadius: 12,
    padding: 12,
  },
  previewScroll: {
    maxHeight: 260,
  },
  previewScrollContent: {
    paddingBottom: 4,
  },
  previewMsgRow: {
    marginBottom: 4,
  },
  previewBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '85%',
  },
  patientBubble: {
    backgroundColor: '#F4C430',
  },
  staffBubble: {
    borderWidth: 1,
  },
  systemPill: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewTime: {
    fontSize: 10,
    marginTop: 3,
  },
  noHistoryText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  loadingHistoryBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingHistoryText: {
    fontSize: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ctaIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(244,196,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  ctaSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
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
});

export default React.memo(NewChatCTA);
