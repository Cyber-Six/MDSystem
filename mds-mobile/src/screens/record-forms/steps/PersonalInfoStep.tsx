/**
 * Personal Info Step — Step 0 of the initial record form
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable, Platform, Keyboard,
} from 'react-native';
import { colors } from '../../../context/ThemeContext';
import type { FormData } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<FormData['personalInfo']>) => void;
  isDark: boolean;
  errors: Record<string, string>;
  isUpdate?: boolean;
}

const PROGRAMS = [
  'BS Architecture',
  'BS Chemical Engineering',
  'BS Civil Engineering',
  'BS Computer Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Industrial Engineering',
  'BS Mechanical Engineering',
  'BS Environmental and Sanitary Engineering',
  'BS Computer Science',
  'BS Data Science and Analytics',
  'BS Entertainment and Multimedia Computing',
  'BS Information Technology',
  'BS Information Systems',
  'BS Accountancy',
  'BS Accounting Information Systems',
  'BSBA Financial Management',
  'BSBA Human Resource Management',
  'BSBA Logistics and Supply Chain Management',
  'BSBA Marketing Management',
  'Bachelor of Arts in English Language',
  'Bachelor of Arts in Political Science',
  'Bachelor of Secondary Education Major in English',
  'Bachelor of Secondary Education Major in Mathematics',
  'Bachelor of Secondary Education Major in Sciences',
  'Bachelor of Special Needs Education',
  'Teaching Certificate Program',
  'Graduate Program',
  'Other',
];

const STUDENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'Grade11', label: 'Grade 11' },
  { value: 'Grade12', label: 'Grade 12' },
  { value: 'Freshman', label: 'Freshman' },
  { value: 'Sophomore', label: 'Sophomore' },
  { value: 'Junior', label: 'Junior' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Masteral', label: 'Masteral' },
  { value: 'Doctorate', label: 'Doctorate' },
];

const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'];
const GENDERS = ['Male', 'Female'];

export const PersonalInfoStep: React.FC<Props> = ({ formData, onUpdate, isDark, errors, isUpdate = false }) => {
  const pi = formData.personalInfo;
  const [programOpen, setProgramOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : '#FFF',
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];
  const labelStyle = [styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }];

  const renderField = (
    label: string,
    field: keyof typeof pi,
    placeholder: string,
    errorKey?: string,
    opts?: { keyboardType?: TextInput['props']['keyboardType'] },
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={labelStyle}>{label} *</Text>
      <TextInput
        style={[...inputStyle, errors[errorKey || field] && styles.inputError]}
        value={String(pi[field] || '')}
        onChangeText={(val) => onUpdate({ [field]: val })}
        placeholder={placeholder}
        placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
        keyboardType={opts?.keyboardType}
        returnKeyType="done"
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
            <TouchableOpacity
              key={opt}
              onPress={() => onUpdate({ [field]: opt })}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100],
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={{
                color: isSelected ? '#FFFFFF' : isDark ? colors.neutral[300] : colors.neutral[700],
                fontSize: 13,
                fontWeight: isSelected ? '600' : '400',
              }}>
                {opt}
              </Text>
            </TouchableOpacity>
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
      <View
        key={index}
        style={[
          styles.contactCard,
          {
            backgroundColor: isDark ? colors.neutral[800] : '#FFF',
            borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
          },
        ]}
      >
        <Text style={[styles.contactTitle, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
          Emergency Contact {index + 1} *
        </Text>
        <TextInput
          style={inputStyle}
          value={contact.name}
          onChangeText={v => updateContact('name', v)}
          placeholder="Full Name"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
          returnKeyType="next"
        />
        <TextInput
          style={[...inputStyle, { marginTop: 10 }]}
          value={contact.relationship}
          onChangeText={v => updateContact('relationship', v)}
          placeholder="Relationship"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
          returnKeyType="next"
        />
        <TextInput
          style={[...inputStyle, { marginTop: 10 }]}
          value={contact.contactNumber}
          onChangeText={v => updateContact('contactNumber', v)}
          placeholder="Contact Number (e.g. 09XXXXXXXXX)"
          keyboardType="phone-pad"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TextInput
          style={[...inputStyle, { marginTop: 10 }]}
          value={contact.address}
          onChangeText={v => updateContact('address', v)}
          placeholder="Address"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
          returnKeyType="done"
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!isUpdate && (
        <>
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
          {renderField('Contact Number', 'contactNumber', '09XXXXXXXXX', undefined, { keyboardType: 'phone-pad' })}
          {renderField('Present Address', 'address', 'Enter present address')}
          {renderField('Province Address', 'provinceAddress', 'Enter province address')}
          {renderField('Student Number', 'studentNumber', 'e.g. 2022-12345')}
        </>
      )}

      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], marginTop: isUpdate ? 0 : 24 }]}>
        School Information
      </Text>

      {/* Program — dropdown select */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Program *</Text>
        <TouchableOpacity
          style={[styles.selectTrigger, {
            backgroundColor: isDark ? colors.neutral[700] : '#FFF',
            borderColor: errors.program ? colors.error[500] : isDark ? colors.neutral[600] : colors.neutral[200],
          }]}
          onPress={() => setProgramOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: 15, color: pi.program ? (isDark ? colors.neutral[100] : colors.neutral[900]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }}>
            {pi.program || 'Select program...'}
          </Text>
          <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500], fontSize: 12 }}>▼</Text>
        </TouchableOpacity>
        {errors.program && <Text style={styles.errorText}>{errors.program}</Text>}
        {pi.program === 'Other' && (
          <TextInput style={[...inputStyle, { marginTop: 8 }]} value={pi.programOther || ''} onChangeText={v => onUpdate({ programOther: v })} placeholder="Specify program" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        )}
        <Modal visible={programOpen} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setProgramOpen(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Select Program</Text>
                <TouchableOpacity onPress={() => setProgramOpen(false)}>
                  <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={PROGRAMS}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.optionItem, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={() => { onUpdate({ program: item }); setProgramOpen(false); }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: item === pi.program ? colors.primary[500] : (isDark ? colors.neutral[200] : colors.neutral[800]), fontWeight: item === pi.program ? '600' : '400' }}>
                      {item}
                    </Text>
                    {item === pi.program && <Text style={{ color: colors.primary[500], fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      {/* Student Category — dropdown select */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Student Category *</Text>
        <TouchableOpacity
          style={[styles.selectTrigger, {
            backgroundColor: isDark ? colors.neutral[700] : '#FFF',
            borderColor: errors.studentCategory ? colors.error[500] : isDark ? colors.neutral[600] : colors.neutral[200],
          }]}
          onPress={() => setCategoryOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: 15, color: pi.studentCategory ? (isDark ? colors.neutral[100] : colors.neutral[900]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }}>
            {STUDENT_CATEGORIES.find(c => c.value === pi.studentCategory)?.label || pi.studentCategory || 'Select category...'}
          </Text>
          <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500], fontSize: 12 }}>▼</Text>
        </TouchableOpacity>
        {errors.studentCategory && <Text style={styles.errorText}>{errors.studentCategory}</Text>}
        <Modal visible={categoryOpen} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setCategoryOpen(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Select Student Category</Text>
                <TouchableOpacity onPress={() => setCategoryOpen(false)}>
                  <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={STUDENT_CATEGORIES}
                keyExtractor={item => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.optionItem, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={() => { onUpdate({ studentCategory: item.value }); setCategoryOpen(false); }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: item.value === pi.studentCategory ? colors.primary[500] : (isDark ? colors.neutral[200] : colors.neutral[800]), fontWeight: item.value === pi.studentCategory ? '600' : '400' }}>
                      {item.label}
                    </Text>
                    {item.value === pi.studentCategory && <Text style={{ color: colors.primary[500], fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      {!isUpdate && renderSelectField('Drug Test Done', 'drugTestDone', ['Yes', 'No'])}

      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], marginTop: 24 }]}>
        Emergency Contacts
      </Text>
      {renderEmergencyContact(0)}
      {renderEmergencyContact(1)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputError: { borderColor: colors.error[500] },
  errorText: { color: colors.error[500], fontSize: 12, marginTop: 4 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  contactCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  contactTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  selectTrigger: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
});

export default PersonalInfoStep;
