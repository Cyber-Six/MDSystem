/**
 * Medical Background Step — Step 2: Immunizations, Allergies, Hospitalizations,
 * Operations, Medications, Lifestyle, Visual Acuity
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet } from 'react-native';
import { colors } from '../../../context/ThemeContext';
import type { FormData, AllCatalogs } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdateBg: (data: Partial<FormData['medicalBackground']>) => void;
  isDark: boolean;
  catalogs: AllCatalogs;
}

type SectionKey = 'immunizations' | 'allergies' | 'hospitalizations' | 'operations' | 'medications' | 'lifestyle' | 'visualAcuity';

const AccordionSection: React.FC<{
  title: string; isOpen: boolean; onToggle: () => void; isDark: boolean; children: React.ReactNode;
}> = ({ title, isOpen, onToggle, isDark, children }) => (
  <View style={[styles.accordion, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
    <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[styles.accordionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{title}</Text>
      <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500], fontSize: 16 }}>{isOpen ? '▲' : '▼'}</Text>
    </TouchableOpacity>
    {isOpen && <View style={styles.accordionBody}>{children}</View>}
  </View>
);

export const MedicalBackgroundStep: React.FC<Props> = ({ formData, onUpdateBg, isDark, catalogs }) => {
  const bg = formData.medicalBackground;
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    immunizations: true, allergies: false, hospitalizations: false,
    operations: false, medications: false, lifestyle: false, visualAcuity: false,
  });

  const toggleSection = (key: SectionKey) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : '#FFF',
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];

  const renderChecklist = (items: { id: string; name?: string; allergen?: string }[], checkedMap: Record<string, any>, toggleFn: (id: string) => void) => (
    <>
      {items.map(item => {
        const label = (item as any).name || (item as any).allergen || '';
        const isChecked = !!checkedMap[item.id];
        return (
          <TouchableOpacity key={item.id} style={styles.checkRow} onPress={() => toggleFn(item.id)} activeOpacity={0.7}>
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  const renderYesNo = (label: string, value: string, onSelect: (v: string) => void) => (
    <View style={styles.yesNoContainer}>
      <Text style={[styles.yesNoLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      <View style={styles.yesNoBtns}>
        {['Yes', 'No'].map(v => (
          <TouchableOpacity
            key={v}
            style={[
              styles.yesNoBtn,
              { backgroundColor: value === v ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
            ]}
            onPress={() => onSelect(v)}
            activeOpacity={0.7}
          >
            <Text style={{ color: value === v ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600], fontWeight: '600', fontSize: 13 }}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Medical Background</Text>

      {/* Immunizations */}
      <AccordionSection title="Immunizations" isOpen={openSections.immunizations} onToggle={() => toggleSection('immunizations')} isDark={isDark}>
        {renderChecklist(
          catalogs.immunizationCatalog,
          bg.immunizations,
          id => onUpdateBg({ immunizations: { ...bg.immunizations, [id]: !bg.immunizations[id] } })
        )}
        <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.immunizationOther} onChangeText={v => onUpdateBg({ immunizationOther: v })}
          placeholder="Other immunizations..." placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
      </AccordionSection>

      {/* Allergies */}
      <AccordionSection title="Allergies" isOpen={openSections.allergies} onToggle={() => toggleSection('allergies')} isDark={isDark}>
        {renderYesNo('Do you have allergies?', bg.hasAllergies, v => onUpdateBg({ hasAllergies: v }))}
        {bg.hasAllergies === 'Yes' && (
          <>
            {renderChecklist(
              catalogs.allergenCatalog,
              bg.allergies,
              id => onUpdateBg({ allergies: { ...bg.allergies, [id]: !bg.allergies[id] } })
            )}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.allergyOther} onChangeText={v => onUpdateBg({ allergyOther: v })}
              placeholder="Other allergies..." placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </>
        )}
      </AccordionSection>

      {/* Hospitalizations */}
      <AccordionSection title="Hospitalizations" isOpen={openSections.hospitalizations} onToggle={() => toggleSection('hospitalizations')} isDark={isDark}>
        {renderYesNo('Have you been hospitalized?', bg.hasHospitalization, v => onUpdateBg({ hasHospitalization: v }))}
        {bg.hasHospitalization === 'Yes' && (
          <>
            {renderChecklist(
              catalogs.hospitalizationCatalog,
              bg.hospitalizationConditions,
              id => onUpdateBg({ hospitalizationConditions: { ...bg.hospitalizationConditions, [id]: !bg.hospitalizationConditions[id] } })
            )}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.hospitalizationDate} onChangeText={v => onUpdateBg({ hospitalizationDate: v })}
              placeholder="Date (YYYY-MM-DD)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.hospitalizationNotes} onChangeText={v => onUpdateBg({ hospitalizationNotes: v })}
              placeholder="Notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Operations */}
      <AccordionSection title="Operations" isOpen={openSections.operations} onToggle={() => toggleSection('operations')} isDark={isDark}>
        {renderYesNo('Have you had any operations?', bg.hasOperation, v => onUpdateBg({ hasOperation: v }))}
        {bg.hasOperation === 'Yes' && (
          <>
            {renderChecklist(
              catalogs.operationCatalog,
              bg.operationConditions,
              id => onUpdateBg({ operationConditions: { ...bg.operationConditions, [id]: !bg.operationConditions[id] } })
            )}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.operationDate} onChangeText={v => onUpdateBg({ operationDate: v })}
              placeholder="Date (YYYY-MM-DD)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.operationNotes} onChangeText={v => onUpdateBg({ operationNotes: v })}
              placeholder="Notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Medications */}
      <AccordionSection title="Medications" isOpen={openSections.medications} onToggle={() => toggleSection('medications')} isDark={isDark}>
        {renderYesNo('Are you taking any medications?', bg.hasMedications, v => onUpdateBg({ hasMedications: v }))}
        {bg.hasMedications === 'Yes' && (
          <>
            {renderChecklist(
              catalogs.medicationCatalog,
              bg.selectedMedications,
              id => onUpdateBg({ selectedMedications: { ...bg.selectedMedications, [id]: !bg.selectedMedications[id] } })
            )}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.medicationReason} onChangeText={v => onUpdateBg({ medicationReason: v })}
              placeholder="Reason for medication" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </>
        )}
      </AccordionSection>

      {/* Lifestyle */}
      <AccordionSection title="Lifestyle" isOpen={openSections.lifestyle} onToggle={() => toggleSection('lifestyle')} isDark={isDark}>
        {renderYesNo('Do you smoke?', bg.smoker === 'yes' ? 'Yes' : bg.smoker === 'no' ? 'No' : '',
          v => onUpdateBg({ smoker: v === 'Yes' ? 'yes' : 'no' }))}
        {bg.smoker === 'yes' && (
          <>
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.smokerSticksPerDay} onChangeText={v => onUpdateBg({ smokerSticksPerDay: v })}
              placeholder="Sticks per day" keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.smokerYears} onChangeText={v => onUpdateBg({ smokerYears: v })}
              placeholder="Years of smoking" keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </>
        )}
        {renderYesNo('Do you drink alcohol?', bg.alcoholDrinker === 'yes' ? 'Yes' : bg.alcoholDrinker === 'no' ? 'No' : '',
          v => onUpdateBg({ alcoholDrinker: v === 'Yes' ? 'yes' : 'no' }))}
        {bg.alcoholDrinker === 'yes' && (
          <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.alcoholFrequency} onChangeText={v => onUpdateBg({ alcoholFrequency: v })}
            placeholder="Frequency (e.g. weekly, occasionally)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
        )}
      </AccordionSection>

      {/* Visual Acuity */}
      <AccordionSection title="Visual Acuity" isOpen={openSections.visualAcuity} onToggle={() => toggleSection('visualAcuity')} isDark={isDark}>
        <View style={styles.switchRow}>
          <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14 }}>Wears Eyeglasses</Text>
          <Switch value={bg.eyeglasses} onValueChange={v => onUpdateBg({ eyeglasses: v })} />
        </View>
        <View style={styles.switchRow}>
          <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14 }}>Wears Contact Lenses</Text>
          <Switch value={bg.contactLenses} onValueChange={v => onUpdateBg({ contactLenses: v })} />
        </View>
        {(bg.eyeglasses || bg.contactLenses) && (
          <>
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.gradeOD} onChangeText={v => onUpdateBg({ gradeOD: v })}
              placeholder="Right Eye (OD) Grade" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.gradeOS} onChangeText={v => onUpdateBg({ gradeOS: v })}
              placeholder="Left Eye (OS) Grade" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </>
        )}
      </AccordionSection>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  accordion: { borderWidth: 1, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  accordionTitle: { fontSize: 15, fontWeight: '600' },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center' as const, justifyContent: 'center' as const },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  itemText: { fontSize: 14, flex: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  yesNoContainer: { marginBottom: 10 },
  yesNoLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  yesNoBtns: { flexDirection: 'row', gap: 8 },
  yesNoBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});

export default MedicalBackgroundStep;
