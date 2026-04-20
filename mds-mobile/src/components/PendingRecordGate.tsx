/**
 * PendingRecordGate — Blocks screen content when the patient's initial record
 * is not yet approved.
 *
 * Three states:
 *   1. needsInitialRecord=true & no status  → "Complete Your Medical Record"
 *   2. status=Pending | RevisionSubmitted    → "Pending Approval" blocker
 *   3. status=Revision                       → "Revision Requested" blocker
 *
 * Parent screens wrap their content: <PendingRecordGate>{children}</PendingRecordGate>
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../context/ThemeContext';
import { useRecordStatus } from '../context/RecordStatusContext';

interface PendingRecordGateProps {
  children: React.ReactNode;
}

const PendingRecordGate: React.FC<PendingRecordGateProps> = ({ children }) => {
  const { isDark } = useTheme();
  const { recordStatus, isRecordLoading } = useRecordStatus();
  const navigation = useNavigation<any>();

  // While checking, show a small loader — don't block the whole screen for long
  if (isRecordLoading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          Checking record status...
        </Text>
      </View>
    );
  }

  const status = recordStatus?.status ?? null;

  // Inactive accounts must complete/update records before using gated modules.
  if (recordStatus?.credentialStatus === 'Inactive') {
    const INACTIVE_TICKET_EXPIRY_DAYS = 7;
    const hasSubmittedInactiveUpdate = status === 'Pending' || status === 'RevisionSubmitted';
    const needsInactiveRevision = status === 'Revision';
    const createdAtDate = recordStatus.ticketCreatedAt ? new Date(recordStatus.ticketCreatedAt) : null;
    const expiryDate = createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? new Date(createdAtDate.getTime() + INACTIVE_TICKET_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const expiryLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
      ? expiryDate.toLocaleDateString()
      : null;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}
        contentContainerStyle={styles.gateContent}
      >
        <View style={[styles.gateCard, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? 'rgba(241,197,38,0.3)' : colors.primary[200] }]}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(241,197,38,0.15)' : colors.primary[50] }]}>
            <Ionicons name="warning" size={30} color={isDark ? colors.primary[300] : colors.primary[700]} />
          </View>

          <Text style={[styles.gateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            {needsInactiveRevision
              ? 'Medical and Dental Revision Required'
              : hasSubmittedInactiveUpdate
                ? 'Medical and Dental Update Submitted'
                : 'Account Inactive - Update Required'}
          </Text>

          <Text style={[styles.gateMessage, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
            {needsInactiveRevision
              ? 'Your update needs revision before your account can be reactivated.'
              : hasSubmittedInactiveUpdate
                ? 'Your update is pending staff review. Your account remains inactive until approval.'
                : 'Your account is currently inactive. Submit your medical and dental updates to request reactivation.'}
          </Text>

          {needsInactiveRevision && recordStatus.notes && (
            <View style={[styles.staffNoteBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.12)' }]}>
              <Text style={[styles.staffNoteLabel, { color: isDark ? '#FBBF24' : '#92400E' }]}>Staff Notes</Text>
              <Text style={[styles.staffNoteText, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>
                {recordStatus.notes}
              </Text>
            </View>
          )}

          <View style={[styles.nextBox, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}> 
            <Text style={[styles.nextTitle, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>What happens next?</Text>
            <BulletItem isDark={isDark} text="Medical and dental sections must be completed before reactivation." />
            <BulletItem isDark={isDark} text="Your account stays inactive until staff approves the submitted update." />
            <BulletItem isDark={isDark} text="Please visit the clinic for in-person checking after submission." />
          </View>

          <View style={[styles.badgeRow, { backgroundColor: isDark ? 'rgba(241,197,38,0.1)' : colors.primary[50] }]}> 
            <Ionicons name="time" size={14} color={isDark ? colors.primary[300] : colors.primary[700]} />
            <Text style={[styles.statusText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>
              {needsInactiveRevision
                ? 'Status: Revision Required'
                : hasSubmittedInactiveUpdate
                  ? 'Status: Pending Inactive Review'
                  : 'Status: Inactive'}
            </Text>
          </View>

          <Text style={[styles.footerText, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}> 
            {expiryLabel
              ? `Ticket timing: In-progress updates expire after ${INACTIVE_TICKET_EXPIRY_DAYS} days (current window ends on ${expiryLabel}).`
              : `Ticket timing: In-progress updates expire after ${INACTIVE_TICKET_EXPIRY_DAYS} days.`}
          </Text>

          {(needsInactiveRevision || !hasSubmittedInactiveUpdate) && (
            <TouchableOpacity
              style={styles.fillFormButton}
              onPress={() => navigation.navigate('Records', { screen: 'UpdateRecordChoice' })}
              activeOpacity={0.8}
            >
              <Text style={styles.fillFormButtonText}>
                {needsInactiveRevision ? 'Continue Required Record Revision' : 'Start Required Record Update'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  // Not gated — render children normally
  if (!recordStatus?.needsInitialRecord) {
    return <>{children}</>;
  }

  // ── State A: Pending Approval ──────────────────────────────────────────────
  if (status === 'Pending') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}
        contentContainerStyle={styles.gateContent}
      >
        <View style={[styles.gateCard, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A' }]}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' }]}>
            <Ionicons name="time" size={30} color={isDark ? '#FBBF24' : '#92400E'} />
          </View>

          <Text style={[styles.gateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Initial Record Submitted Successfully
          </Text>

          <Text style={[styles.gateMessage, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
            Your initial medical record has been submitted. You need to visit the MDS clinic so the medical staff can verify your information.
          </Text>

          {/* What happens next */}
          <View style={[styles.nextBox, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
            <Text style={[styles.nextTitle, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>
              What happens next?
            </Text>
            <BulletItem isDark={isDark} text="Our medical staff will review your submitted information." />
            <BulletItem isDark={isDark} text="You'll be notified once your record is verified or if any corrections are needed." />
            <BulletItem isDark={isDark} text="Once verified, you'll have full access to the dashboard and all services." />
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7' }]}>
            <Ionicons name="time" size={14} color={isDark ? '#FBBF24' : '#92400E'} />
            <Text style={[styles.statusText, { color: isDark ? '#FBBF24' : '#92400E' }]}>
              Status: Pending Approval
            </Text>
          </View>

          <Text style={[styles.footerText, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
            You'll need to be verified within a week or else you'll have to re-submit your record. Thank you for your patience!
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── State B: Revision Submitted ────────────────────────────────────────────
  if (status === 'RevisionSubmitted') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}
        contentContainerStyle={styles.gateContent}
      >
        <View style={[styles.gateCard, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? 'rgba(59,130,246,0.3)' : colors.accent[200] }]}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : colors.accent[50] }]}>
            <Ionicons name="checkmark-circle" size={30} color={isDark ? colors.accent[300] : colors.accent[600]} />
          </View>

          <Text style={[styles.gateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Revision Submitted Successfully
          </Text>

          <Text style={[styles.gateMessage, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
            Your revised medical record has been submitted and is now awaiting re-review by the medical staff.
          </Text>

          <View style={[styles.nextBox, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
            <Text style={[styles.nextTitle, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>
              What happens next?
            </Text>
            <BulletItem isDark={isDark} text="Our medical staff will review your revised submission." />
            <BulletItem isDark={isDark} text="You'll be notified once your record is approved or if further corrections are needed." />
            <BulletItem isDark={isDark} text="Once approved, you'll have full access to the dashboard and all services." />
          </View>

          <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : colors.accent[50] }]}>
            <Ionicons name="clipboard" size={14} color={isDark ? colors.accent[300] : colors.accent[700]} />
            <Text style={[styles.statusText, { color: isDark ? colors.accent[300] : colors.accent[700] }]}>
              Status: Revision Submitted — Awaiting Review
            </Text>
          </View>

          <Text style={[styles.footerText, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
            Thank you for updating your record. A staff member will review it shortly.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── State C: Revision required / Initial record not yet submitted ──────────
  // (status is 'Revision' or null/undefined — user needs to fill the form)
  const isRevision = status === 'Revision';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}
      contentContainerStyle={styles.gateContent}
    >
      <View style={[styles.gateCard, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? 'rgba(241,197,38,0.3)' : colors.primary[200] }]}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(241,197,38,0.15)' : colors.primary[50] }]}>
          <Ionicons name={isRevision ? 'create' : 'clipboard'} size={30} color={isDark ? colors.primary[300] : colors.primary[700]} />
        </View>

        <Text style={[styles.gateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
          {isRevision ? 'Revise Your Medical Record' : 'Complete Your Medical Record'}
        </Text>

        <Text style={[styles.gateMessage, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
          {isRevision
            ? 'The medical staff has requested corrections to your medical record. Please review and update the information below.'
            : 'Please fill out your initial medical record to access the dashboard and all services.'}
        </Text>

        {/* Staff note for revision */}
        {isRevision && recordStatus.notes && (
          <View style={[styles.staffNoteBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.12)' }]}>
            <Text style={[styles.staffNoteLabel, { color: isDark ? '#FBBF24' : '#92400E' }]}>
              Staff Note
            </Text>
            <Text style={[styles.staffNoteText, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>
              {recordStatus.notes}
            </Text>
          </View>
        )}

        <View style={[styles.badgeRow, { backgroundColor: isDark ? 'rgba(241,197,38,0.1)' : colors.primary[50] }]}>
          <Ionicons name="lock-closed" size={14} color={isDark ? colors.primary[300] : colors.primary[700]} />
          <Text style={[styles.statusText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>
            {isRevision ? 'Revision Required' : 'Required for Access'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.fillFormButton}
          onPress={() =>
            navigation.navigate('Records', {
              screen: 'InitialRecordForm',
              params: { isRevision },
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.fillFormButtonText}>
            {isRevision ? 'Revise Medical Record' : 'Fill Out Medical Record'}
          </Text>
          <Text style={{ color: colors.secondary[900], fontSize: 16, marginLeft: 6 }}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ─── Small helper ────────────────────────────────────────────────────────────

const BulletItem: React.FC<{ isDark: boolean; text: string }> = ({ isDark, text }) => (
  <View style={styles.bulletRow}>
    <Text style={[styles.bullet, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>•</Text>
    <Text style={[styles.bulletText, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>{text}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  gateContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },
  gateCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconEmoji: {},
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  gateMessage: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  // What happens next
  nextBox: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingRight: 8,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  statusIcon: {},
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Staff note
  staffNoteBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  staffNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  staffNoteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Fill form CTA
  fillFormButton: {
    backgroundColor: colors.primary[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  fillFormButtonText: {
    color: colors.secondary[900],
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PendingRecordGate;
