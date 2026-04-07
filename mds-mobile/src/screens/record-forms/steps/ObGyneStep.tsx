/**
 * OB-GYNE Step — Step 4 (Female only): Menstrual history
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../../context/ThemeContext';
import { DatePickerInput } from '../../../components/ui/DatePickerInput';
import type { FormData } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<NonNullable<FormData['obgyne']>>) => void;
  isDark: boolean;
}

export const ObGyneStep: React.FC<Props> = ({ formData, onUpdate, isDark }) => {
  const ob = formData.obgyne ?? {
    lastMenstrualPeriod: '', menstruationDuration: '', menarcheYearAge: '', padsPerDay: '', dysmenorrhea: '',
  };

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : '#FFF',
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={{ fontSize: 22 }}>♀</Text>
        <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>OB-GYN History</Text>
      </View>
      <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
        For female students only
      </Text>

      <View style={[styles.card, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200], backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]}>
        {/* Last Menstrual Period */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
          When was your last menstrual period? *
        </Text>
        <Text style={[styles.hint, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
          (Kailan ang unang araw ng huling regla?)
        </Text>
        <DatePickerInput
          value={ob.lastMenstrualPeriod}
          onChange={v => onUpdate({ lastMenstrualPeriod: v })}
          isDark={isDark}
          placeholder="Select date"
        />

        {/* Menstruation Duration */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 20 }]}>
          Menstruation Duration
        </Text>
        <Text style={[styles.hint, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
          Days of menstruation
        </Text>
        <TextInput
          style={inputStyle}
          value={ob.menstruationDuration}
          onChangeText={v => onUpdate({ menstruationDuration: v })}
          placeholder="e.g. 5"
          keyboardType="numeric"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
        />

        {/* Menarche Year/Age */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 20 }]}>
          Menarche Year / Age
        </Text>
        <TextInput
          style={inputStyle}
          value={ob.menarcheYearAge}
          onChangeText={v => onUpdate({ menarcheYearAge: v })}
          placeholder="e.g. 12"
          keyboardType="numeric"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
        />

        {/* Pads per Day */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 20 }]}>
          Pads per Day
        </Text>
        <TextInput
          style={inputStyle}
          value={ob.padsPerDay}
          onChangeText={v => onUpdate({ padsPerDay: v })}
          placeholder="e.g. 3"
          keyboardType="numeric"
          placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
        />

        {/* Dysmenorrhea */}
        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 20 }]}>
          Do you experience Dysmenorrhea?
        </Text>
        <View style={styles.yesNoBtns}>
          {['Yes', 'No'].map(v => (
            <TouchableOpacity
              key={v}
              style={[
                styles.yesNoBtn,
                { backgroundColor: ob.dysmenorrhea === v ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
              ]}
              onPress={() => onUpdate({ dysmenorrhea: v })}
              activeOpacity={0.7}
            >
              <Text style={{ color: ob.dysmenorrhea === v ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600], fontWeight: '600', fontSize: 13 }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  yesNoBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  yesNoBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  yesNoBtnSelected: { backgroundColor: colors.primary[500] },
});

export default ObGyneStep;
