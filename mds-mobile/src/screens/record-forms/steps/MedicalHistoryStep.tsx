/**
 * Medical History Step — Step 1: Self + Family medical condition checklist
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../context/ThemeContext';
import { CatalogSearchField } from '../../../components/ui/CatalogSearchField';
import { useCatalogSearch } from '../../../hooks/useCatalogSearch';
import { searchDomainCatalog, createDomainCatalog } from '../../../services/emr-service';
import type { FormData, CatalogItem } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (section: 'medicalHistory', data: Partial<FormData['medicalHistory']>) => void;
  isDark: boolean;
  catalogs: { medicalConditionCatalog: CatalogItem[] };
}

type Tab = 'self' | 'family';

export const MedicalHistoryStep: React.FC<Props> = ({ formData, onUpdate, isDark, catalogs }) => {
  const mh = formData.medicalHistory;
  const conditions = catalogs.medicalConditionCatalog || [];
  const [tab, setTab] = React.useState<Tab>('self');

  const conditionOthers = useCatalogSearch({
    catalog: conditions,
    searchFn: (q: string) => searchDomainCatalog('MedicalCondition', q),
    createFn: (name: string) => createDomainCatalog('MedicalCondition', name),
    nameKey: 'name',
  });

  const toggleCondition = (id: string) => {
    if (tab === 'self') {
      onUpdate('medicalHistory', { self: { ...mh.self, [id]: !mh.self[id] } });
    } else {
      onUpdate('medicalHistory', { family: { ...mh.family, [id]: !mh.family[id] } });
    }
  };

  const updateFamilyWho = (id: string, value: string) => {
    onUpdate('medicalHistory', { familyWhoHasIt: { ...mh.familyWhoHasIt, [id]: value } });
  };

  const checkedMap = tab === 'self' ? mh.self : mh.family;
  const inputBg = isDark ? colors.neutral[700] : '#FFF';
  const inputColor = isDark ? colors.neutral[100] : colors.neutral[900];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Medical History</Text>
      <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
        Select conditions that apply to you or your family.
      </Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['self', 'family'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? '#FFFFFF' : isDark ? colors.neutral[300] : colors.neutral[600] }]}>
              {t === 'self' ? 'Self' : 'Family'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Condition checklist */}
      {conditions.map(cond => {
        const isChecked = !!checkedMap[cond.id];
        return (
          <View key={cond.id}>
            <TouchableOpacity
              style={[styles.checkRow, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}
              onPress={() => toggleCondition(cond.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={[styles.conditionName, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
                {cond.name}
              </Text>
            </TouchableOpacity>
            {tab === 'family' && isChecked && (
              <TextInput
                style={[styles.whoInput, { backgroundColor: inputBg, color: inputColor, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                value={mh.familyWhoHasIt[cond.id] || ''}
                onChangeText={v => updateFamilyWho(cond.id, v)}
                placeholder="Who has it? (e.g. Mother)"
                placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
              />
            )}
          </View>
        );
      })}

      {/* Dynamic (searched/created) conditions */}
      {conditionOthers.dynamicItems.map((cond: any) => {
        const isChecked = !!checkedMap[cond.id];
        return (
          <View key={cond.id}>
            <TouchableOpacity
              style={[styles.checkRow, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}
              onPress={() => toggleCondition(cond.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={[styles.conditionName, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
                {cond.name}
              </Text>
              <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
            </TouchableOpacity>
            {tab === 'family' && isChecked && (
              <TextInput
                style={[styles.whoInput, { backgroundColor: inputBg, color: inputColor, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                value={mh.familyWhoHasIt[cond.id] || ''}
                onChangeText={v => updateFamilyWho(cond.id, v)}
                placeholder="Who has it? (e.g. Mother)"
                placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
              />
            )}
          </View>
        );
      })}

      {/* Search/create for other conditions */}
      <View style={styles.otherSection}>
        <CatalogSearchField
          label="Other Conditions"
          input={conditionOthers.input}
          onInputChange={conditionOthers.handleInputChange}
          suggestions={conditionOthers.suggestions}
          displayKey="name"
          searching={conditionOthers.searching}
          creating={conditionOthers.creating}
          focused={conditionOthers.focused}
          onFocusChange={conditionOthers.setFocused}
          onSelect={(item) => {
            conditionOthers.selectItem(item);
            toggleCondition(item.id);
          }}
          onCreate={() => conditionOthers.createItem(conditionOthers.input.trim())}
          isDark={isDark}
          placeholder="Search or add conditions..."
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  tabRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  tabText: { fontWeight: '600', fontSize: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.neutral[400], alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  conditionName: { fontSize: 14, flex: 1 },
  whoInput: { marginLeft: 34, marginBottom: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 },
  otherSection: { marginTop: 20 },
});

export default MedicalHistoryStep;
