/**
 * Review Step — Step 5 (or final): Read-only summary of all sections + certification
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors } from '../../../context/ThemeContext';
import type { FormData, AllCatalogs } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  catalogs: AllCatalogs;
  onEdit: (stepIndex: number) => void;
  isDark: boolean;
  onCertificationChange?: (verified: boolean) => void;
}

const getCatalogName = (catalog: { id: string; name?: string; allergen?: string }[], id: string): string => {
  if (!catalog) return String(id);
  const item = catalog.find(c => String(c.id) === String(id));
  return (item as any)?.name || (item as any)?.allergen || String(id);
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateString; }
};

export const ReviewStep: React.FC<Props> = ({ formData, catalogs, onEdit, isDark, onCertificationChange }) => {
  const textColor = isDark ? colors.neutral[100] : colors.secondary[900];
  const subColor = isDark ? colors.neutral[400] : colors.neutral[600];
  const cardBg = isDark ? colors.neutral[800] : '#FFF';
  const cardBorder = isDark ? colors.neutral[700] : colors.neutral[200];

  const isCertified = formData.certification?.verified ?? false;

  const SectionHeader = ({ title, stepIndex }: { title: string; stepIndex: number }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      <TouchableOpacity onPress={() => onEdit(stepIndex)} style={styles.editBtnWrap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.editBtn, { color: colors.primary[500] }]}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  const DataRow = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <View style={styles.dataRow}>
        <Text style={[styles.dataLabel, { color: subColor }]}>{label}</Text>
        <Text style={[styles.dataValue, { color: textColor }]}>{value}</Text>
      </View>
    );
  };

  const ChipList = ({ items, bgColor, textColor: chipText }: { items: string[]; bgColor: string; textColor: string }) => (
    <View style={styles.chipRow}>
      {items.map((item, i) => (
        <View key={i} style={[styles.chip, { backgroundColor: bgColor }]}>
          <Text style={[styles.chipText, { color: chipText }]}>{item}</Text>
        </View>
      ))}
    </View>
  );

  const pi = formData.personalInfo;
  const mh = formData.medicalHistory;
  const mb = formData.medicalBackground;
  const dh = formData.dentalHistory;
  const ob = formData.obgyne;

  // Gather selected self conditions
  const selfConditions = Object.entries(mh.self).filter(([, v]) => v).map(([id]) => getCatalogName(catalogs.medicalConditionCatalog, id));
  if (mh.selfOtherChecked && mh.selfOther) selfConditions.push(`Other: ${mh.selfOther}`);

  // Gather selected family conditions
  const familyConditions = Object.entries(mh.family).filter(([, v]) => v).map(([id]) => ({
    name: getCatalogName(catalogs.medicalConditionCatalog, id),
    who: mh.familyWhoHasIt?.[id] || 'Not specified',
  }));

  // Immunizations
  const immunizationNames = Object.entries(mb.immunizations).filter(([, v]) => v).map(([id]) => getCatalogName(catalogs.immunizationCatalog, id));

  // Dental procedures
  const dentalProcNames = Object.entries(dh.selectedDentalProcedures).filter(([, v]) => v).map(([id]) => getCatalogName(catalogs.dentalProcedureCatalog, id));

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: textColor }]}>Review Your Information</Text>
      <Text style={[styles.subtitle, { color: subColor }]}>Please review all sections before submitting.</Text>

      {/* Personal Information */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionHeader title="Personal Information" stepIndex={0} />
        <DataRow label="Full Name" value={`${pi.surname}, ${pi.firstName} ${pi.middleName}`.trim()} />
        <DataRow label="Birthday" value={formatDate(pi.birthday)} />
        <DataRow label="Age" value={pi.age} />
        <DataRow label="Gender" value={pi.gender} />
        <DataRow label="Civil Status" value={pi.civilStatus} />
        <DataRow label="Nationality" value={pi.nationality} />
        <DataRow label="Address" value={pi.address} />
        <DataRow label="Province Address" value={pi.provinceAddress} />
        <DataRow label="Contact Number" value={pi.contactNumber} />
        <DataRow label="Program" value={pi.program === 'Other' ? pi.programOther : pi.program} />
        <DataRow label="Student Number" value={pi.studentNumber} />
        <DataRow label="Student Category" value={pi.studentCategory === 'Grade11' ? 'Grade 11' : pi.studentCategory === 'Grade12' ? 'Grade 12' : pi.studentCategory} />
        <DataRow label="Drug Test" value={pi.drugTestDone} />
      </View>

      {/* Emergency Contacts */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionHeader title="Emergency Contacts" stepIndex={0} />
        {pi.emergencyContacts?.map((c, i) => (
          <View key={i} style={i > 0 ? { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: cardBorder } : undefined}>
            <Text style={[styles.contactLabel, { color: textColor }]}>Contact {i + 1}</Text>
            <DataRow label="Name" value={c.name} />
            <DataRow label="Relationship" value={c.relationship} />
            <DataRow label="Contact" value={c.contactNumber} />
            <DataRow label="Address" value={c.address} />
          </View>
        ))}
      </View>

      {/* Medical History */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionHeader title="Medical History" stepIndex={1} />
        <Text style={[styles.subSection, { color: subColor }]}>Yourself</Text>
        {selfConditions.length > 0 ? (
          <ChipList items={selfConditions} bgColor={isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2'} textColor={isDark ? '#FCA5A5' : '#991B1B'} />
        ) : (
          <Text style={[styles.emptyText, { color: subColor }]}>No conditions reported</Text>
        )}
        <Text style={[styles.subSection, { color: subColor, marginTop: 12 }]}>Family</Text>
        {familyConditions.length > 0 ? (
          familyConditions.map((fc, i) => <DataRow key={i} label={fc.name} value={fc.who} />)
        ) : (
          <Text style={[styles.emptyText, { color: subColor }]}>No family conditions reported</Text>
        )}
      </View>

      {/* Medical Background */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionHeader title="Medical Background" stepIndex={2} />
        <Text style={[styles.subSection, { color: subColor }]}>Immunizations</Text>
        {immunizationNames.length > 0 ? (
          <ChipList items={immunizationNames} bgColor={isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7'} textColor={isDark ? '#86EFAC' : '#166534'} />
        ) : (
          <Text style={[styles.emptyText, { color: subColor }]}>None reported</Text>
        )}
        <DataRow label="Allergies" value={mb.hasAllergies || 'Not answered'} />
        {mb.hasAllergies === 'Yes' && mb.allergyOther ? <DataRow label="Allergy Notes" value={mb.allergyOther} /> : null}
        <DataRow label="Hospitalization" value={mb.hasHospitalization || 'Not answered'} />
        {mb.hasHospitalization === 'Yes' && <DataRow label="Hospitalization Date" value={formatDate(mb.hospitalizationDate)} />}
        {mb.hasHospitalization === 'Yes' && mb.hospitalizationNotes ? <DataRow label="Hospitalization Notes" value={mb.hospitalizationNotes} /> : null}
        <DataRow label="Operations" value={mb.hasOperation || 'Not answered'} />
        {mb.hasOperation === 'Yes' && <DataRow label="Operation Date" value={formatDate(mb.operationDate)} />}
        <DataRow label="Medications" value={mb.hasMedications || 'Not answered'} />
        {mb.hasMedications === 'Yes' && mb.medicationReason ? <DataRow label="Medication Reason" value={mb.medicationReason} /> : null}
        <DataRow label="Smoker" value={mb.smoker === 'yes' ? `Yes (${mb.smokerSticksPerDay || '?'} sticks/day, ${mb.smokerYears || '?'} yrs)` : mb.smoker === 'no' ? 'No' : undefined} />
        <DataRow label="Alcohol" value={mb.alcoholDrinker === 'yes' ? `Yes (${mb.alcoholFrequency || ''})` : mb.alcoholDrinker === 'no' ? 'No' : undefined} />
        <DataRow label="Eyeglasses" value={mb.eyeglasses ? 'Yes' : 'No'} />
        <DataRow label="Contact Lenses" value={mb.contactLenses ? 'Yes' : 'No'} />
        {(mb.eyeglasses || mb.contactLenses) && (
          <>
            <DataRow label="Grade OD (Right)" value={mb.gradeOD} />
            <DataRow label="Grade OS (Left)" value={mb.gradeOS} />
          </>
        )}
      </View>

      {/* Dental History */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionHeader title="Dental History" stepIndex={3} />
        <DataRow label="First time seeing dentist" value={dh.firstTimeDentist === 'yes' ? 'Yes' : dh.firstTimeDentist === 'no' ? 'No' : undefined} />
        {dh.firstTimeDentist === 'no' && <DataRow label="Last consultation" value={dh.lastDentalConsultation} />}
        <DataRow label="Last dental cleaning" value={dh.lastDentalCleaning} />
        <DataRow label="Intra-oral appliance" value={dh.hasIntraOralAppliance === 'yes' ? 'Yes' : dh.hasIntraOralAppliance === 'no' ? 'No' : undefined} />

        {dh.hasIntraOralAppliance === 'yes' && (
          <View style={{ marginTop: 4 }}>
            {Object.entries(dh.intraOralAppliances)
              .filter(([, v]) => (typeof v === 'object' ? (v as any)?.checked : !!v))
              .map(([id, v]) => {
                const name = id === 'other' ? (dh.applianceOther || 'Other') : getCatalogName(catalogs.oralApplianceCatalog as any, id);
                const arch = typeof v === 'object' ? ((v as any)?.arch || '') : '';
                return (
                  <View key={id} style={styles.applianceRow}>
                    <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE' }]}>
                      <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 13, fontWeight: '500' }}>{name}</Text>
                    </View>
                    {arch ? <Text style={{ color: subColor, fontSize: 12 }}>{arch}</Text> : null}
                  </View>
                );
              })}
          </View>
        )}

        {dentalProcNames.length > 0 && (
          <>
            <Text style={[styles.subSection, { color: subColor, marginTop: 12 }]}>Dental Procedures (past 24 months)</Text>
            <ChipList items={dentalProcNames} bgColor={isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7'} textColor={isDark ? '#FCD34D' : '#92400E'} />
          </>
        )}

        {/* Dental photos previews */}
        {(dh.upperTeethPhoto || dh.lowerTeethPhoto) && (
          <View style={styles.photosRow}>
            {dh.upperTeethPhoto?.uri && (
              <View style={styles.photoBlock}>
                <Text style={[styles.photoLabel, { color: subColor }]}>Upper Teeth</Text>
                <Image source={{ uri: dh.upperTeethPhoto.uri }} style={styles.photoThumb} resizeMode="cover" />
              </View>
            )}
            {dh.lowerTeethPhoto?.uri && (
              <View style={styles.photoBlock}>
                <Text style={[styles.photoLabel, { color: subColor }]}>Lower Teeth</Text>
                <Image source={{ uri: dh.lowerTeethPhoto.uri }} style={styles.photoThumb} resizeMode="cover" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* OB-GYNE (female only) */}
      {pi.gender === 'Female' && ob && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <SectionHeader title="OB-GYNE History" stepIndex={4} />
          <DataRow label="Last Menstrual Period" value={formatDate(ob.lastMenstrualPeriod)} />
          <DataRow label="Menstruation Duration" value={ob.menstruationDuration ? `${ob.menstruationDuration} days` : undefined} />
          <DataRow label="Dysmenorrhea" value={ob.dysmenorrhea} />
        </View>
      )}

      {/* Certification — interactive checkbox */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onCertificationChange?.(!isCertified)}
        style={[
          styles.certCard,
          {
            backgroundColor: isCertified
              ? (isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4')
              : (isDark ? 'rgba(37,99,235,0.08)' : '#FFF'),
            borderColor: isCertified
              ? colors.success[500]
              : (isDark ? colors.neutral[600] : colors.neutral[300]),
          },
        ]}
      >
        <View style={styles.certHeaderRow}>
          <Text style={[styles.certTitle, { color: textColor }]}>Certification</Text>
          <View
            style={[
              styles.certCheckbox,
              {
                backgroundColor: isCertified ? colors.success[500] : 'transparent',
                borderColor: isCertified ? colors.success[500] : (isDark ? colors.neutral[500] : colors.neutral[400]),
              },
            ]}
          >
            {isCertified && <Text style={styles.certCheckmark}>✓</Text>}
          </View>
        </View>
        <Text style={[styles.certText, { color: subColor }]}>
          By checking this box, I certify that the above information is true and correct to the best of my knowledge.
        </Text>
        {!isCertified && (
          <Text style={[styles.certHint, { color: colors.primary[500] }]}>
            Tap here to certify before submitting
          </Text>
        )}
        {isCertified && (
          <View style={styles.certBadge}>
            <Text style={styles.certBadgeText}>✓ Certified</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  editBtnWrap: { paddingVertical: 2, paddingHorizontal: 8 },
  editBtn: { fontSize: 13, fontWeight: '600' },
  dataRow: { flexDirection: 'row', paddingVertical: 5 },
  dataLabel: { width: 120, fontSize: 13, fontWeight: '500' },
  dataValue: { flex: 1, fontSize: 13, lineHeight: 18 },
  contactLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  subSection: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  emptyText: { fontSize: 13, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '500' },
  applianceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  photosRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  photoBlock: { flex: 1 },
  photoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  photoThumb: { width: '100%', height: 100, borderRadius: 10 },
  certCard: { borderWidth: 2, borderRadius: 14, padding: 16, marginBottom: 12 },
  certHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  certTitle: { fontSize: 16, fontWeight: '700' },
  certCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certCheckmark: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  certText: { fontSize: 13, lineHeight: 19 },
  certHint: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  certBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  certBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});

export default ReviewStep;
