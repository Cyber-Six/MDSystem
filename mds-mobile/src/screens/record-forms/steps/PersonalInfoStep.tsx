/**
 * Personal Info Step — Step 0 of the initial record form
 */

import React from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../../context/ThemeContext';
import type { FormData } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<FormData['personalInfo']>) => void;
  isDark: boolean;
  errors: Record<string, string>;
}

const PROGRAMS = [
  'ARCHITECTURE (CEA)', 'BS ACCOUNTANCY (CBE)', 'BS MATHEMATICS',
  'CIVIL ENGINEERING (CEA)', 'CHEMICAL ENGINEERING (CEA)', 'COMPUTER ENGINEERING (CEA)',
  'COMPUTER SCIENCE (CCS)', 'DATA SCIENCE (CCS)', 'ELECTRICAL ENGINEERING (CEA)',
  'ELECTRONICS AND COMMUNICATION ENGINEERING (CEA)',
  'INDUSTRIAL ENGINEERING (CEA)', 'INFORMATION SYSTEM (CCS)',
  'INFORMATION TECHNOLOGY (CCS)', 'MECHANICAL ENGINEERING (CEA)',
  'GRADUATE PROGRAM', 'Other',
];

const STUDENT_CATEGORIES = [
  'Freshmen', 'Freshmen - New student', 'Old Student',
  'Transferee', 'Returnee', 'Graduate studies (New student)',
  'Graduate studies (Old student)',
];

const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'];
const GENDERS = ['Male', 'Female'];

export const PersonalInfoStep: React.FC<Props> = ({ formData, onUpdate, isDark, errors }) => {
  const pi = formData.personalInfo;
  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];
  const labelStyle = [styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }];

  const renderField = (label: string, field: keyof typeof pi, placeholder: string, errorKey?: string) => (
    <View style={styles.fieldGroup}>
      <Text style={labelStyle}>{label} *</Text>
      <TextInput
        style={[...inputStyle, errors[errorKey || field] && styles.inputError]}
        value={String(pi[field] || '')}
        onChangeText={(val) => onUpdate({ [field]: val })}
        placeholder={placeholder}
        placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
      />
      {errors[errorKey || field] && <Text style={styles.errorText}>{errors[errorKey || field]}</Text>}
    </View>
  );

  const renderSelectField = (label: string, field: string, options: string[]) => (
    <View style={styles.fieldGroup}>
      <Text style={labelStyle}>{label} *</Text>
      <View style={styles.optionsRow}>
        {options.map(opt => {
          const isSelected = (pi as any)[field] === opt;
          return (
            <Text
              key={opt}
              onPress={() => onUpdate({ [field]: opt })}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100],
                  color: isSelected ? '#FFFFFF' : isDark ? colors.neutral[300] : colors.neutral[700],
                },
              ]}
            >
              {opt}
            </Text>
          );
        })}
      </View>
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

  const renderEmergencyContact = (index: number) => {
    const contact = pi.emergencyContacts?.[index] || { name: '', relationship: '', contactNumber: '', address: '' };
    const updateContact = (field: string, value: string) => {
      const updated = [...(pi.emergencyContacts || [])];
      updated[index] = { ...contact, [field]: value };
      onUpdate({ emergencyContacts: updated });
    };
    return (
      <View key={index} style={[styles.contactCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50], borderColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}>
        <Text style={[styles.contactTitle, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
          Emergency Contact {index + 1} *
        </Text>
        <TextInput style={inputStyle} value={contact.name} onChangeText={v => updateContact('name', v)} placeholder="Full Name" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        <TextInput style={[...inputStyle, { marginTop: 8 }]} value={contact.relationship} onChangeText={v => updateContact('relationship', v)} placeholder="Relationship" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        <TextInput style={[...inputStyle, { marginTop: 8 }]} value={contact.contactNumber} onChangeText={v => updateContact('contactNumber', v)} placeholder="Contact Number" keyboardType="phone-pad" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        <TextInput style={[...inputStyle, { marginTop: 8 }]} value={contact.address} onChangeText={v => updateContact('address', v)} placeholder="Address" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
        Personal Information
      </Text>

      {renderField('Surname', 'surname', 'Enter surname')}
      {renderField('First Name', 'firstName', 'Enter first name')}
      {renderField('Middle Name', 'middleName', 'Enter middle name')}

      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Birthday *</Text>
        <TextInput
          style={inputStyle}
          value={pi.birthday}
          onChangeText={(val) => onUpdate({ birthday: val })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
        />
      </View>

      {renderSelectField('Gender', 'gender', GENDERS)}
      {renderSelectField('Civil Status', 'civilStatus', CIVIL_STATUSES)}

      {renderField('Nationality', 'nationality', 'Enter nationality')}
      {renderField('Religion', 'religion', 'Enter religion')}
      {renderField('Contact Number', 'contactNumber', '09XXXXXXXXX')}
      {renderField('Present Address', 'address', 'Enter present address')}
      {renderField('Province Address', 'provinceAddress', 'Enter province address')}
      {renderField('Student Number', 'studentNumber', 'e.g. 2022-12345')}

      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Program *</Text>
        <View style={styles.optionsRow}>
          {PROGRAMS.map(p => {
            const isSelected = pi.program === p;
            return (
              <Text key={p} onPress={() => onUpdate({ program: p })} style={[styles.optionChip, { backgroundColor: isSelected ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100], color: isSelected ? '#FFFFFF' : isDark ? colors.neutral[300] : colors.neutral[700] }]}>
                {p}
              </Text>
            );
          })}
        </View>
        {pi.program === 'Other' && (
          <TextInput style={[...inputStyle, { marginTop: 8 }]} value={pi.programOther || ''} onChangeText={v => onUpdate({ programOther: v })} placeholder="Specify program" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Student Category *</Text>
        <View style={styles.optionsRow}>
          {STUDENT_CATEGORIES.map(c => {
            const isSelected = pi.studentCategory === c;
            return (
              <Text key={c} onPress={() => onUpdate({ studentCategory: c })} style={[styles.optionChip, { backgroundColor: isSelected ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100], color: isSelected ? '#FFFFFF' : isDark ? colors.neutral[300] : colors.neutral[700] }]}>
                {c}
              </Text>
            );
          })}
        </View>
      </View>

      {renderSelectField('Drug Test Done', 'drugTestDone', ['Yes', 'No'])}

      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], marginTop: 24 }]}>
        Emergency Contacts
      </Text>
      {renderEmergencyContact(0)}
      {renderEmergencyContact(1)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  inputError: { borderColor: colors.error[500] },
  errorText: { color: colors.error[500], fontSize: 12, marginTop: 4 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 13, overflow: 'hidden' },
  contactCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  contactTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
});

export default PersonalInfoStep;
