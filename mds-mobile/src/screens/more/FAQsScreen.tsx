/**
 * FAQs Screen
 * Mirrors mds-patient faqs-modal.jsx with accordion-style Q&As
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

const FAQ_DATA = [
  {
    q: 'How do I book an appointment?',
    a: 'Navigate to the Appointments tab, select an appointment type, choose your preferred date and session, then submit your request.',
  },
  {
    q: 'How does Health Chat work?',
    a: 'Health Chat connects you directly with our medical team. Create a consultation ticket describing your concern, and a staff member will join the chat to assist you.',
  },
  {
    q: 'How do I request medicine?',
    a: 'Go to the Medicine tab, select your branch, describe your chief complaint, select the medicines you need with quantities, and submit your request.',
  },
  {
    q: 'Can I cancel my appointment?',
    a: 'Yes, you can cancel a pending or scheduled appointment from the Appointments screen. Once an appointment is in progress or completed, it cannot be cancelled.',
  },
  {
    q: 'How do I change my password?',
    a: 'Go to More > Change Password. Enter your current password and your new password to update it.',
  },
  {
    q: 'What is Two-Factor Authentication?',
    a: '2FA adds an extra layer of security by sending a verification code to your email during login. This helps protect your account even if your password is compromised.',
  },
  {
    q: 'How do I update my profile information?',
    a: 'Profile information is managed by the system administrator. Contact the clinic admin to request any changes to your personal information.',
  },
  {
    q: 'Who do I contact for technical issues?',
    a: 'You can reach out through the Contact Support option in the More menu, or email the support team directly.',
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
          <Text style={styles.headerIcon}>❓</Text>
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
                <Text
                  style={{
                    color: isDark ? colors.neutral[400] : colors.neutral[500],
                    fontSize: 16,
                  }}
                >
                  {isOpen ? '▲' : '▼'}
                </Text>
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
