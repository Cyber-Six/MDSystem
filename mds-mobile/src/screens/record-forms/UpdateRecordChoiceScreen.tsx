/**
 * Update Record Choice Screen
 *
 * Status-aware entry point for record updates:
 * - Approved users can choose Medical / Dental / Both updates
 * - Unverified users are prompted to complete initial medical record first
 * - Inactive users are forced to submit Both update for reactivation
 */

import React, { useCallback, useState } from 'react';
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
    title: 'Medical Update',
    description: 'Update your medical history and health information',
    iconName: 'stethoscope',
    iconLib: 'MCI',
    color: colors.primary[500],
  },
  {
    id: 'dental',
    title: 'Dental Update',
    description: 'Update your dental history and teeth records',
    iconName: 'tooth',
    iconLib: 'MCI',
    color: colors.success[500],
  },
  {
    id: 'both',
    title: 'Both Update',
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

  const loadTicketStatus = useCallback(async () => {
    setIsLoadingTicket(true);
    try {
      const currentTicket = await getUpdateTicketStatus();
      setTicket(currentTicket);
    } catch {
      setTicket(null);
    } finally {
      setIsLoadingTicket(false);
    }
  }, []);

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

  const mapScopeToRecordType = (scope?: string): Choice['id'] | undefined => {
    if (!scope) return undefined;
    const normalized = scope.toLowerCase();
    if (normalized === 'medical') return 'medical';
    if (normalized === 'dental') return 'dental';
    if (normalized === 'both') return 'both';
    return undefined;
  };

  const disabledChoiceIds = new Set<Choice['id']>();
  if (isInactiveCredential) {
    disabledChoiceIds.add('medical');
    disabledChoiceIds.add('dental');
  }
  if (isPending || requiresInitialRecord) {
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

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.headerCard, { backgroundColor: colors.primary[500] }]}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="document-text" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>
        </View>

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
                    Your {ticket?.scope || 'record'} update is under review. You cannot submit another one yet.
                  </Text>
                </View>
              </View>
            )}

            <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
              Select which records you want to update.
            </Text>

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
                  <View style={[styles.iconBox, { backgroundColor: `${choice.color}22` }]}>
                    {choice.iconLib === 'MCI' ? (
                      <MaterialCommunityIcons name={choice.iconName as any} size={28} color={choice.color} />
                    ) : (
                      <Ionicons name={choice.iconName as any} size={28} color={choice.color} />
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
                  {!disabled && <Text style={{ color: choice.color, fontSize: 22, fontWeight: '700' }}>›</Text>}
                </TouchableOpacity>
              );
            })}

            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            >
              <Ionicons name="information-circle" size={22} color={colors.accent[500]} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Why separate updates?</Text>
                <Text style={[styles.infoBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>This keeps your medical and dental records organized and secure. You can update the other record type later.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 28 },
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
  subtitle: { fontSize: 14, marginBottom: 6, lineHeight: 20 },

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
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 18 },

  infoCard: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  infoBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default UpdateRecordChoiceScreen;
