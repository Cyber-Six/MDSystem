/**
 * Update Record Choice Screen
 *
 * Status-aware entry point for record updates:
 * - Approved users can choose Medical / Dental / Both updates
 * - Unverified users are prompted to complete initial medical record first
 * - Inactive users are forced to submit Both update for reactivation
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { getUpdateTicketStatus } from '../../services/emr-service';
import { TopBar } from '../../components/layout/TopBar';
import { toggleAppDrawer } from '../../navigation/drawer-utils';

interface UpdateTicket {
  id: string;
  status: string;
  scope: string;
  notes?: string;
}

interface Choice {
  id: 'medical' | 'dental' | 'both';
  title: string;
  description: string;
  iconName: string;
  iconLib?: 'Ionicons' | 'MCI';
  color: string;
}

const CHOICES: Choice[] = [
  {
    id: 'medical',
    title: 'Medical update',
    description: 'Update your medical history and health information',
    iconName: 'stethoscope',
    iconLib: 'MCI',
    color: colors.primary[500],
  },
  {
    id: 'dental',
    title: 'Dental update',
    description: 'Update your dental history and teeth records',
    iconName: 'tooth',
    iconLib: 'MCI',
    color: colors.success[500],
  },
  {
    id: 'both',
    title: 'Both records',
    description: 'Update both medical and dental information',
    iconName: 'clipboard',
    iconLib: 'Ionicons',
    color: colors.accent[500],
  },
];

interface UpdateRecordChoiceScreenProps {
  navigation: any;
}

export const UpdateRecordChoiceScreen: React.FC<UpdateRecordChoiceScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { recordStatus } = useRecordStatus();
  const [ticket, setTicket] = useState<UpdateTicket | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(true);
  const hasAutoRedirected = useRef(false);
  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

  const handleTopBarBack = () => {
    if (canGoBack) {
      navigation.goBack();
      return;
    }
    toggleAppDrawer(navigation);
  };

  const mapScopeToRecordType = (scope?: string): Choice['id'] | undefined => {
    if (!scope) return undefined;
    const normalized = scope.toLowerCase();
    if (normalized === 'medical') return 'medical';
    if (normalized === 'dental') return 'dental';
    if (normalized === 'both') return 'both';
    return undefined;
  };

  const loadTicketStatus = useCallback(async () => {
    setIsLoadingTicket(true);
    hasAutoRedirected.current = false;
    try {
      const currentTicket = await getUpdateTicketStatus();
      setTicket(currentTicket);

      // Auto-redirect: if revision is active, go straight to the form with the revision scope
      if (currentTicket?.status === 'Revision') {
        const revisionScope = mapScopeToRecordType(currentTicket.scope) ?? 'both';
        hasAutoRedirected.current = true;
        navigation.navigate('InitialRecordForm', {
          isUpdate: true,
          isRevision: true,
          recordType: revisionScope,
        });
      }
    } catch {
      setTicket(null);
    } finally {
      setIsLoadingTicket(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadTicketStatus();
    }, [loadTicketStatus])
  );

  const currentStatus = ticket?.status ?? recordStatus?.status ?? null;
  const isInactiveCredential = recordStatus?.credentialStatus === 'Inactive';
  const requiresInitialRecord = Boolean(recordStatus?.needsInitialRecord) && !isInactiveCredential;

  const pendingStatuses = new Set(['Pending', 'UnderReview', 'In Review', 'RevisionSubmitted']);
  const isPending = currentStatus ? pendingStatuses.has(currentStatus) : false;
  const isRevision = currentStatus === 'Revision';

  const disabledChoiceIds = new Set<Choice['id']>();
  if (isInactiveCredential) {
    disabledChoiceIds.add('medical');
    disabledChoiceIds.add('dental');
  }
  if (requiresInitialRecord) {
    disabledChoiceIds.add('medical');
    disabledChoiceIds.add('dental');
    disabledChoiceIds.add('both');
  }

  const startInitialRecordFlow = () => {
    navigation.navigate('InitialRecordForm', {
      isRevision,
    });
  };

  const handleSelect = (choice: Choice) => {
    if (disabledChoiceIds.has(choice.id)) {
      return;
    }

    if (requiresInitialRecord) {
      startInitialRecordFlow();
      return;
    }

    const revisionScope = mapScopeToRecordType(ticket?.scope);
    const selectedRecordType = isRevision
      ? revisionScope ?? (isInactiveCredential ? 'both' : choice.id)
      : (isInactiveCredential ? 'both' : choice.id);

    navigation.navigate('InitialRecordForm', {
      isUpdate: true,
      isRevision,
      recordType: selectedRecordType,
    });
  };

  const headerTitle = requiresInitialRecord
    ? 'Medical Record Required'
    : isInactiveCredential
      ? 'Account Reactivation Update'
      : 'Choose Update Type';

  const headerSubtitle = requiresInitialRecord
    ? 'Complete your initial medical record before accessing domain modules.'
    : isInactiveCredential
      ? 'Submit medical and dental updates to reactivate your account.'
      : 'Select which records you want to update.';

  const notes = ticket?.notes ?? recordStatus?.notes ?? null;

  // Inactive patients who already submitted must wait for approval — block re-submission.
  // Matches mds-patient where Record Update is also disabled after submission.
  const hasSubmittedInactiveUpdate = isInactiveCredential
    && (currentStatus === 'Pending' || currentStatus === 'RevisionSubmitted');

  if (hasSubmittedInactiveUpdate && !isLoadingTicket) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
        edges={['top', 'left', 'right']}
      >
        <TopBar
          title="Update Record"
          showBack={canGoBack}
          onBack={handleTopBarBack}
          onMenuPress={() => toggleAppDrawer(navigation)}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.stateCard, {
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            borderColor: isDark ? 'rgba(241,197,38,0.3)' : colors.primary[200],
          }]}>
            <View style={[styles.stateIcon, { backgroundColor: isDark ? 'rgba(241,197,38,0.15)' : colors.primary[100] }]}>
              <Ionicons name="time" size={24} color={isDark ? colors.primary[300] : colors.primary[700]} />
            </View>
            <Text style={[styles.stateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
              Medical and Dental Update Submitted
            </Text>
            <Text style={[styles.stateBody, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
              Your update is pending staff review. Your account remains inactive until approval.
              You cannot submit another update while one is already under review.
            </Text>

            <View style={[styles.infoCard, {
              backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
              borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
            }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary[500]} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>What happens next?</Text>
                <Text style={[styles.infoBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                  Medical and dental sections will be reviewed by clinic staff. Your account stays inactive until staff approves the submitted update. Please visit the clinic for in-person checking after submission.
                </Text>
              </View>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(241,197,38,0.1)' : colors.primary[50] }]}>
              <Ionicons name="time" size={14} color={isDark ? colors.primary[300] : colors.primary[700]} />
              <Text style={{ color: isDark ? colors.primary[300] : colors.primary[700], fontSize: 13, fontWeight: '600' }}>
                Status: Pending Inactive Review
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['top', 'left', 'right']}
    >
      <TopBar
        title="Update Record"
        showBack={canGoBack}
        onBack={handleTopBarBack}
        onMenuPress={() => toggleAppDrawer(navigation)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          {headerSubtitle}
        </Text>

        {isLoadingTicket && (
          <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginBottom: 12 }} />
        )}

        {requiresInitialRecord ? (
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
              },
            ]}
          >
            <View style={[styles.stateIcon, { backgroundColor: isDark ? colors.primary[900] : colors.primary[100] }]}>
              <Ionicons
                name={isPending ? 'time' : isRevision ? 'create' : 'clipboard'}
                size={24}
                color={isDark ? colors.primary[300] : colors.primary[700]}
              />
            </View>
            <Text style={[styles.stateTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
              {isPending
                ? 'Initial Record Under Review'
                : isRevision
                  ? 'Initial Record Revision Required'
                  : 'Initial Medical Record Needed'}
            </Text>
            <Text style={[styles.stateBody, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
              {isPending
                ? 'Your initial medical record was submitted successfully and is now awaiting staff verification. Access to domain modules remains locked until approval.'
                : isRevision
                  ? 'A staff member requested corrections to your initial medical record. Continue your revision to complete verification.'
                  : 'Please complete your initial medical record first. Domain modules will unlock once your record is submitted and approved.'}
            </Text>

            {Boolean(notes) && (
              <View
                style={[
                  styles.notesCard,
                  {
                    backgroundColor: isDark ? 'rgba(241,197,38,0.12)' : colors.primary[50],
                    borderColor: isDark ? 'rgba(241,197,38,0.35)' : colors.primary[200],
                  },
                ]}
              >
                <Text style={[styles.notesLabel, { color: isDark ? colors.primary[300] : colors.primary[800] }]}>Staff Notes</Text>
                <Text style={[styles.notesText, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>{notes}</Text>
              </View>
            )}

            {!isPending && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={startInitialRecordFlow}
                activeOpacity={0.82}
              >
                <Text style={styles.primaryButtonText}>{isRevision ? 'Continue Revision' : 'Fill Out Medical Record'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {isInactiveCredential && (
              <View style={[styles.banner, styles.bannerInfo]}>
                <Ionicons name="shield-checkmark" size={22} color="#92400E" style={styles.bannerIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Inactive Account Recovery Mode</Text>
                  <Text style={styles.bannerBody}>
                    Only the Both Update option is available while your account is inactive.
                  </Text>
                </View>
              </View>
            )}

            {isRevision && (
              <View style={[styles.banner, styles.bannerRevision]}>
                <Ionicons name="create" size={22} color="#92400E" style={styles.bannerIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Revision Requested</Text>
                  <Text style={styles.bannerBody}>
                    A staff member requested updates to your submission.
                    {notes ? ` Notes: "${notes}"` : ''}
                  </Text>
                </View>
              </View>
            )}

            {isPending && (
              <View style={[styles.banner, styles.bannerPending]}>
                <Ionicons name="time" size={22} color="#1D4ED8" style={styles.bannerIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Update Pending Review</Text>
                  <Text style={styles.bannerBody}>
                    Your {ticket?.scope || 'record'} update is under review. You can still submit a new update, and your previous pending request will be replaced.
                  </Text>
                </View>
              </View>
            )}

            {CHOICES.map((choice) => {
              const disabled = disabledChoiceIds.has(choice.id);
              return (
                <TouchableOpacity
                  key={choice.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                      opacity: disabled ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => handleSelect(choice)}
                  activeOpacity={disabled ? 1 : 0.78}
                  disabled={disabled}
                >
                  <View style={[styles.iconBox, { backgroundColor: choice.color }]}>
                    {choice.iconLib === 'MCI' ? (
                      <MaterialCommunityIcons name={choice.iconName as any} size={24} color={colors.neutral[50]} />
                    ) : (
                      <Ionicons name={choice.iconName as any} size={24} color={colors.neutral[50]} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      {choice.title}
                    </Text>
                    <Text style={[styles.cardDesc, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                      {choice.description}
                    </Text>
                  </View>
                  {!disabled && (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? colors.secondary[600] : colors.secondary[300]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Record Form Guidance Card */}
            <View
              style={[
                styles.guidanceCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            >
              <View style={styles.guidanceHeader}>
                <Ionicons
                  name="information-circle"
                  size={22}
                  color={isDark ? colors.primary[400] : colors.primary[600]}
                  style={{ marginTop: 1 }}
                />
                <Text style={[styles.guidanceTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Record Form Guidance
                </Text>
              </View>

              <Text style={[styles.guidanceSectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                Guidelines
              </Text>
              {[
                'Complete your record forms before proceeding to MDS (Medical and Dental Services).',
                'Provide complete and accurate information to avoid delays in assessment and appointment processing.',
                'Review all entries before submitting, especially personal details, medical history, and emergency information.',
                'Bring your ID and any required supporting documents during enrollment, validation, or clinic visits.',
                'Update your records whenever there are changes to your health status or relevant personal information.',
              ].map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>{'•'}</Text>
                  <Text style={[styles.bulletText, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>{item}</Text>
                </View>
              ))}

              <View style={[styles.guidanceDivider, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]} />

              <Text style={[styles.guidanceSectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                When to Use Each Record Update
              </Text>
              {[
                { label: 'Both Medical and Dental', desc: 'Use during every semestral enrollment and student ID validation.' },
                { label: 'Medical Only', desc: 'Use for medical appointments and checkups (e.g. OJT, sports events, outside activities, and other concerns.)' },
                { label: 'Dental Only', desc: 'Use for dental appointments, routine dental checkups, and other dental concerns.' },
              ].map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>{'•'}</Text>
                  <Text style={[styles.bulletText, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                    <Text style={[styles.bulletLabel, { color: isDark ? colors.neutral[200] : colors.secondary[800] }]}>{item.label}: </Text>
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 96 },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
  },
  subtitle: { fontSize: 14, marginBottom: 2, lineHeight: 20 },

  stateCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 2,
  },
  stateIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  stateBody: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerRevision: {
    backgroundColor: '#FEF9C3',
    borderColor: '#EAB308',
  },
  bannerInfo: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  bannerPending: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  bannerIcon: { marginTop: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  bannerBody: { fontSize: 13, color: '#475569', lineHeight: 18 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 76,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: 13, lineHeight: 18 },

  infoCard: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 12,
    lineHeight: 20,
  },
  guidanceCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guidanceTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guidanceSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  guidanceDivider: {
    borderTopWidth: 1,
    marginVertical: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 4,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 13,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 20,
  },
  bulletLabel: {
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});

export default UpdateRecordChoiceScreen;
