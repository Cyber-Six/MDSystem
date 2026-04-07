/**
 * Update Record Choice Screen
 * Mirrors mds-patient record-forms/update-record/record-choice-page.jsx
 *
 * Lets the patient choose what to update: Medical, Dental, or Both.
 * Then navigates to InitialRecordFormScreen with isUpdate=true and the chosen recordType.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
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
    description: 'Update your medical history, background, and health information',
    iconName: 'stethoscope',
    iconLib: 'MCI',
    color: colors.primary[500],
  },
  {
    id: 'dental',
    title: 'Dental Update',
    description: 'Update your dental history and oral health records',
    iconName: 'tooth',
    iconLib: 'MCI',
    color: colors.success[500],
  },
  {
    id: 'both',
    title: 'Both',
    description: 'Update both medical and dental information at once',
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
  const [ticket, setTicket] = useState<UpdateTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUpdateTicketStatus()
      .then(setTicket)
      .catch(() => setTicket(null))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelect = (choice: Choice) => {
    // If there's a Revision ticket, navigate into the revision flow for that scope instead
    if (ticket?.status === 'Revision') {
      const revisionScope = ticket.scope?.toLowerCase() as 'medical' | 'dental' | 'both' | undefined;
      navigation.navigate('InitialRecordForm', {
        isUpdate: true,
        isRevision: true,
        recordType: revisionScope ?? choice.id,
      });
      return;
    }
    navigation.navigate('InitialRecordForm', {
      isUpdate: true,
      recordType: choice.id,
    });
  };

  const PENDING_STATUSES = ['Pending', 'UnderReview', 'In Review'];
  const isPending = ticket && PENDING_STATUSES.includes(ticket.status);
  const isRevision = ticket?.status === 'Revision';

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Loading */}
        {isLoading && (
          <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginBottom: 12 }} />
        )}

        {/* Revision banner — staff has requested corrections */}
        {!isLoading && isRevision && (
          <View style={[styles.banner, styles.bannerRevision]}>
            <Ionicons name="create" size={22} color="#92400E" style={styles.bannerIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Revision Requested</Text>
              <Text style={styles.bannerBody}>
                A staff member has reviewed your record and requested corrections
                {ticket?.notes ? `: "${ticket.notes}"` : '.'}
                {'\n'}Your previous answers are pre-filled — tap the record type below to make corrections.
              </Text>
            </View>
          </View>
        )}

        {/* Pending banner — update awaiting review */}
        {!isLoading && isPending && (
          <View style={[styles.banner, styles.bannerPending]}>
            <Ionicons name="time" size={22} color="#1D4ED8" style={styles.bannerIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Update Pending Review</Text>
              <Text style={styles.bannerBody}>
                Your {ticket?.scope} record update has been submitted and is currently under review.
                You cannot submit another update until this one is processed.
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {!isPending && (
          <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
            {isRevision
              ? 'Select the record type that needs revision (based on staff request).'
              : "Select which part of your medical record you'd like to update."}
          </Text>
        )}

        {/* Choices — disabled when pending */}
        {CHOICES.map((choice) => {
          const disabled = !!isPending;
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
              onPress={() => !disabled && handleSelect(choice)}
              activeOpacity={disabled ? 1 : 0.75}
            >
              <View style={[styles.iconBox, { backgroundColor: `${choice.color}20` }]}>
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
              {!disabled && (
                <Text style={{ color: choice.color, fontSize: 22, fontWeight: '600' }}>›</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  subtitle: { fontSize: 14, marginBottom: 8, lineHeight: 20 },

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
});

export default UpdateRecordChoiceScreen;
