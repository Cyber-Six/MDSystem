/**
 * FAQs Screen
 * Patient FAQ with up-to-date website and mobile feature guidance.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const FAQ_DATA = [
  {
    q: 'What can I do on both the website and mobile app?',
    a: 'Both platforms support the main patient flows: record update, appointment booking, Health Chat, medicine requests, announcements, documents, and account settings.',
  },
  {
    q: 'Are website and mobile data synced?',
    a: 'Yes. The website and mobile app use the same patient account and backend data. Actions like appointment requests, chat updates, medicine requests, and document submissions appear on both after refresh.',
  },
  {
    q: 'Why are some modules hidden or locked?',
    a: 'If your initial record is still required or your account is inactive, access is restricted until the required record flow is completed and approved by staff.',
  },
  {
    q: 'How do appointments work on website and mobile?',
    a: 'Use Appointments to pick a schedule, choose date/session, upload requirements (image, PDF, or supported video), add a purpose when required, and submit. You can cancel pending or scheduled appointments from the same module.',
  },
  {
    q: 'How does Health Chat work?',
    a: 'Create a ticket with your health concern, then continue in real-time chat once staff joins. You can send messages with attachments, extend an expiring session, close the ticket, and review previous sessions.',
  },
  {
    q: 'How do medicine requests work?',
    a: 'In Medicine Request, set your branch (auto-selected for some campus emails), choose medicines, provide your purpose, and submit. If you already have a pending request, you can cancel and resubmit a new one.',
  },
  {
    q: 'How do My Documents and document requests work?',
    a: 'My Documents lets you upload requested files, track statuses (Requested, Pending, Recorded, Rejected), and open issued clinic documents directly in the app.',
  },
  {
    q: 'How do notification preferences work?',
    a: 'Open Settings to manage push, email, and email fallback channels globally and per module (appointments, health chat, medicine requests, documents, EMR, and general announcements).',
  },
  {
    q: 'What security controls are available?',
    a: 'In Settings > Security, you can manage password updates and authenticator-based two-factor authentication (2FA). Some password verification flows may use email OTP when required.',
  },
  {
    q: 'What features are currently easier to access on the website?',
    a: 'The website user menu includes Login Activity, Contact Support, and Feedback options. Mobile focuses on core patient care flows plus announcements and documents.',
  },
];

export const FAQsScreen: React.FC = () => {
  const { isDark } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View
      style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerBanner, { backgroundColor: colors.accent[500] }]}>
          <Ionicons name="help-circle" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
            <Text style={styles.headerSubtitle}>Find answers to common questions</Text>
          </View>
        </View>

        {FAQ_DATA.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.faqItem,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: isOpen
                    ? colors.primary[500]
                    : isDark
                    ? colors.neutral[700]
                    : colors.neutral[200],
                },
              ]}
              onPress={() => setOpenIndex(isOpen ? null : i)}
              activeOpacity={0.8}
            >
              <View style={styles.questionRow}>
                <Text
                  style={[
                    styles.questionText,
                    {
                      color: isDark ? colors.neutral[100] : colors.secondary[900],
                    },
                  ]}
                >
                  {item.q}
                </Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
              </View>
              {isOpen && (
                <Text
                  style={[
                    styles.answerText,
                    { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                  ]}
                >
                  {item.a}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
  },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  faqItem: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  questionText: { fontSize: 15, fontWeight: '500', flex: 1 },
  answerText: { fontSize: 14, lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
});

export default FAQsScreen;
