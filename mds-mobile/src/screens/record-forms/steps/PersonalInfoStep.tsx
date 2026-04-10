/**
 * Personal Info Step — Step 0 of the initial record form
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable, Platform, Keyboard, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../context/ThemeContext';
import { DatePickerInput } from '../../../components/ui/DatePickerInput';
import type { FormData } from '../../../services/emr-service';
import { searchStudentProgram } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<FormData['personalInfo']>) => void;
  isDark: boolean;
  errors: Record<string, string>;
  isUpdate?: boolean;
}

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
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Program search state
  const [programInput, setProgramInput] = useState(pi.program || '');
  const [programSuggestions, setProgramSuggestions] = useState<Array<{ id: string; label: string }>>([]);
  const [programSearching, setProgramSearching] = useState(false);
  const [programFocused, setProgramFocused] = useState(false);
  const programTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProgramInputChange = useCallback((value: string) => {
    setProgramInput(value);
    // Clear the selection if user edits text after selecting
    if (pi.programId) {
      onUpdate({ program: value, programId: '' });
    } else {
      onUpdate({ program: value });
    }
    // Debounced search
    if (programTimerRef.current) clearTimeout(programTimerRef.current);
    if (value.trim().length < 2) { setProgramSuggestions([]); return; }
    programTimerRef.current = setTimeout(async () => {
      setProgramSearching(true);
      try {
        const results = await searchStudentProgram(value.trim());
        setProgramSuggestions(results);
      } catch { setProgramSuggestions([]); }
      setProgramSearching(false);
    }, 300);
  }, [pi.programId, onUpdate]);

  const selectProgram = useCallback((item: { id: string; label: string }) => {
    setProgramInput(item.label);
    setProgramSuggestions([]);
    setProgramFocused(false);
    onUpdate({ program: item.label, programId: item.id });
    Keyboard.dismiss();
  }, [onUpdate]);

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
    opts?: { keyboardType?: TextInput['props']['keyboardType']; maxLength?: number },
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
        maxLength={opts?.maxLength}
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
          maxLength={11}
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
            <DatePickerInput
              label="Birthday"
              value={pi.birthday}
              onChange={(val) => onUpdate({ birthday: val })}
              isDark={isDark}
              required
              placeholder="Select birthday"
            />
          </View>

          {renderSelectField('Gender', 'gender', GENDERS)}
          {renderSelectField('Civil Status', 'civilStatus', CIVIL_STATUSES)}

          {renderField('Nationality', 'nationality', 'Enter nationality')}
          {renderField('Religion', 'religion', 'Enter religion')}
          {renderField('Contact Number', 'contactNumber', '09XXXXXXXXX', undefined, { keyboardType: 'phone-pad', maxLength: 11 })}
          {renderField('Present Address', 'address', 'Enter present address')}
          {renderField('Province Address', 'provinceAddress', 'Enter province address')}
          {renderField('Student Number', 'studentNumber', 'e.g. 2022-12345')}
        </>
      )}

      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], marginTop: isUpdate ? 0 : 24 }]}>
        School Information
      </Text>

      {/* Program — search input */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>Program *</Text>
        <View style={{ position: 'relative' }}>
          <View style={[styles.searchInputRow, {
            backgroundColor: isDark ? colors.neutral[700] : '#FFF',
            borderColor: errors.program ? colors.error[500] : isDark ? colors.neutral[600] : colors.neutral[200],
          }]}>
            <TextInput
              style={[styles.searchInput, { color: isDark ? colors.neutral[100] : colors.neutral[900] }]}
              value={programInput}
              onChangeText={handleProgramInputChange}
              onFocus={() => setProgramFocused(true)}
              placeholder="Search program..."
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
              returnKeyType="done"
            />
            {programSearching ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : pi.programId ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
            ) : (
              <Ionicons name="search" size={16} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
            )}
          </View>
          {programFocused && programSuggestions.length > 0 && (
            <View style={[styles.suggestionsDropdown, {
              backgroundColor: isDark ? colors.neutral[800] : '#FFF',
              borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
            }]}>
              {programSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.suggestionItem, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                  onPress={() => selectProgram(item)}
                >
                  <Text style={{ fontSize: 14, color: isDark ? colors.neutral[200] : colors.neutral[800] }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {programFocused && !programSearching && programInput.trim().length >= 2 && programSuggestions.length === 0 && (
            <View style={[styles.suggestionsDropdown, {
              backgroundColor: isDark ? colors.neutral[800] : '#FFF',
              borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
            }]}>
              <Text style={{ padding: 12, fontSize: 13, color: isDark ? colors.neutral[400] : colors.neutral[500], textAlign: 'center' }}>
                No programs found
              </Text>
            </View>
          )}
        </View>
        {errors.program && <Text style={styles.errorText}>{errors.program}</Text>}
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
          <Ionicons name="chevron-down" size={14} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
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
                    {item.value === pi.studentCategory && <Ionicons name="checkmark" size={16} color={colors.primary[500]} />}
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
  searchInputRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  suggestionsDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, borderWidth: 1, borderRadius: 12, marginTop: 4, maxHeight: 200, overflow: 'hidden' },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
});

export default PersonalInfoStep;
